import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import type {
    BridgeRequest,
    BridgeResponse,
    FsListParams,
    FsListResult,
    FsReadParams,
    FsReadResult,
    FsWriteParams,
    FsWriteResult,
    AgentDispatchParams,
    AgentDispatchResult,
    BridgeGetLogsParams,
    BridgeGetLogsResult,
} from "@antigravity-mcp-bridge/shared";
import { BRIDGE_METHODS, ERROR_CODES, AG_MODELS } from "@antigravity-mcp-bridge/shared";
import type { ServerConfig } from "./server";
import { formatUnknownError } from "@antigravity-mcp-bridge/shared";

/**
 * 受信した JSON-RPC メッセージをディスパッチし、適切なハンドラを呼び出す。
 */
export async function handleMessage(
    request: BridgeRequest,
    config: ServerConfig
): Promise<BridgeResponse> {
    const { id, method, params } = request;

    try {
        switch (method) {
            case BRIDGE_METHODS.FS_LIST:
                return success(id, await handleFsList(params as unknown as FsListParams));

            case BRIDGE_METHODS.FS_READ:
                return success(
                    id,
                    await handleFsRead(params as unknown as FsReadParams, config)
                );

            case BRIDGE_METHODS.FS_WRITE:
                return success(
                    id,
                    await handleFsWrite(params as unknown as FsWriteParams, config)
                );

            case BRIDGE_METHODS.GET_LOGS:
                return success(
                    id,
                    await handleGetLogs(params as unknown as BridgeGetLogsParams, config)
                );

            case BRIDGE_METHODS.AGENT_DISPATCH:
                return success(
                    id,
                    await handleAgentDispatch(
                        params as unknown as AgentDispatchParams,
                        config
                    )
                );

            case BRIDGE_METHODS.AGENT_LIST_MODELS:
                return success(id, await handleAgentListModels());

            case BRIDGE_METHODS.IDE_DIAGNOSTICS:
                return success(id, await handleIdeDiagnostics());

            default:
                return error(id, -32601, `Method not found: ${method}`);
        }
    } catch (err: unknown) {
        if (err instanceof BridgeError) {
            return error(id, err.code, err.message);
        }
        const errorMessage = formatUnknownError(err);
        return error(id, -32603, `Internal error: ${errorMessage}`);
    }
}

async function handleIdeDiagnostics(): Promise<unknown> {
    try {
        const diagnostics = await vscode.commands.executeCommand(
            "antigravity.getDiagnostics"
        );
        return diagnostics;
    } catch (err: unknown) {
        throw new Error(`Failed to get IDE diagnostics: ${formatUnknownError(err)}`);
    }
}

// ============================================================
// fs/list
// ============================================================

async function handleFsList(
    params?: FsListParams
): Promise<FsListResult> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace folder is open");
    }
    const rootFolder = workspaceFolders[0];

    // VS Code の findFiles は .gitignore を尊重する
    // resolveFileUri が workspaceFolders[0] を基準にしているため、検索もそれに合わせる (Option A)
    const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(rootFolder, "**/*"),
        "**/node_modules/**"
    );

    const recursive = params?.recursive ?? true;
    const relativePaths: string[] = [];

    for (const file of files) {
        // rootFolder 配下であることは保証されている
        let relative = path.relative(rootFolder.uri.fsPath, file.fsPath);

        // Normalize separators to '/'
        relative = relative.split(path.sep).join("/");

        if (!recursive && relative.includes("/")) {
            continue;
        }

        relativePaths.push(relative);
    }

    return { files: relativePaths.sort() };
}

// ============================================================
// fs/read
// ============================================================

async function handleFsRead(
    params: FsReadParams,
    config: ServerConfig
): Promise<FsReadResult> {
    if (!params?.path) {
        throw createBridgeError(ERROR_CODES.INVALID_PARAMS, "Path is required");
    }

    const fileUri = resolveFileUri(params.path);

    // ファイルの存在チェックとサイズチェック
    let stat: vscode.FileStat;
    try {
        stat = await vscode.workspace.fs.stat(fileUri);
    } catch {
        throw createBridgeError(
            ERROR_CODES.FILE_NOT_FOUND,
            `File not found: ${params.path}`
        );
    }

    if (stat.size > config.maxFileSize) {
        throw createBridgeError(
            ERROR_CODES.FILE_TOO_LARGE,
            `File exceeds maximum size (${stat.size} > ${config.maxFileSize} bytes)`
        );
    }

    const contentBytes = await vscode.workspace.fs.readFile(fileUri);

    // バイナリファイル判定（null バイト検出）
    if (isBinaryContent(contentBytes)) {
        return { content: "Binary file" };
    }

    const content = new TextDecoder("utf-8").decode(contentBytes);
    return { content };
}

// ============================================================
// fs/write
// ============================================================

async function handleFsWrite(
    params: FsWriteParams,
    config: ServerConfig
): Promise<FsWriteResult> {
    if (!params?.path || params.content === undefined) {
        throw createBridgeError(
            ERROR_CODES.INVALID_PARAMS,
            "Path and content are required"
        );
    }

    // Read-Only モードチェック
    if (config.readOnly) {
        throw createBridgeError(
            ERROR_CODES.READ_ONLY_VIOLATION,
            "Write operations are disabled (read-only mode)"
        );
    }

    const fileUri = resolveFileUri(params.path);
    const contentBytes = new TextEncoder().encode(params.content);

    if (config.requireWriteApproval) {
        const approveStr = "Approve";
        const rejectStr = "Reject";
        const selection = await vscode.window.showInformationMessage(
            `MCP Bridge wants to write to ${params.path}.`,
            { modal: true },
            approveStr,
            rejectStr
        );
        if (selection !== approveStr) {
            config.logger.appendLine(
                `[MCP Bridge] Write rejected by user: ${params.path}`
            );
            throw createBridgeError(
                ERROR_CODES.USER_REJECTED,
                "Write operation rejected by user"
            );
        }
    } else {
        // 書き込み通知（仕様: v1.0 では通知のみ、自動承認）
        vscode.window.showInformationMessage(
            `MCP Bridge: Writing to ${params.path}`
        );
    }

    await vscode.workspace.fs.writeFile(fileUri, contentBytes);

    config.logger.appendLine(
        `[MCP Bridge] File written: ${params.path}`
    );

    return {
        success: true,
        message: `File written: ${params.path}`,
    };
}

async function handleAgentDispatch(
    params: AgentDispatchParams,
    config: ServerConfig
): Promise<AgentDispatchResult> {
    if (!params?.prompt) {
        throw createBridgeError(ERROR_CODES.INVALID_PARAMS, "Prompt is required");
    }

    const promptText = params.prompt;
    let selectedModel: string | undefined;

    try {
        if (params.model) {
            const internalModelId = mapToInternalModelId(params.model);
            const selectionResult = await enforceInternalModelSelection(internalModelId, config);
            selectedModel = selectionResult.selectedModel;
            const attemptsSummary = selectionResult.attempts.length > 0
                ? selectionResult.attempts.join(" | ")
                : "<none>";

            if (!selectionResult.applied) {
                config.logger.appendLine(
                    `[MCP Bridge] No internal model command applied for '${internalModelId}'. attempts=${attemptsSummary}`
                );
            } else if (!selectionResult.verified) {
                config.logger.appendLine(
                    `[MCP Bridge] Internal model command applied but verification is not conclusive for '${internalModelId}'. diagnostics='${selectionResult.diagnosticsModel ?? "<none>"}' attempts=${attemptsSummary}`
                );
            }
        }

        const finalPromptText = promptText;
        const payload: any = {
            message: finalPromptText
        };

        if (params.model) {
            payload.modelId = mapToInternalModelId(params.model);
        }

        await vscode.commands.executeCommand(
            "antigravity.sendTextToChat",
            payload
        );
    } catch (err: unknown) {
        config.logger.appendLine(
            `[MCP Bridge] Failed to dispatch agent task: ${formatUnknownError(err)}`
        );
        throw createBridgeError(
            ERROR_CODES.AGENT_DISPATCH_FAILED,
            `Failed to dispatch agent task: ${formatUnknownError(err)}`
        );
    }

    const preview =
        params.prompt.length > 80
            ? `${params.prompt.slice(0, 80)}...`
            : params.prompt;
    config.logger.appendLine(
        `[MCP Bridge] Agent task dispatched: "${preview}"`
    );

    const modelSuffix = selectedModel
        ? ` (model: ${selectedModel})`
        : params.model
            ? ` (requested model: ${params.model})`
            : "";
    return {
        success: true,
        message: `Agent task dispatched${modelSuffix}: "${preview}"`,
    };
}

async function enforceInternalModelSelection(
    requestedModel: string,
    config: ServerConfig
): Promise<ModelSelectionResult> {
    config.logger.appendLine(
        `[MCP Bridge] Enforcing internal model selection: ${requestedModel}`
    );

    const availableCommands = await vscode.commands.getCommands(true);
    const preferredCommands = [
        "antigravity.setModel",
        "antigravity.selectModel",
        "antigravity.changeModel",
        "antigravity.agentPanel.setModel",
        "antigravity.agentPanel.selectModel",
        "agCockpit.setModel",
        "agCockpit.selectModel",
        "agCockpit.refreshModelCache",
    ];
    const discoveredModelCommands = availableCommands.filter((commandId) =>
        /(antigravity|agCockpit)/i.test(commandId) && /model/i.test(commandId)
    );

    const commandIdsToTry = Array.from(
        new Set([
            ...preferredCommands.filter((commandId) => availableCommands.includes(commandId)),
            ...discoveredModelCommands,
        ])
    );

    const attemptLogs: string[] = [];
    let diagnosticsModel: string | undefined;
    let applied = false;

    for (const commandId of commandIdsToTry) {
        const commandSucceeded = await tryModelSelectionCommand(
            commandId,
            requestedModel,
            attemptLogs
        );

        if (!commandSucceeded) {
            continue;
        }

        applied = true;
        const verification = await verifyModelSelection(requestedModel);
        diagnosticsModel = verification.selectedModel ?? diagnosticsModel;
        config.logger.appendLine(
            `[MCP Bridge] Model verification after ${commandId}: requested='${requestedModel}', diagnostics='${verification.selectedModel ?? "<none>"}', diagnosticsAvailable=${verification.diagnosticsAvailable}, matched=${verification.matched}`
        );

        if (verification.matched) {
            config.logger.appendLine(
                `[MCP Bridge] Internal model selection applied via command: ${commandId}`
            );
            return {
                applied: true,
                verified: true,
                requestedModel,
                selectedModel: requestedModel,
                diagnosticsModel,
                attempts: attemptLogs,
            };
        }
    }

    return {
        applied,
        verified: false,
        requestedModel,
        selectedModel: applied ? requestedModel : undefined,
        diagnosticsModel,
        attempts: attemptLogs,
    };
}

interface ModelSelectionResult {
    applied: boolean;
    verified: boolean;
    requestedModel: string;
    selectedModel?: string;
    diagnosticsModel?: string;
    attempts: string[];
}

async function tryModelSelectionCommand(
    commandId: string,
    requestedModel: string,
    attemptLogs: string[]
): Promise<boolean> {
    const argsToTry: unknown[][] = [
        [requestedModel],
        [{ model: requestedModel }],
        [{ modelId: requestedModel }],
        [{ action: "setModel", model: requestedModel }],
        [{ action: "setModel", modelId: requestedModel }],
    ];

    for (const args of argsToTry) {
        try {
            await vscode.commands.executeCommand(commandId, ...args);
            attemptLogs.push(`ok:${commandId}(${JSON.stringify(args)})`);
            return true;
        } catch (err: unknown) {
            attemptLogs.push(
                `ng:${commandId}(${JSON.stringify(args)}):${formatUnknownError(err)}`
            );
        }
    }

    return false;
}

async function verifyModelSelection(
    requestedModel: string
): Promise<{ matched: boolean; selectedModel?: string; diagnosticsAvailable: boolean }> {
    const diagnostics = await safeGetIdeDiagnostics();
    if (!diagnostics) {
        return { matched: false, diagnosticsAvailable: false };
    }

    const selectedModel = extractSelectedModelName(diagnostics);
    if (!selectedModel) {
        return {
            matched: false,
            diagnosticsAvailable: true,
        };
    }

    return {
        matched: isEquivalentModelName(selectedModel, requestedModel),
        selectedModel,
        diagnosticsAvailable: true,
    };
}

async function safeGetIdeDiagnostics(): Promise<unknown | undefined> {
    try {
        return await vscode.commands.executeCommand("antigravity.getDiagnostics");
    } catch {
        return undefined;
    }
}

function extractSelectedModelName(diagnostics: unknown): string | undefined {
    if (!isRecord(diagnostics)) {
        return undefined;
    }

    const userSettings = diagnostics.userSettings;
    if (!isRecord(userSettings)) {
        return undefined;
    }

    const selectedName = userSettings.lastSelectedModelName;
    if (typeof selectedName === "string" && selectedName.trim().length > 0) {
        return selectedName.trim();
    }

    return undefined;
}

function mapToInternalModelId(model: string): string {
    switch (model.toLowerCase()) {
        case "gemini-3.1-pro-high":
        case "gemini-3-pro":
            return "RIFTRUNNER_THINKING_HIGH";
        case "gemini-3.1-pro":
            return "RIFTRUNNER_THINKING_LOW";
        case "gemini-3.1-flash":
        case "gemini-3-flash":
            return "INFINITYJET";
        case "gemini-2.5-pro":
            return "GOOGLE_GEMINI_2_5_PRO";
        case "gemini-2.5-flash":
            return "GOOGLE_GEMINI_2_5_FLASH";
        default:
            return model;
    }
}

function isEquivalentModelName(actual: string, expected: string): boolean {
    const normalize = (value: string): string =>
        value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const actualNormalized = normalize(actual);
    const expectedNormalized = normalize(expected);
    return (
        actualNormalized === expectedNormalized ||
        actualNormalized.includes(expectedNormalized) ||
        expectedNormalized.includes(actualNormalized)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

async function handleGetLogs(
    params: BridgeGetLogsParams,
    config: ServerConfig
): Promise<BridgeGetLogsResult> {
    const lines = params?.lines ?? 100;
    const logs = config.logger.getLogs(lines);
    return { logs };
}

async function handleAgentListModels(): Promise<{ models: string[] }> {
    return { models: [...AG_MODELS] };
}

// ============================================================
// Utilities
// ============================================================

function resolveFileUri(relativePath: string): vscode.Uri {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace folder is open");
    }

    const rootUri = workspaceFolders[0].uri;
    const rootPath = rootUri.fsPath;

    // 1. Normalized path
    const normalized = path.normalize(relativePath);

    // 2. Security Checks
    if (normalized.startsWith("/") || normalized.startsWith("\\")) {
        throw createBridgeError(ERROR_CODES.INVALID_PARAMS, "Path must be relative");
    }
    if (normalized.split(path.sep).includes("..")) {
        throw createBridgeError(ERROR_CODES.INVALID_PARAMS, "Directory traversal detected");
    }

    // 3. Resolve absolute path
    const absPath = path.join(rootPath, normalized);

    // 4. Verify containment
    let checkPath = absPath;
    try {
        checkPath = fs.realpathSync(absPath);
    } catch {
        // fs.realpathSync failed (e.g. file does not exist).
        // Try resolving the parent directory to check for symlinks/traversal.
        try {
            const parentDir = path.dirname(absPath);
            const resolvedParent = fs.realpathSync(parentDir);
            checkPath = path.join(resolvedParent, path.basename(absPath));
        } catch {
            // Parent directory resolution also failed.
            throw createBridgeError(
                ERROR_CODES.PATH_OUTSIDE_WORKSPACE,
                "Access denied: Unable to resolve path"
            );
        }
    }

    const rootPathWithSep = rootPath.endsWith(path.sep) ? rootPath : rootPath + path.sep;
    if (!checkPath.startsWith(rootPathWithSep) && checkPath !== rootPath) {
        throw createBridgeError(
            ERROR_CODES.PATH_OUTSIDE_WORKSPACE,
            "Access denied: Path is outside workspace"
        );
    }

    return vscode.Uri.file(absPath);
}

function isBinaryContent(buffer: Uint8Array): boolean {
    // 最初の 8192 バイトをスキャンして null バイトがあればバイナリとみなす
    const scanLength = Math.min(buffer.length, 8192);
    for (let i = 0; i < scanLength; i++) {
        if (buffer[i] === 0) {
            return true;
        }
    }
    return false;
}

/**
 * Bridge プロトコルのエラーを throw するためのヘルパー。
 * handleMessage の catch で code と message を取り出してレスポンスに変換する。
 */
class BridgeError extends Error {
    code: number;
    constructor(code: number, message: string) {
        super(message);
        this.code = code;
        this.name = "BridgeError";
    }
}

function createBridgeError(code: number, message: string): BridgeError {
    return new BridgeError(code, message);
}

// ============================================================
// Response Helpers
// ============================================================

function success(id: number | string | null, result: unknown): BridgeResponse {
    return { jsonrpc: "2.0", id, result };
}

function error(id: number | string | null, code: number, message: string): BridgeResponse {
    return { jsonrpc: "2.0", id, error: { code, message } };
}
