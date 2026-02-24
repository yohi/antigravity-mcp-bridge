import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";
import { BridgeWebSocketServer } from "./server";
import { BRIDGE_METHODS } from "@antigravity-mcp-bridge/shared";
import { RingBufferLogger } from "./logger";
let wsServer: BridgeWebSocketServer | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel(
        "Antigravity MCP Bridge"
    );
    const logger = new RingBufferLogger(outputChannel);
    context.subscriptions.push(outputChannel);

    const config = vscode.workspace.getConfiguration("antigravity.mcp");
    const port = config.get<number>("port", 8888);
    let token = config.get<string>("token", "");
    const readOnly = config.get<boolean>("readOnly", false);
    const requireWriteApproval = config.get<boolean>("requireWriteApproval", false);
    const maxFileSize = config.get<number>("maxFileSize", 102400);

    // トークンが未設定の場合は自動生成
    if (!token) {
        token = generateToken();
        outputChannel.appendLine(`[MCP Bridge] Generated token: ${token}`);
        logger.appendLine(
            `[MCP Bridge] Set "antigravity.mcp.token" in settings to use a fixed token.`
        );
        logger.show(true);
    }

    wsServer = new BridgeWebSocketServer({
        port,
        token,
        readOnly,
        requireWriteApproval,
        maxFileSize,
        logger,
    });

    wsServer.start();

    logger.appendLine(
        `[MCP Bridge] WebSocket server started on ws://127.0.0.1:${port}`
    );
    logger.appendLine(`[MCP Bridge] Read-only mode: ${readOnly}`);
    logger.appendLine(`[MCP Bridge] Authorization required: ${requireWriteApproval}`);
    logger.appendLine(
        `[MCP Bridge] Max file size: ${maxFileSize} bytes`
    );

    const agentCommandId = "antigravity.sendPromptToAgentPanel";
    const availableCommands = await vscode.commands.getCommands(true);
    const hasNativeAgentCommand = availableCommands.includes(agentCommandId);

    if (hasNativeAgentCommand) {
        logger.appendLine(`[MCP Bridge] Native command detected: ${agentCommandId}`);
    } else {
        logger.appendLine(
            `[MCP Bridge] Native command not found. Registering fallback mock: ${agentCommandId}`
        );
        context.subscriptions.push(
            vscode.commands.registerCommand(
                agentCommandId,
                (payload?:
                    | string
                    | {
                        action?: string;
                        text?: string;
                        modelId?: string;
                        model?: string;
                    },
                    options?: {
                        modelId?: string;
                        model?: string;
                    }) => {
                    const text = typeof payload === "string" ? payload : payload?.text;
                    const modelFromPayload = typeof payload === "string"
                        ? undefined
                        : payload?.modelId ?? payload?.model;
                    const model = modelFromPayload ?? options?.modelId ?? options?.model;
                    if (typeof text === "string") {
                        logger.appendLine(
                            `[MCP Bridge] Agent prompt received${model ? ` (model: ${model})` : ""}`
                        );
                        vscode.window.showInformationMessage("Agent prompt received");
                    } else {
                        logger.appendLine("[MCP Bridge] Invalid agent prompt received");
                    }
                }
            )
        );
    }

    let cachedIgnoreDirs: Set<string> | undefined;
    let cachedIgnoreDirsPromise: Promise<Set<string>> | undefined;

    const loadIgnoreDirs = async (): Promise<Set<string>> => {
        const defaultIgnoreDirs = [".git", "node_modules", "dist", "out"];
        let configuredIgnoreDirs = vscode.workspace.getConfiguration("antigravity").get<string[]>("ignoreDirs");
        if (!Array.isArray(configuredIgnoreDirs)) {
            configuredIgnoreDirs = [];
        }

        const ignoreSet = new Set([...defaultIgnoreDirs, ...configuredIgnoreDirs]);
        const workspaceFolderUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (workspaceFolderUri) {
            const ignoreFileUri = vscode.Uri.joinPath(workspaceFolderUri, ".antigravityignore");
            try {
                // Read file asynchronously
                const content = await vscode.workspace.fs.readFile(ignoreFileUri);
                const fileContent = Buffer.from(content).toString("utf8");
                fileContent.split(/\r?\n/).forEach((line) => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith("#")) {
                        ignoreSet.add(trimmed);
                    }
                });
            } catch (e) {
                if (e instanceof vscode.FileSystemError && e.code === "FileNotFound") {
                    // Ignore file not found
                } else {
                    logger.appendLine(`[MCP Bridge] Failed to read .antigravityignore: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
        }
        return ignoreSet;
    };

    const refreshCache = (): Promise<Set<string>> => {
        if (cachedIgnoreDirsPromise) {
            return cachedIgnoreDirsPromise;
        }
        cachedIgnoreDirsPromise = (async () => {
            try {
                const dirs = await loadIgnoreDirs();
                cachedIgnoreDirs = dirs;
                return dirs;
            } catch (e) {
                logger.appendLine(`[MCP Bridge] Error loading ignore dirs cache: ${e instanceof Error ? e.message : String(e)}`);
                const fallback = new Set([".git", "node_modules", "dist", "out"]);
                cachedIgnoreDirs = fallback;
                return fallback;
            } finally {
                cachedIgnoreDirsPromise = undefined;
            }
        })();
        return cachedIgnoreDirsPromise;
    };

    const getIgnoreDirs = async (): Promise<Set<string>> => {
        if (cachedIgnoreDirs) {
            return cachedIgnoreDirs;
        }
        return refreshCache();
    };

    // Initialize cache at startup
    refreshCache();

    const ignoreWatcher = vscode.workspace.createFileSystemWatcher("**/.antigravityignore");
    ignoreWatcher.onDidChange(refreshCache);
    ignoreWatcher.onDidCreate(refreshCache);
    ignoreWatcher.onDidDelete(refreshCache);
    context.subscriptions.push(ignoreWatcher);

    // 設定変更の監視
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("antigravity.mcp")) {
                logger.appendLine(
                    "[MCP Bridge] Configuration changed. Restart the extension to apply."
                );
            }
            if (e.affectsConfiguration("antigravity.ignoreDirs")) {
                refreshCache();
            }
        })
    );

    // File System Watcher
    const watcher = vscode.workspace.createFileSystemWatcher("**/*");
    const broadcastEvent = async (type: "file_created" | "file_changed" | "file_deleted", uri: vscode.Uri) => {
        if (!wsServer) return;
        const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!rootPath) return;

        // Skip files outside the primary workspace folder
        let relativePath = path.relative(rootPath, uri.fsPath);
        if (relativePath === ".." || relativePath.startsWith(".." + path.sep) || path.isAbsolute(relativePath)) return;

        relativePath = relativePath.split(path.sep).join("/");

        const ignoreDirs = await getIgnoreDirs();

        if (relativePath.split("/").some(segment => ignoreDirs.has(segment))) {
            return;
        }

        wsServer.broadcast({
            jsonrpc: "2.0",
            method: BRIDGE_METHODS.WORKSPACE_EVENT,
            params: {
                type,
                path: relativePath,
            },
        });
    };

    watcher.onDidCreate((uri) =>
        broadcastEvent("file_created", uri).catch((e) =>
            logger.appendLine(`[MCP Bridge] Error broadcasting file_created for ${uri.fsPath}: ${e instanceof Error ? e.message : String(e)}`)
        )
    );
    watcher.onDidChange((uri) =>
        broadcastEvent("file_changed", uri).catch((e) =>
            logger.appendLine(`[MCP Bridge] Error broadcasting file_changed for ${uri.fsPath}: ${e instanceof Error ? e.message : String(e)}`)
        )
    );
    watcher.onDidDelete((uri) =>
        broadcastEvent("file_deleted", uri).catch((e) =>
            logger.appendLine(`[MCP Bridge] Error broadcasting file_deleted for ${uri.fsPath}: ${e instanceof Error ? e.message : String(e)}`)
        )
    );

    context.subscriptions.push(watcher);

    context.subscriptions.push({
        dispose: () => {
            wsServer?.stop();
        },
    });
}

export function deactivate(): void {
    wsServer?.stop();
    wsServer = undefined;
}

function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
}
