import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { BridgeResponse } from "@antigravity-mcp-bridge/shared";
import { isErrorResponse } from "@antigravity-mcp-bridge/shared";
import type { WsClient } from "./ws-client.js";

/**
 * MCP サーバーを作成し、3つのツール（list_files, read_file, write_file）を登録する。
 * 各ツールは WebSocket 経由で Extension にリクエストを転送する。
 */
export function createMcpServer(wsClient: WsClient): McpServer {
    const server = new McpServer({
        name: "antigravity-mcp-bridge",
        version: "1.3.0",
    });

    // -------------------------------------------------------
    // Tool: list_files
    // -------------------------------------------------------
    server.tool(
        "list_files",
        "プロジェクト内のファイル構造を取得する。",
        {
            recursive: z.boolean().default(true).describe("再帰的にファイルを一覧するか"),
        },
        async ({ recursive }) => {
            const response = await wsClient.sendRequest("fs/list", { recursive });

            if (isErrorResponse(response)) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Error: ${response.error.message}`,
                        },
                    ],
                    isError: true,
                };
            }

            const result = response.result as { files: string[] };
            return {
                content: [
                    {
                        type: "text" as const,
                        text: result.files.join("\n"),
                    },
                ],
            };
        }
    );

    // -------------------------------------------------------
    // Tool: read_file
    // -------------------------------------------------------
    server.tool(
        "read_file",
        "指定したパスのファイル内容を読み込む。",
        {
            path: z.string().describe("ファイルの相対パス"),
        },
        async ({ path }) => {
            const response = await wsClient.sendRequest("fs/read", { path });

            if (isErrorResponse(response)) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Error: ${response.error.message}`,
                        },
                    ],
                    isError: true,
                };
            }

            const result = response.result as { content: string };
            return {
                content: [
                    {
                        type: "text" as const,
                        text: result.content,
                    },
                ],
            };
        }
    );

    // -------------------------------------------------------
    // Tool: write_file
    // -------------------------------------------------------
    server.tool(
        "write_file",
        "指定したパスにファイルを保存する（上書き/新規作成）。",
        {
            path: z.string().describe("ファイルの相対パス"),
            content: z.string().describe("ファイルの内容"),
        },
        async ({ path, content }) => {
            const response = await wsClient.sendRequest("fs/write", {
                path,
                content,
            });

            if (isErrorResponse(response)) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Error: ${response.error.message}`,
                        },
                    ],
                    isError: true,
                };
            }

            const result = response.result as { success: boolean; message: string };
            return {
                content: [
                    {
                        type: "text" as const,
                        text: result.message,
                    },
                ],
            };
        }
    );

    // -------------------------------------------------------
    // Tool: dispatch_agent_task
    // -------------------------------------------------------
    server.tool(
        "dispatch_agent_task",
        "Antigravityのエージェント(Gemini 3 Pro)にタスクを委譲する。" +
        "レスポンスは返らないため、結果はファイル変更で確認すること。" +
        "完了確認用のシグナルファイル(例: DONE.md)をプロンプトに含めることを推奨。",
        {
            prompt: z.string().describe("エージェントに送信するプロンプト"),
        },
        async ({ prompt }) => {
            const response = await wsClient.sendRequest("agent/dispatch", { prompt });

            if (isErrorResponse(response)) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Error: ${response.error.message}`,
                        },
                    ],
                    isError: true,
                };
            }

            const result = response.result as { success: boolean };
            if (!result.success) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "Error: Failed to dispatch task to Antigravity agent.",
                        },
                    ],
                    isError: true,
                };
            }

            return {
                content: [
                    {
                        type: "text" as const,
                        text: "タスクをAntigravityエージェントに送信しました。結果はファイルの変更で確認してください。",
                    },
                ],
            };
        }
    );

    // -------------------------------------------------------
    // Tool: get_bridge_logs
    // -------------------------------------------------------
    server.tool(
        "get_bridge_logs",
        "Antigravity MCP Bridge の拡張機能側のログを取得し、エージェントの実行状況やエラーを自己診断する。",
        {
            lines: z.number().optional().describe("取得する直近のログ行数（デフォルト100）"),
        },
        async ({ lines }) => {
            const response = await wsClient.sendRequest(BRIDGE_METHODS.GET_LOGS, { lines });

            if (isErrorResponse(response)) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Error: ${response.error.message}`,
                        },
                    ],
                    isError: true,
                };
            }

            const result = response.result as { logs: string[] };
            return {
                content: [
                    {
                        type: "text" as const,
                        text: result.logs.join("\n"),
                    },
                ],
            };
        }
    );

    return server;
}

import type { WorkspaceEventParams } from "@antigravity-mcp-bridge/shared";
import { BRIDGE_METHODS } from "@antigravity-mcp-bridge/shared";

/**
 * MCP サーバーを Stdio トランスポートで起動する。
 */
export async function startMcpServer(wsClient: WsClient): Promise<void> {
    const server = createMcpServer(wsClient);

    wsClient.on(BRIDGE_METHODS.WORKSPACE_EVENT, (params: WorkspaceEventParams) => {
        server.server.sendLoggingMessage({
            level: "info",
            data: `[Workspace Event] ${params.type}: ${params.path}`,
        }).catch((err: unknown) => {
            console.error("[Bridge CLI] Failed to send logging message:", err);
        });
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[Bridge CLI] MCP server started (stdio transport)");
}
