/**
 * Antigravity MCP Bridge - Shared Types
 *
 * WebSocket (Bridge Protocol) の JSON-RPC メッセージ型定義と
 * 共通定数を提供する。
 */

import {
    BRIDGE_METHODS,
    BridgeMethod,
    AgentDispatchParams,
    AgentDispatchResult,
    BridgeRequest,
    BridgeResponseSuccess,
    BridgeResponseError,
    BridgeResponse,
    isBridgeResponse,
    isErrorResponse,
} from "@antigravity-mcp-bridge/shared";

export {
    BRIDGE_METHODS,
    BridgeMethod,
    AgentDispatchParams,
    AgentDispatchResult,
    BridgeRequest,
    BridgeResponseSuccess,
    BridgeResponseError,
    BridgeResponse,
    isBridgeResponse,
    isErrorResponse,
};

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
    AGENT_DISPATCH_FAILED: -32006,
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

// ============================================================
// Helpers
// ============================================================
