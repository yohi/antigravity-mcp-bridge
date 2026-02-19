import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { BridgeWebSocketServer } from "./server";
import { formatUnknownError } from "@antigravity-mcp-bridge/shared";
import { TrajectoryTracker } from "./trajectory-tracker";
import { PayloadEncoder } from "./payload-encoder";

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
    const llmTimeout = config.get<number>("llmTimeout", 60);

    // トークンが未設定の場合は自動生成
    if (!token) {
        token = generateToken();
        outputChannel.appendLine(`[MCP Bridge] Generated token: ${token}`);
        outputChannel.appendLine(
            `[MCP Bridge] Set "antigravity.mcp.token" in settings to use a fixed token.`
        );
        outputChannel.show(true);
    }

    const globalStatePath = path.join(
        context.globalStorageUri.fsPath,
        "../../globalStorage/state.vscdb"
    );

    wsServer = new BridgeWebSocketServer({
        port,
        token,
        readOnly,
        maxFileSize,
        llmTimeout,
        outputChannel,
        globalStatePath,
    });

    wsServer.start();

    outputChannel.appendLine(
        `[MCP Bridge] WebSocket server started on ws://127.0.0.1:${port}`
    );
    outputChannel.appendLine(`[MCP Bridge] Read-only mode: ${readOnly}`);
    outputChannel.appendLine(
        `[MCP Bridge] Max file size: ${maxFileSize} bytes`
    );
    outputChannel.appendLine(
        `[MCP Bridge] LLM timeout: ${llmTimeout} seconds`
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

    // Diagnostic command to list available antigravity commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity-mcp-bridge.diagnoseCommands",
            async () => {
                outputChannel.show(true);
                outputChannel.appendLine(`\n[MCP Bridge] === Command Diagnostics ===`);

                // Get all commands
                const allCommands = await vscode.commands.getCommands(true);
                const antigravityCommands = allCommands.filter(cmd =>
                    cmd.toLowerCase().includes('antigravity')
                );

                try {
                    fs.writeFileSync('/tmp/antigravity-commands.txt', antigravityCommands.join('\n'));
                } catch (e) {
                    outputChannel.appendLine(`Failed to write commands file: ${e}`);
                }

                outputChannel.appendLine(`Found ${antigravityCommands.length} antigravity commands:`);
                // Test specific commands
                outputChannel.appendLine(`\n[MCP Bridge] Testing specific commands...`);

                const commandsToTest = [
                    'antigravity.sendPromptToAgentPanel',
                    'antigravity.getDiagnostics',
                    'antigravity.sendPrompt',
                    'antigravity.agentPanel.sendPrompt',
                    'antigravity.openAgentPanel'
                ];

                for (const cmd of commandsToTest) {
                    const exists = allCommands.includes(cmd);
                    outputChannel.appendLine(`  ${cmd}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
                }

                outputChannel.appendLine(`[MCP Bridge] === Diagnostics Complete ===`);
            }
        )
    );

    // Test getDiagnostics output
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity-mcp-bridge.testDiagnostics",
            async () => {
                outputChannel.show(true);
                outputChannel.appendLine(`\n[MCP Bridge] === Testing getDiagnostics ===`);

                try {
                    const result = await vscode.commands.executeCommand("antigravity.getDiagnostics");
                    outputChannel.appendLine(`Raw result type: ${typeof result}`);

                    if (typeof result === "string") {
                        outputChannel.appendLine(`String length: ${result.length}`);
                        outputChannel.appendLine(`First 500 chars: ${result.substring(0, 500)}`);

                        // Check for cascade_id patterns
                        const cascadeIdMatches = result.match(/cascade[_-]?id["\s]*[:=]["\s]*([^"\s,}]+)/gi);
                        if (cascadeIdMatches) {
                            outputChannel.appendLine(`\nFound cascade_id patterns: ${cascadeIdMatches.length}`);
                            cascadeIdMatches.slice(0, 5).forEach((match, i) => {
                                outputChannel.appendLine(`  ${i + 1}. ${match}`);
                            });
                        } else {
                            outputChannel.appendLine(`\nNo cascade_id patterns found`);
                        }
                    } else if (result && typeof result === "object") {
                        outputChannel.appendLine(`Object keys: ${Object.keys(result).join(", ")}`);
                        outputChannel.appendLine(`\nFull JSON (first 1000 chars):`);
                        outputChannel.appendLine(JSON.stringify(result, null, 2).substring(0, 1000));
                    } else {
                        outputChannel.appendLine(`Result: ${JSON.stringify(result)}`);
                    }

                    outputChannel.appendLine(`\n[MCP Bridge] === Diagnostics Test Complete ===`);
                } catch (e: unknown) {
                    outputChannel.appendLine(`Error: ${formatUnknownError(e)}`);
                }
            }
        )
    );

    // Test full llm/ask flow
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity-mcp-bridge.testLlmAsk",
            async () => {
                outputChannel.show(true);
                outputChannel.appendLine(`\n[MCP Bridge] === Testing llm/ask Flow ===`);

                const prompt = "Say hello";
                outputChannel.appendLine(`Sending prompt: "${prompt}"`);

                try {
                    // Step 1: Force a new conversation (Cascade)
                    outputChannel.appendLine(`\nStep 1: Trying cascadeStarterPrompt...`);
                    const res1 = await vscode.commands.executeCommand("antigravity.cascadeStarterPrompt", prompt);
                    outputChannel.appendLine(`res1: ${JSON.stringify(res1)}`);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                    outputChannel.appendLine(`\nStep 2: Trying executeCascadeAction...`);
                    const res2 = await vscode.commands.executeCommand("antigravity.executeCascadeAction", prompt);
                    outputChannel.appendLine(`res2: ${JSON.stringify(res2)}`);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                    outputChannel.appendLine(`\nStep 3: Trying cascadeBar...`);
                    const res3 = await vscode.commands.executeCommand("antigravity.cascadeBar", prompt);
                    outputChannel.appendLine(`res3: ${JSON.stringify(res3)}`);

                    // Step 4: Poll DB for new trajectory/cascade ID
                    outputChannel.appendLine(`\nStep 4: Polling DB with TrajectoryTracker...`);
                    const tracker = new TrajectoryTracker(outputChannel, globalStatePath);
                    const { cascadeId, text } = await tracker.pollUntilComplete(60000);

                    outputChannel.appendLine(`\nCaptured Text from cascade: ${cascadeId}`);
                    outputChannel.appendLine(`---\n${text}\n---`);

                    outputChannel.appendLine(`\n[MCP Bridge] === llm/ask Flow Test Complete ===`);
                } catch (e: unknown) {
                    outputChannel.appendLine(`Error: ${formatUnknownError(e)}`);
                }
            }
        )
    );

    // Test cascade-related commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity-mcp-bridge.testCascadeCommands",
            async () => {
                outputChannel.show(true);
                outputChannel.appendLine(`\n[MCP Bridge] === Testing Cascade Commands ===`);

                const cascadeCommands = [
                    'antigravity.getCascadePluginTemplate',
                    'antigravity.executeCascadeAction',
                    'antigravity.setVisibleConversation',
                    'antigravity.startNewConversation',
                    'antigravity.openConversationPicker',
                    'antigravity.trackBackgroundConversationCreated',
                    'antigravity.sendTextToChat',
                ];

                for (const cmd of cascadeCommands) {
                    outputChannel.appendLine(`\nTesting: ${cmd}`);
                    try {
                        // Try calling with no args first
                        const result = await vscode.commands.executeCommand(cmd);
                        outputChannel.appendLine(`  Result type: ${typeof result}`);
                        outputChannel.appendLine(`  Result: ${JSON.stringify(result)?.substring(0, 200) || 'undefined'}`);
                    } catch (e: unknown) {
                        outputChannel.appendLine(`  Error: ${formatUnknownError(e)}`);
                    }
                }

                outputChannel.appendLine(`\n[MCP Bridge] === Cascade Commands Test Complete ===`);
            }
        )
    );

    // Test sendPromptToAgentPanel with detailed logging
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity-mcp-bridge.testSendPrompt",
            async () => {
                outputChannel.show(true);
                outputChannel.appendLine(`\n[MCP Bridge] === Testing sendPromptToAgentPanel ===`);

                const prompt = "Say hello in one word";

                // Test 1: String prompt
                outputChannel.appendLine(`Test 1: String prompt`);
                try {
                    const result1 = await vscode.commands.executeCommand(
                        "antigravity.sendPromptToAgentPanel",
                        prompt
                    );
                    outputChannel.appendLine(`  Result: ${JSON.stringify(result1)}`);
                } catch (e: unknown) {
                    outputChannel.appendLine(`  Error: ${formatUnknownError(e)}`);
                }

                // Test 2: Object with prompt
                outputChannel.appendLine(`\nTest 2: Object with prompt`);
                try {
                    const result2 = await vscode.commands.executeCommand(
                        "antigravity.sendPromptToAgentPanel",
                        { prompt: prompt }
                    );
                    outputChannel.appendLine(`  Result: ${JSON.stringify(result2)}`);
                } catch (e: unknown) {
                    outputChannel.appendLine(`  Error: ${formatUnknownError(e)}`);
                }

                // Test 3: Object with prompt and metadata
                outputChannel.appendLine(`\nTest 3: Object with prompt and metadata`);
                try {
                    const result3 = await vscode.commands.executeCommand(
                        "antigravity.sendPromptToAgentPanel",
                        {
                            prompt: prompt,
                            source: "mcp-bridge",
                            timestamp: Date.now()
                        }
                    );
                    outputChannel.appendLine(`  Result: ${JSON.stringify(result3)}`);
                } catch (e: unknown) {
                    outputChannel.appendLine(`  Error: ${formatUnknownError(e)}`);
                }

                outputChannel.appendLine(`\n[MCP Bridge] === sendPromptToAgentPanel Test Complete ===`);
            }
        )
    );

    // Test internal trace and state commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity-mcp-bridge.testInternalApis",
            async () => {
                outputChannel.show(true);
                outputChannel.appendLine(`\n[MCP Bridge] === Testing Internal Trace/State APIs ===`);

                const internalCmds = [
                    "antigravity.captureTraces", "antigravity.pollMcpServerStates", "antigravity.getManagerTrace",
                    "antigravity.getWorkbenchTrace",
                    "antigravity.captureTraces", "antigravity.pollMcpServerStates", "antigravity.openConversationWorkspaceQuickPick", // Might need args
                ];

                for (const cmd of internalCmds) {
                    outputChannel.appendLine(`\n--- Testing Command: ${cmd} ---`);
                    try {
                        const result = await vscode.commands.executeCommand(cmd);
                        outputChannel.appendLine(`Type: ${typeof result}`);
                        if (result && typeof result === "object") {
                            const keys = Object.keys(result);
                            outputChannel.appendLine(`Keys: ${keys.slice(0, 10).join(", ")}${keys.length > 10 ? "..." : ""}`);
                            const serialized = JSON.stringify(result, null, 2);
                            outputChannel.appendLine(`Preview: ${serialized.substring(0, 1000)}`);
                        } else {
                            outputChannel.appendLine(`Result: ${String(result).substring(0, 500)}`);
                        }
                    } catch (e: unknown) {
                        outputChannel.appendLine(`Error: ${formatUnknownError(e)}`);
                    }
                }

                outputChannel.appendLine(`\n[MCP Bridge] === Internal API Test Complete ===`);
            }
        )
    );

    // Test storage paths
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity-mcp-bridge.testStoragePath",
            async () => {
                outputChannel.show(true);
                outputChannel.appendLine(`\n[MCP Bridge] === Storage Path Diagnostics ===`);

                outputChannel.appendLine(`extensionPath: ${context.extensionPath}`);
                outputChannel.appendLine(`storageUri: ${context.storageUri?.fsPath || "undefined"}`);
                outputChannel.appendLine(`globalStorageUri: ${context.globalStorageUri.fsPath}`);
                outputChannel.appendLine(`logUri: ${context.logUri.fsPath}`);

                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    workspaceFolders.forEach((f, i) => {
                        outputChannel.appendLine(`WorkspaceFolder[${i}]: ${f.uri.fsPath}`);
                    });
                }

                outputChannel.appendLine(`\n[MCP Bridge] === Storage Path Test Complete ===`);
            }
        )
    );

    // Test storage content
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "antigravity-mcp-bridge.testStorageContent",
            async () => {
                outputChannel.show(true);
                outputChannel.appendLine(`\n[MCP Bridge] === Global Storage Content Test ===`);

                const globalStatePath = path.join(
                    context.globalStorageUri.fsPath,
                    "../../globalStorage/state.vscdb"
                );

                outputChannel.appendLine(`Target DB: ${globalStatePath}`);

                try {
                    // Note: We can't easily use sqlite3 inside the extension without a native module.
                    // But we can check if the file exists and its size.
                    const stats = fs.statSync(globalStatePath);
                    outputChannel.appendLine(`DB Size: ${stats.size} bytes`);

                    // Try to read a small chunk to check for strings
                    const buffer = Buffer.alloc(4096);
                    const fd = fs.openSync(globalStatePath, 'r');
                    fs.readSync(fd, buffer, 0, 4096, 0);
                    fs.closeSync(fd);

                    const preview = buffer.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
                    outputChannel.appendLine(`Header Preview: ${preview.substring(0, 500)}`);

                } catch (e: unknown) {
                    outputChannel.appendLine(`Error reading storage: ${formatUnknownError(e)}`);
                }

                outputChannel.appendLine(`\n[MCP Bridge] === Storage Content Test Complete ===`);
            }
        )
    );

    // Note: antigravity.sendPromptToAgentPanel is provided by Antigravity IDE itself.
    // Do not register a dummy implementation here to avoid overriding the real command.

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
