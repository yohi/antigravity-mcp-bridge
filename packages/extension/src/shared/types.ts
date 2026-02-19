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
    id: number;
    method: BridgeMethod;
    params?: Record<string, unknown>;
}

export interface BridgeResponseSuccess {
    jsonrpc: "2.0";
    id: number;
    result: unknown;
}

export interface BridgeResponseError {
    jsonrpc: "2.0";
    id: number;
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
}

// ============================================================
// Helpers
// ============================================================

export function isBridgeResponse(data: unknown): data is BridgeResponse {
    if (typeof data !== "object" || data === null) return false;
    const obj = data as Record<string, unknown>;
    return obj.jsonrpc === "2.0" && typeof obj.id === "number";
}

export function isErrorResponse(
    response: BridgeResponse
): response is BridgeResponseError {
    return "error" in response;
}
