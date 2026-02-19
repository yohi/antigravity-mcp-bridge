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
} from "./shared/types";
import { BRIDGE_METHODS, ERROR_CODES } from "./shared/types";
import type { ServerConfig } from "./server";
import { formatUnknownError } from "./error-format";

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

            case BRIDGE_METHODS.AGENT_DISPATCH:
                return success(
                    id,
                    await handleAgentDispatch(
                        params as unknown as AgentDispatchParams,
                        config
                    )
                );

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

    // 書き込み通知（仕様: v1.0 では通知のみ、自動承認）
    vscode.window.showInformationMessage(
        `MCP Bridge: Writing to ${params.path}`
    );

    await vscode.workspace.fs.writeFile(fileUri, contentBytes);

    config.outputChannel.appendLine(
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

    await vscode.commands.executeCommand(
        "antigravity.sendPromptToAgentPanel",
        params.prompt
    );

    const preview =
        params.prompt.length > 80
            ? `${params.prompt.slice(0, 80)}...`
            : params.prompt;
    config.outputChannel.appendLine(
        `[MCP Bridge] Agent task dispatched: "${preview}"`
    );

    return { success: true };
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

function success(id: number, result: unknown): BridgeResponse {
    return { jsonrpc: "2.0", id, result };
}

function error(id: number, code: number, message: string): BridgeResponse {
    return { jsonrpc: "2.0", id, error: { code, message } };
}
