import * as vscode from "vscode";
import * as path from "path";
import type {
    BridgeRequest,
    BridgeResponse,
    FsListParams,
    FsListResult,
    FsReadParams,
    FsReadResult,
    FsWriteParams,
    FsWriteResult,
} from "@antigravity-mcp-bridge/shared";
import { BRIDGE_METHODS, ERROR_CODES } from "@antigravity-mcp-bridge/shared";
import type { ServerConfig } from "./server";

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

            default:
                return error(id, -32601, `Method not found: ${method}`);
        }
    } catch (err: unknown) {
        if (err instanceof BridgeError) {
            return error(id, err.code, err.message);
        }
        const errorMessage = err instanceof Error ? err.message : String(err);
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

    // VS Code の findFiles は .gitignore を尊重する
    const files = await vscode.workspace.findFiles(
        "**/*",
        "**/node_modules/**"
    );

    const rootUri = workspaceFolders[0].uri;
    const recursive = params?.recursive ?? true;

    const relativePaths = files
        .map((f) => {
            const relative = f.path.substring(rootUri.path.length + 1);
            return relative;
        })
        .filter((p) => recursive || !p.includes("/"))
        .sort();

    return { files: relativePaths };
}

// ============================================================
// fs/read
// ============================================================

async function handleFsRead(
    params: FsReadParams,
    config: ServerConfig
): Promise<FsReadResult> {
    if (!params?.path) {
        throw createBridgeError(ERROR_CODES.FILE_NOT_FOUND, "Path is required");
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
            -32602, // INVALID_PARAMS
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
        throw new Error("Path must be relative");
    }
    if (normalized.split(path.sep).includes("..")) {
        throw new Error("Directory traversal detected");
    }

    // 3. Resolve absolute path
    const absPath = path.join(rootPath, normalized);

    // 4. Verify containment
    if (!absPath.startsWith(rootPath)) {
        throw new Error("Access denied: Path is outside workspace");
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
