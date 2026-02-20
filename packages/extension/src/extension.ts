import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { BridgeWebSocketServer } from "./server";
import { formatUnknownError, BRIDGE_METHODS } from "@antigravity-mcp-bridge/shared";
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
        logger.appendLine(`[MCP Bridge] Generated token: ${token}`);
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
    logger.appendLine(
        `[MCP Bridge] Max file size: ${maxFileSize} bytes`
    );

    // 注意: この "antigravity.sendPromptToAgentPanel" のモック登録は、
    // Antigravity IDE 外での開発/テスト時のフォールバックとして使用され、意図的に実際の IDE コマンドを上書きします。
    // 本番環境や Antigravity IDE 内で実行する場合は、実際のコマンドを使用する必要があります。
    // このモックは handlers.ts で vscode.commands.executeCommand("antigravity.sendPromptToAgentPanel", ...) と
    // 呼び出される開発時のローカルテストにて実行されます。
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity.sendPromptToAgentPanel",
            (payload?: { action?: string; text?: string }) => {
                if (typeof payload?.text === "string") {
                    logger.appendLine("[MCP Bridge] Agent prompt received");
                    vscode.window.showInformationMessage("Agent prompt received");
                } else {
                    logger.appendLine("[MCP Bridge] Invalid agent prompt received");
                }
            }
        )
    );

    // 設定変更の監視
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("antigravity.mcp")) {
                logger.appendLine(
                    "[MCP Bridge] Configuration changed. Restart the extension to apply."
                );
            }
        })
    );

    // File System Watcher
    const watcher = vscode.workspace.createFileSystemWatcher("**/*");
    const broadcastEvent = (type: "file_created" | "file_changed" | "file_deleted", uri: vscode.Uri) => {
        if (!wsServer) return;
        const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!rootPath) return;

        // Skip files outside the primary workspace folder
        if (!uri.fsPath.startsWith(rootPath)) return;

        let relativePath = path.relative(rootPath, uri.fsPath);
        relativePath = relativePath.split(path.sep).join("/");

        wsServer.broadcast({
            jsonrpc: "2.0",
            id: null,
            method: BRIDGE_METHODS.WORKSPACE_EVENT,
            params: {
                type,
                path: relativePath,
            },
        });
    };

    watcher.onDidCreate((uri) => broadcastEvent("file_created", uri));
    watcher.onDidChange((uri) => broadcastEvent("file_changed", uri));
    watcher.onDidDelete((uri) => broadcastEvent("file_deleted", uri));

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
