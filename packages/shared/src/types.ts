/**
 * Antigravity MCP Bridge - Shared Types
 *
 * WebSocket (Bridge Protocol) の JSON-RPC メッセージ型定義と
 * 共通定数を提供する。
 */

// ============================================================
// JSON-RPC 2.0 Message Types (Extension <-> CLI)
// ============================================================

export interface BridgeRequest {
    jsonrpc: "2.0";
    id: number | string | null;
    method: BridgeMethod;
    params?: Record<string, unknown>;
}

export interface BridgeResponseSuccess {
    jsonrpc: "2.0";
    id: number | string | null;
    result: unknown;
}

export interface BridgeResponseError {
    jsonrpc: "2.0";
    id: number | string | null;
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
}

export type BridgeResponse = BridgeResponseSuccess | BridgeResponseError;

// ============================================================
// Bridge Methods
// ============================================================

export const BRIDGE_METHODS = {
    FS_LIST: "fs/list",
    FS_READ: "fs/read",
    FS_WRITE: "fs/write",
    AGENT_DISPATCH: "agent/dispatch",
} as const;

export type BridgeMethod = (typeof BRIDGE_METHODS)[keyof typeof BRIDGE_METHODS];

// ============================================================
// Error Codes
// ============================================================

export const ERROR_CODES = {
    /** Token Invalid */
    ACCESS_DENIED: -32001,
    /** File Too Large */
    FILE_TOO_LARGE: -32002,
    /** File Not Found */
    FILE_NOT_FOUND: -32003,
    /** Read-Only Mode Violation */
    READ_ONLY_VIOLATION: -32004,
    /** Path Outside Workspace */
    PATH_OUTSIDE_WORKSPACE: -32005,
    /** Agent Dispatch Failed */
    AGENT_DISPATCH_FAILED: -32007,
    /** Invalid Params */
    INVALID_PARAMS: -32602,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ============================================================
// Params / Results per method
// ============================================================

export interface FsListParams {
    recursive?: boolean;
}

export interface FsListResult {
    files: string[];
}

export interface FsReadParams {
    path: string;
}

export interface FsReadResult {
    content: string;
}

export interface FsWriteParams {
    path: string;
    content: string;
}

export interface FsWriteResult {
    success: boolean;
    message: string;
}

export interface AgentDispatchParams {
    prompt: string;
}

export interface AgentDispatchResult {
    success: boolean;
    message?: string;
}

// ============================================================
// Helpers
// ============================================================

export function isBridgeResponse(data: unknown): data is BridgeResponse {
    if (typeof data !== "object" || data === null) return false;
    const obj = data as Record<string, unknown>;
    // Check standard JSON-RPC 2.0 properties
    if (obj.jsonrpc !== "2.0") return false;

    // Validate ID: string | number | null
    if (
        typeof obj.id !== "string" &&
        typeof obj.id !== "number" &&
        obj.id !== null
    ) {
        return false;
    }

    // result OR error must be present, but not both (though JSON-RPC doesn't strictly forbid both, usually it's one)
    // The user requirement: "require that either obj.result !== undefined or obj.error !== undefined"
    const hasResult = "result" in obj && obj.result !== undefined;
    const hasError = "error" in obj && obj.error !== undefined;

    if (!hasResult && !hasError) return false;

    if (hasError) {
        // Validate error object
        const err = obj.error;
        if (typeof err !== "object" || err === null) return false;
        const errObj = err as Record<string, unknown>;
        return (
            typeof errObj.code === "number" && typeof errObj.message === "string"
        );
    }

    return true;
}

export function isErrorResponse(
    response: BridgeResponse
): response is BridgeResponseError {
    return "error" in response;
}
