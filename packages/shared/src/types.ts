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
    AGENT_LIST_MODELS: "agent/models/list",
    WORKSPACE_EVENT: "workspace/event",
    GET_LOGS: "bridge/logs",
    IDE_DIAGNOSTICS: "ide/diagnostics",
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
    /** User Rejected the Action */
    USER_REJECTED: -32006,
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
    model?: string;
}

export interface AgentDispatchResult {
    success: boolean;
    message?: string;
}

export const AG_MODELS = [
    "gemini-3.1-pro-high",
    "gemini-3.1-pro",
    "gemini-3.1-flash",
    "gemini-3-pro",
    "gemini-3-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
] as const;

export type AgModel = (typeof AG_MODELS)[number];

export interface AgentListModelsResult {
    models: AgModel[];
}

export interface WorkspaceEventParams {
    type: "file_created" | "file_changed" | "file_deleted";
    path: string;
}

export interface BridgeGetLogsParams {
    lines?: number;
}

export interface BridgeGetLogsResult {
    logs: string[];
}

export interface BridgeNotification {
    jsonrpc: "2.0";
    id?: null | undefined;
    method: BridgeMethod;
    params?: Record<string, unknown>;
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

export function isBridgeNotification(data: unknown): data is BridgeNotification {
    if (typeof data !== "object" || data === null) return false;
    const obj = data as Record<string, unknown>;
    return (
        obj.jsonrpc === "2.0" &&
        (!("id" in obj) || obj.id === null || obj.id === undefined) &&
        typeof obj.method === "string" &&
        !("result" in obj) &&
        !("error" in obj)
    );
}

export function isErrorResponse(
    response: BridgeResponse
): response is BridgeResponseError {
    return "error" in response;
}
