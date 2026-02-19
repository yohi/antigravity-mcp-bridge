import WebSocket from "ws";
import type {
    BridgeRequest,
    BridgeResponse,
    BridgeMethod,
} from "@antigravity-mcp-bridge/shared";

/**
 * WebSocket クライアント。
 * Extension（WebSocket サーバー）への接続と JSON-RPC リクエスト/レスポンスの
 * 対応付けを管理する。
 */
export class WsClient {
    private ws: WebSocket | undefined;
    private pendingRequests = new Map<
        number,
        {
            resolve: (value: BridgeResponse) => void;
            reject: (reason: Error) => void;
        }
    >();
    private nextId = 1;
    private url: string;
    private token: string;

    constructor(url: string, token: string) {
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
                console.error("[Bridge CLI] Connected to Extension");
                resolve();
            });

            this.ws.on("message", (data: WebSocket.RawData) => {
                try {
                    const response = JSON.parse(data.toString()) as BridgeResponse;
                    const pending = this.pendingRequests.get(response.id);
                    if (pending) {
                        this.pendingRequests.delete(response.id);
                        pending.resolve(response);
                    }
                } catch (err: unknown) {
                    const errorMessage =
                        err instanceof Error ? err.message : String(err);
                    console.error(
                        `[Bridge CLI] Failed to parse response: ${errorMessage}`
                    );
                }
            });

            this.ws.on("close", (code: number, reason: Buffer) => {
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
                reject(err);
            });
        });
    }

    /**
     * JSON-RPC リクエストを送信し、対応するレスポンスを待つ。
     */
    async sendRequest(
        method: BridgeMethod,
        params?: Record<string, unknown>
    ): Promise<BridgeResponse> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not connected");
        }

        const id = this.nextId++;
        const request: BridgeRequest = {
            jsonrpc: "2.0",
            id,
            method: method,
            params,
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timed out: ${method} (id: ${id})`));
            }, 30000); // 30秒タイムアウト

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
        }
    }
}
