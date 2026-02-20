import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { BridgeWebSocketServer } from "./server";
import { formatUnknownError } from "@antigravity-mcp-bridge/shared";
let wsServer: BridgeWebSocketServer | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel(
        "Antigravity MCP Bridge"
    );
    context.subscriptions.push(outputChannel);

    const config = vscode.workspace.getConfiguration("antigravity.mcp");
    const port = config.get<number>("port", 8888);
    let token = config.get<string>("token", "");
    const readOnly = config.get<boolean>("readOnly", false);
    const maxFileSize = config.get<number>("maxFileSize", 102400);

    // トークンが未設定の場合は自動生成
    if (!token) {
        token = generateToken();
        outputChannel.appendLine(`[MCP Bridge] Generated token: ${token}`);
        outputChannel.appendLine(
            `[MCP Bridge] Set "antigravity.mcp.token" in settings to use a fixed token.`
        );
        outputChannel.show(true);
    }

    wsServer = new BridgeWebSocketServer({
        port,
        token,
        readOnly,
        maxFileSize,
        outputChannel,
    });

    wsServer.start();

    outputChannel.appendLine(
        `[MCP Bridge] WebSocket server started on ws://127.0.0.1:${port}`
    );
    outputChannel.appendLine(`[MCP Bridge] Read-only mode: ${readOnly}`);
    outputChannel.appendLine(
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
            (payload: { action: string; text: string }) => {
                outputChannel.appendLine(`[MCP Bridge] Received agent prompt: ${payload.text}`);
                vscode.window.showInformationMessage(`Agent Prompt: ${payload.text}`);
            }
        )
    );

    // 設定変更の監視
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("antigravity.mcp")) {
                outputChannel.appendLine(
                    "[MCP Bridge] Configuration changed. Restart the extension to apply."
                );
            }
        })
    );

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
