import WebSocket from "ws";
import { EventEmitter } from "events";
import type {
    BridgeRequest,
    BridgeResponse,
    BridgeMethod,
} from "@antigravity-mcp-bridge/shared";
import { isBridgeResponse, BRIDGE_METHODS } from "@antigravity-mcp-bridge/shared";
import { formatUnknownError } from "@antigravity-mcp-bridge/shared";

type BridgeDispatchMethod = BridgeMethod | typeof BRIDGE_METHODS.AGENT_DISPATCH;
type BridgeRequestWithDispatch = Omit<BridgeRequest, "method"> & {
    method: BridgeDispatchMethod;
};

/**
 * WebSocket クライアント。
 * Extension（WebSocket サーバー）への接続と JSON-RPC リクエスト/レスポンスの
 * 対応付けを管理する。
 */
export class WsClient extends EventEmitter {
    private ws: WebSocket | undefined;
    private pendingRequests = new Map<
        number | string | null,
        {
            resolve: (value: BridgeResponse) => void;
            reject: (reason: Error) => void;
        }
    >();
    private nextId = 1;
    private url: string;
    private token: string;
    private isOpen = false;

    constructor(url: string, token: string) {
        super();
        this.url = url;
        this.token = token;
    }

    /**
     * WebSocket 接続を確立する。
     * 接続が確立されるまで Promise が解決されない。
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            this.ws.on("open", () => {
                this.isOpen = true;
                console.error("[Bridge CLI] Connected to Extension");
                resolve();
            });

            this.ws.on("message", (data: WebSocket.RawData) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    if (!isBridgeResponse(parsed)) {
                        console.error(
                            `[Bridge CLI] Invalid response format: must be a valid JSON-RPC 2.0 response`
                        );
                        return;
                    }
                    const response = parsed;
                    const pending = this.pendingRequests.get(response.id);
                    if (pending) {
                        this.pendingRequests.delete(response.id);
                        pending.resolve(response);
                    }
                } catch (err: unknown) {
                    const errorMessage = formatUnknownError(err);
                    console.error(
                        `[Bridge CLI] Failed to parse response: ${errorMessage}`
                    );
                }
            });

            this.ws.on("close", (code: number, reason: Buffer) => {
                this.isOpen = false;
                console.error(
                    `[Bridge CLI] Connection closed: ${code} ${reason.toString()}`
                );
                // 全ての pending リクエストをリジェクト
                for (const [id, pending] of this.pendingRequests) {
                    pending.reject(new Error("WebSocket connection closed"));
                    this.pendingRequests.delete(id);
                }
            });

            this.ws.on("error", (err: Error) => {
                console.error(`[Bridge CLI] WebSocket error: ${err.message}`);
                // 全ての pending リクエストをリジェクト
                for (const [id, pending] of this.pendingRequests) {
                    pending.reject(err);
                    this.pendingRequests.delete(id);
                }

                if (!this.isOpen) {
                    reject(err);
                } else {
                    this.emit("error", err);
                }
            });
        });
    }

    /**
     * JSON-RPC リクエストを送信し、対応するレスポンスを待つ。
     */
    async sendRequest(
        method: BridgeDispatchMethod,
        params?: Record<string, unknown>,
        timeoutMs: number = 30_000
    ): Promise<BridgeResponse> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not connected");
        }

        const id = this.nextId++;
        const request: BridgeRequestWithDispatch = {
            jsonrpc: "2.0",
            id,
            method,
            params,
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timed out: ${method} (id: ${id})`));
            }, timeoutMs);

            this.pendingRequests.set(id, {
                resolve: (response: BridgeResponse) => {
                    clearTimeout(timeout);
                    resolve(response);
                },
                reject: (reason: Error) => {
                    clearTimeout(timeout);
                    reject(reason);
                },
            });

            this.ws!.send(JSON.stringify(request), (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(id);
                    reject(err);
                }
            });
        });
    }

    /**
     * WebSocket 接続を閉じる。
     */
    close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
            this.isOpen = false;
        }
    }
}
