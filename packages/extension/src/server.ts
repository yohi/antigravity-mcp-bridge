import * as http from "node:http";
import * as vscode from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import type {
    BridgeRequest,
    BridgeResponse,
    BridgeMethod,
} from "./shared/types";
import { handleMessage } from "./handlers";

export interface ServerConfig {
    port: number;
    token: string;
    readOnly: boolean;
    maxFileSize: number;
    outputChannel: vscode.OutputChannel;
}

export class BridgeWebSocketServer {
    private wss: WebSocketServer | undefined;
    private config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
    }

    start(): void {
        this.wss = new WebSocketServer({
            port: this.config.port,
            host: "127.0.0.1",
            verifyClient: (
                info: { req: http.IncomingMessage },
                callback: (res: boolean, code?: number, message?: string) => void
            ) => {
                const authHeader = info.req.headers["authorization"];
                if (!authHeader || authHeader !== `Bearer ${this.config.token}`) {
                    this.config.outputChannel.appendLine(
                        "[MCP Bridge] Connection rejected: invalid token"
                    );
                    callback(false, 401, "Unauthorized");
                    return;
                }
                callback(true);
            },
        });

        this.wss.on("connection", (ws: WebSocket) => {
            this.config.outputChannel.appendLine(
                "[MCP Bridge] Client connected"
            );

            ws.on("message", async (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString()) as BridgeRequest;
                    this.config.outputChannel.appendLine(
                        `[MCP Bridge] Received: ${message.method} (id: ${message.id})`
                    );

                    const response = await handleMessage(message, this.config);
                    ws.send(JSON.stringify(response));
                } catch (err: unknown) {
                    const errorMessage =
                        err instanceof Error ? err.message : String(err);
                    this.config.outputChannel.appendLine(
                        `[MCP Bridge] Error processing message: ${errorMessage}`
                    );
                    const errorResponse: BridgeResponse = {
                        jsonrpc: "2.0",
                        id: 0,
                        error: {
                            code: -32700,
                            message: `Parse error: ${errorMessage}`,
                        },
                    };
                    ws.send(JSON.stringify(errorResponse));
                }
            });

            ws.on("close", () => {
                this.config.outputChannel.appendLine(
                    "[MCP Bridge] Client disconnected"
                );
            });

            ws.on("error", (err: Error) => {
                this.config.outputChannel.appendLine(
                    `[MCP Bridge] WebSocket error: ${err.message}`
                );
            });
        });

        this.wss.on("error", (err: Error) => {
            this.config.outputChannel.appendLine(
                `[MCP Bridge] Server error: ${err.message}`
            );
            vscode.window.showErrorMessage(
                `Antigravity MCP Bridge: Server error - ${err.message}`
            );
        });
    }

    stop(): void {
        if (this.wss) {
            this.wss.close();
            this.config.outputChannel.appendLine(
                "[MCP Bridge] WebSocket server stopped"
            );
            this.wss = undefined;
        }
    }
}
