#!/usr/bin/env node

/**
 * Antigravity MCP Bridge CLI
 *
 * WebSocket で Antigravity IDE Extension に接続し、
 * MCP サーバー（Stdio トランスポート）として Claude Desktop 等の
 * MCP クライアントにツールを公開する。
 *
 * 環境変数:
 *   ANTIGRAVITY_PORT  - WebSocket サーバーのポート番号 (default: 8888)
 *   ANTIGRAVITY_TOKEN - 認証トークン (必須)
 *   ANTIGRAVITY_HOST  - WebSocket サーバーのホスト (default: 127.0.0.1)
 */

import { WsClient } from "./ws-client.js";
import { startMcpServer } from "./mcp-server.js";
import { formatUnknownError } from "./error-format.js";

async function main(): Promise<void> {
    const host = process.env.ANTIGRAVITY_HOST ?? "127.0.0.1";
    const port = parseInt(process.env.ANTIGRAVITY_PORT ?? "8888", 10);
    const token = process.env.ANTIGRAVITY_TOKEN;

    if (!token) {
        console.error(
            "Error: ANTIGRAVITY_TOKEN environment variable is required."
        );
        console.error(
            "Set it to the token shown in the Antigravity IDE Output panel."
        );
        process.exit(1);
    }

    const url = `ws://${host}:${port}`;
    console.error(`[Bridge CLI] Connecting to ${url}...`);

    const wsClient = new WsClient(url, token);

    try {
        await wsClient.connect();
    } catch (err: unknown) {
        const errorMessage = formatUnknownError(err);
        console.error(
            `[Bridge CLI] Failed to connect to Extension: ${errorMessage}`
        );
        console.error(
            "Make sure the Antigravity IDE is running with the MCP Bridge extension active."
        );
        process.exit(1);
    }

    // MCP サーバーを Stdio トランスポートで起動
    await startMcpServer(wsClient);

    // プロセス終了時のクリーンアップ
    process.on("SIGINT", () => {
        console.error("[Bridge CLI] Shutting down...");
        wsClient.close();
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        console.error("[Bridge CLI] Shutting down...");
        wsClient.close();
        process.exit(0);
    });
}

main().catch((err: unknown) => {
    const errorMessage = formatUnknownError(err);
    console.error(`[Bridge CLI] Fatal error: ${errorMessage}`);
    process.exit(1);
});
