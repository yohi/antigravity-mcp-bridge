import * as vscode from "vscode";
import * as crypto from "crypto";
import { BridgeWebSocketServer } from "./server";
import { formatUnknownError } from "./error-format";

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

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity-mcp-bridge.testPrompt",
            async () => {
                outputChannel.show(true);
                outputChannel.appendLine(`\n[MCP Bridge] === Agent Dispatch Test ===`);
                const tp = "Reply with exactly one word: HELLO";

                outputChannel.appendLine(
                    `[MCP Bridge] Testing antigravity.sendPromptToAgentPanel...`
                );
                try {
                    const result = await vscode.commands.executeCommand(
                        "antigravity.sendPromptToAgentPanel",
                        tp
                    );
                    outputChannel.appendLine(
                        `  (${JSON.stringify(tp)}) => ${JSON.stringify(result)} [${typeof result}]`
                    );
                } catch (e: unknown) {
                    outputChannel.appendLine(
                        `  (${JSON.stringify(tp)}) ERR: ${formatUnknownError(e)}`
                    );
                }

                outputChannel.appendLine(`[MCP Bridge] === Test Complete ===`);
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
