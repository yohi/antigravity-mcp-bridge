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
        version: "1.0.0",
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

    return server;
}

/**
 * MCP サーバーを Stdio トランスポートで起動する。
 */
export async function startMcpServer(wsClient: WsClient): Promise<void> {
    const server = createMcpServer(wsClient);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[Bridge CLI] MCP server started (stdio transport)");
}
