import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";
import * as os from "os";
import { execSync, execFileSync } from "child_process";
import { BridgeWebSocketServer } from "./server";
import { BRIDGE_METHODS, mapToInternalModelId, AG_MODELS } from "@antigravity-mcp-bridge/shared";
import { RingBufferLogger } from "./logger";

// === SQLite DB Direct Model Patch ===
// AntigravityはSQLite DB (~/.config/Antigravity/User/globalStorage/state.vscdb) に
// Protobuf形式でモデル選択状態を保存している。
// sendTextToChatを呼ぶ直前にDBを書き換え、直後に元に戻すことでモデルを指定する。

const getDbPath = () => {
    const home = os.homedir();
    const subPath = path.join('Antigravity', 'User', 'globalStorage', 'state.vscdb');
    switch (process.platform) {
        case 'win32':
            return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), subPath);
        case 'darwin':
            return path.join(home, 'Library', 'Application Support', subPath);
        default:
            return path.join(home, '.config', subPath);
    }
};

const ANTIGRAVITY_DB_PATH = getDbPath();
const MODEL_PREF_KEY = 'antigravityUnifiedStateSync.modelPreferences';

function encodeVarint(value: number): Buffer {
    const bytes: number[] = [];
    do {
        let byte = value & 0x7f;
        value >>>= 7;
        if (value !== 0) {
            byte |= 0x80;
        }
        bytes.push(byte);
    } while (value !== 0);
    return Buffer.from(bytes);
}

/**
 * Protobufバイナリを組み立てて Base64 エンコードした値を返す
 * 構造: OuterMsg { field1: KVMsg { field1(str): key, field2: ValMsg { field1(str): modelId } } }
 */
function buildModelPreferencesProto(modelId: string): string {
    const key = 'last_selected_agent_model_sentinel_key';
    const keyBytes = Buffer.from(key, 'utf-8');
    const modelBytes = Buffer.from(modelId, 'utf-8');

    // innerValMsg: tag(field1,LEN)=0x0a + varint(length) + modelBytes
    const innerVal = Buffer.concat([Buffer.from([0x0a]), encodeVarint(modelBytes.length), modelBytes]);
    // kvMsg: tag(field1,LEN)=0x0a + varint(len) + keyBytes + tag(field2,LEN)=0x12 + varint(len) + innerVal
    const kv = Buffer.concat([
        Buffer.from([0x0a]), encodeVarint(keyBytes.length), keyBytes,
        Buffer.from([0x12]), encodeVarint(innerVal.length), innerVal,
    ]);
    // outerMsg: tag(field1,LEN)=0x0a + varint(len) + kv
    const outer = Buffer.concat([Buffer.from([0x0a]), encodeVarint(kv.length), kv]);
    return outer.toString('base64');
}

/** DBからモデル設定を読み書きする（sqlite3 CLIを使用） */
export function readModelFromDb(): string | undefined {
    try {
        const result = execFileSync(
            "sqlite3",
            [ANTIGRAVITY_DB_PATH, `SELECT value FROM ItemTable WHERE key='${MODEL_PREF_KEY}'`]
        ).toString().trim();
        if (!result) return undefined;
        // Base64 → バイナリ → モデルID文字列を抽出
        const buf = Buffer.from(result, 'base64');
        // モデルID部分: outer(0x0a,len) + kv(0x0a,38bytes key, 0x12,len) + innerVal(0x0a,len) + modelBytes
        // innerVal offset = 2(outer hdr) + 2(kv field1 hdr) + 38(key) + 2(kv field2 hdr) = 44 bytes
        // then innerVal = 0x0a + 1byte(len) + modelId
        const kvStart = 2; // outer header skip
        if (kvStart + 1 >= buf.length) {
            console.error("Buffer too short");
            return undefined;
        }
        const keyLen = buf[kvStart + 1]; // kv field1 length
        const innerValOffset = kvStart + 2 + keyLen + 2; // skip outer hdr + kv-field1-hdr + key + kv-field2-hdr
        if (innerValOffset + 1 >= buf.length) {
            console.error("Invalid inner value offset");
            return undefined;
        }
        // innerVal: 0x0a(tag) + length byte + modelId bytes
        const modelIdLen = buf[innerValOffset + 1];
        if (innerValOffset + 2 + modelIdLen > buf.length) {
            console.error("Model ID length out of bounds");
            return undefined;
        }
        const modelId = buf.slice(innerValOffset + 2, innerValOffset + 2 + modelIdLen).toString('utf-8');
        return modelId;
    } catch {
        return undefined;
    }
}

export function writeModelToDb(modelId: string): void {
    const b64 = buildModelPreferencesProto(modelId);
    const safeB64 = b64.replace(/'/g, "''");
    const safeKey = MODEL_PREF_KEY.replace(/'/g, "''");
    const sql = `UPDATE ItemTable SET value='${safeB64}' WHERE key='${safeKey}'`;
    execFileSync("sqlite3", [ANTIGRAVITY_DB_PATH, sql]);
}

export function setCurrentTargetModel(_modelId: string | undefined) {
    // 後方互換のためのstub - handlers.ts から呼ばれる
}

// Mutex lock for agent dispatch to prevent race conditions during DB patching
export let dispatchLock: Promise<void> = Promise.resolve();

export function withDispatchLock<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        dispatchLock = dispatchLock.then(async () => {
            try {
                resolve(await task());
            } catch (err) {
                reject(err);
            }
        }).catch(reject);
    });
}

// ===============================================

let wsServer: BridgeWebSocketServer | undefined;
let sqliteAvailable = false;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel(
        "Antigravity MCP Bridge"
    );

    // Check sqlite3 availability
    try {
        execSync('sqlite3 --version');
        sqliteAvailable = true;
    } catch (e) {
        outputChannel.appendLine(`[MCP Bridge] WARNING: sqlite3 CLI not found. Model selection via DB patch will be disabled.`);
    }
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

    context.subscriptions.push(
        vscode.commands.registerCommand("antigravityMcpBridge.postPrompt", async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: "MCP Bridge: エージェントに送信するプロンプトを入力してください",
                placeHolder: "例: こんにちは！"
            });

            if (!prompt) return;

            const models = [
                "自動選択 (デフォルト)",
                ...AG_MODELS
            ];

            const selectedModel = await vscode.window.showQuickPick(models, {
                placeHolder: "使用するモデルを選択してください (Escでキャンセル)"
            });

            if (!selectedModel) return;

            let internalModelId: string | undefined = undefined;
            if (selectedModel && selectedModel !== "自動選択 (デフォルト)") {
                internalModelId = mapToInternalModelId(selectedModel);
            }

            await withDispatchLock(async () => {
                // === SQLite DB Direct Model Patch ===
                let originalModelId: string | undefined;
                const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

                const DB_PROPAGATION_MS = 1000;
                const CHAT_PANEL_OPEN_MS = 800;
                const PROMPT_SEND_MS = 500;
                const MODEL_RESTORE_WAIT_MS = 4000;

                let sendSucceeded = false;
                try {
                    if (internalModelId) {
                        if (!sqliteAvailable) {
                            logger.appendLine(`[MCP Hack] Aborting DB patch: sqlite3 not available.`);
                            throw new Error("sqlite3 CLI is required for model selection.");
                        }
                        originalModelId = readModelFromDb();
                        if (!originalModelId) {
                            logger.appendLine(`[MCP Hack] Aborting DB patch: failed to read current model from DB.`);
                            throw new Error("Failed to backup current model from DB.");
                        }
                        writeModelToDb(internalModelId);
                        logger.appendLine(`[MCP Hack] DB patched: ${originalModelId} → ${internalModelId}`);
                        // DBがファイルシステム上で反映され、IDEがリロードする時間を待つ
                        await sleep(DB_PROPAGATION_MS);
                    }

                    const finalPrompt = prompt;

                    // 1. チャットパネルを開く
                    logger.appendLine(`[MCP Bridge] Opening chat view...`);
                    try {
                        await vscode.commands.executeCommand("antigravity.prioritized.chat.open");
                        await sleep(CHAT_PANEL_OPEN_MS);
                    } catch (e) {
                        logger.appendLine(`[MCP Bridge] Failed to open prioritized chat panel: ${e}`);
                    }

                    // 2. sendPromptToAgentPanel が実際の送信コマンド
                    // ※ sendTextToChat は入力欄にセットするだけで送信しない
                    // ※ sendPromptToAgentPanel(文字列) が ChantPanel に直接送信する
                    logger.appendLine(`[MCP Bridge] Sending prompt via sendPromptToAgentPanel...`);
                    await vscode.commands.executeCommand("antigravity.sendPromptToAgentPanel", finalPrompt);
                    await sleep(PROMPT_SEND_MS);

                    // sendPromptToAgentPanel は内部で sendMessageToChatPanel を呼び直接送信するので
                    // executeCascadeAction は不要

                    // リクエストが飛ぶまで待機してからモデルを元に戻す
                    if (internalModelId) {
                        await sleep(MODEL_RESTORE_WAIT_MS);
                    }

                    sendSucceeded = true;
                } catch (err: unknown) {
                    let msg = String(err);
                    if (err instanceof Error) {
                        msg = err.message;
                    } else if (typeof err === "string") {
                        msg = err;
                    }
                    vscode.window.showErrorMessage(`プロンプト送信に失敗しました: ${msg}`);
                } finally {
                    let restoreSucceeded = true;
                    // === Restore Original Model ===
                    if (internalModelId && originalModelId) {
                        try {
                            writeModelToDb(originalModelId);
                            logger.appendLine(`[MCP Hack] DB restored: ${internalModelId} → ${originalModelId}`);
                        } catch (e) {
                            restoreSucceeded = false;
                            logger.appendLine(`[MCP Hack] DB restore failed: ${e}`);
                            if (sendSucceeded) {
                                vscode.window.showErrorMessage(`モデルの復元に失敗しました: ${e}`);
                            }
                        }
                    }

                    if (sendSucceeded && restoreSucceeded) {
                        vscode.window.showInformationMessage(`プロンプト送信完了${internalModelId ? ` (モデル: ${internalModelId})` : ""}`);
                    }
                }
            });
        })
    );
}

export function deactivate(): void {
    wsServer?.stop();
    wsServer = undefined;
}

function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
}
