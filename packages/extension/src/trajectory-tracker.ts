import * as vscode from "vscode";

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

type JsonObject = Record<string, unknown>;

export class TrajectoryTracker {
    private outputChannel: vscode.OutputChannel;
    private globalStatePath: string;

    constructor(outputChannel: vscode.OutputChannel, globalStatePath: string) {
        this.outputChannel = outputChannel;
        this.globalStatePath = globalStatePath;
    }

    async getDiagnostics(): Promise<unknown> {
        let raw: unknown;
        try {
            raw = await vscode.commands.executeCommand(
                "antigravity.getDiagnostics"
            );
        } catch (err: unknown) {
            this.outputChannel.appendLine(
                `[MCP Bridge] getDiagnostics failed: ${this.formatError(err)}`
            );
            throw err;
        }

        if (typeof raw === "string") {
            const trimmed = raw.trim();
            if (!trimmed) {
                return {};
            }
            try {
                return JSON.parse(trimmed);
            } catch {
                return raw;
            }
        }

        return raw;
    }

    extractCascadeId(diagnostics: unknown): string | undefined {
        const foundFromObject = this.findCascadeIdsFromObject(diagnostics);
        if (foundFromObject.length > 0) {
            return foundFromObject[foundFromObject.length - 1];
        }

        const serialized = this.safeStringify(diagnostics);
        if (!serialized) {
            return undefined;
        }
        const fromRegex = this.extractCascadeIdsFromText(serialized);
        return fromRegex[fromRegex.length - 1];
    }

    async pollUntilComplete(
        timeoutMs: number = 60_000
    ): Promise<{ cascadeId: string; text: string }> {
        const startedAt = Date.now();
        const baselineCascadeId = await this.getLatestCascadeIdFromDb();

        if (baselineCascadeId) {
            this.outputChannel.appendLine(
                `[MCP Bridge] Baseline cascade_id (DB): ${baselineCascadeId}`
            );
        }

        let currentCascadeId = baselineCascadeId;
        while (currentCascadeId === baselineCascadeId && Date.now() - startedAt < 10000) {
            await this.sleep(500);
            currentCascadeId = await this.getLatestCascadeIdFromDb();
        }

        if (!currentCascadeId || currentCascadeId === baselineCascadeId) {
            this.outputChannel.appendLine("[MCP Bridge] Warning: Could not detect new cascade_id in DB, falling back to diagnostics polling");
            // Fallback logic ...
            while (Date.now() - startedAt < timeoutMs) {
                const diagnostics = await this.getDiagnostics();
                const diagCascadeId = this.extractCascadeId(diagnostics);
                if (diagCascadeId && diagCascadeId !== baselineCascadeId) {
                    const text = await this.fetchTrajectoryText(diagCascadeId, diagnostics);
                    if (text) {
                        return { cascadeId: diagCascadeId, text };
                    }
                }
                await this.sleep(1000);
            }
            throw new Error(`LLM ask timed out after ${timeoutMs}ms`);
        }

        this.outputChannel.appendLine(`[MCP Bridge] Captured new cascade_id: ${currentCascadeId}`);

        while (Date.now() - startedAt < timeoutMs) {
            const diagnostics = await this.getDiagnostics();
            const text = await this.fetchTrajectoryText(currentCascadeId, diagnostics);
            if (text) {
                return { cascadeId: currentCascadeId, text };
            }
            await this.sleep(1000);
        }

        throw new Error(`LLM ask timed out after ${timeoutMs}ms`);
    }

    private async getLatestCascadeIdFromDb(): Promise<string | undefined> {
        try {
            const { stdout } = await execFileAsync("sqlite3", [
                this.globalStatePath,
                "SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.trajectorySummaries';"
            ]);
            const base64Str = stdout.trim();
            if (!base64Str) return undefined;

            // Just extract all UUIDs directly from the raw decoded or encoded string
            // UUID pattern: 8-4-4-4-12 hex chars
            const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

            // Base64 itself might break UUID boundaries. But in Protobuf strings usually UUIDs are stored as raw ascii bytes
            // So decoding base64 to binary ascii string is reliable.
            const decodedBytes = Buffer.from(base64Str, 'base64');
            const asciiStr = decodedBytes.toString('ascii');

            const matches = [...asciiStr.matchAll(uuidRegex)];
            if (matches.length > 0) {
                return matches[matches.length - 1][0];
            }
        } catch (err) {
            this.outputChannel.appendLine(`[MCP Bridge] DB read failed: ${this.formatError(err)}`);
        }
        return undefined;
    }

    async fetchTrajectoryText(
        cascadeId: string,
        diagnostics?: unknown
    ): Promise<string> {
        const source = diagnostics ?? (await this.getDiagnostics());
        const textCandidates: string[] = [];

        this.walk(source, (node) => {
            if (!this.isObject(node)) {
                return;
            }
            const nodeCascadeId = this.readString(
                node.cascade_id,
                node.cascadeId,
                node.id
            );
            if (nodeCascadeId !== cascadeId) {
                return;
            }

            const candidate = this.readString(
                node.text,
                node.response,
                node.content,
                node.message,
                node.output,
                node.result
            );
            if (candidate) {
                textCandidates.push(candidate);
            }
        });

        if (textCandidates.length === 0) {
            const serialized = this.safeStringify(source);
            if (!serialized) {
                return "";
            }

            const escapedCascadeId = this.escapeRegExp(cascadeId);
            const nearbyRegex = new RegExp(
                `${escapedCascadeId}[\\s\\S]{0,600}?"(?:text|response|content|message|output|result)"\\s*:\\s*"([\\s\\S]*?)"`,
                "g"
            );

            const regexCandidates: string[] = [];
            let match: RegExpExecArray | null = null;
            while ((match = nearbyRegex.exec(serialized)) !== null) {
                if (match[1]) {
                    regexCandidates.push(this.unescapeJsonString(match[1]));
                }
            }

            if (regexCandidates.length === 0) {
                return "";
            }
            return this.decodeMaybeBase64(
                regexCandidates[regexCandidates.length - 1]
            ).trim();
        }

        return this.decodeMaybeBase64(
            textCandidates[textCandidates.length - 1]
        ).trim();
    }

    private findCascadeIdsFromObject(input: unknown): string[] {
        const ids: string[] = [];

        this.walk(input, (node) => {
            if (this.isObject(node)) {
                const direct = this.readString(node.cascade_id, node.cascadeId);
                if (direct) {
                    ids.push(direct);
                }
            }
            if (typeof node === "string") {
                ids.push(...this.extractCascadeIdsFromText(node));
            }
        });

        return ids;
    }

    private extractCascadeIdsFromText(text: string): string[] {
        const ids: string[] = [];
        const patterns = [
            /"cascade_id"\s*:\s*"([^"]+)"/g,
            /"cascadeId"\s*:\s*"([^"]+)"/g,
            /\bcascade_id\b\s*[=:]\s*([A-Za-z0-9_-]+)/g,
        ];

        for (const pattern of patterns) {
            let match: RegExpExecArray | null = null;
            while ((match = pattern.exec(text)) !== null) {
                if (match[1]) {
                    ids.push(match[1]);
                }
            }
        }

        return ids;
    }

    private decodeMaybeBase64(input: string): string {
        const normalized = input.trim();
        const base64Like = /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
        const longEnough = normalized.length >= 16;
        const aligned = normalized.length % 4 === 0;

        if (!base64Like || !longEnough || !aligned) {
            return input;
        }

        try {
            const decoded = Buffer.from(normalized, "base64").toString("utf-8");
            if (!decoded || /\uFFFD/.test(decoded)) {
                return input;
            }
            return decoded;
        } catch {
            return input;
        }
    }

    private walk(input: unknown, visit: (node: unknown) => void): void {
        const stack: unknown[] = [input];
        const visited = new WeakSet<object>();

        while (stack.length > 0) {
            const current = stack.pop();
            if (current === undefined) {
                continue;
            }

            visit(current);

            if (Array.isArray(current)) {
                for (let i = current.length - 1; i >= 0; i--) {
                    stack.push(current[i]);
                }
                continue;
            }

            if (this.isObject(current)) {
                if (visited.has(current)) {
                    continue;
                }
                visited.add(current);

                const values = Object.values(current);
                for (let i = values.length - 1; i >= 0; i--) {
                    stack.push(values[i]);
                }
            }
        }
    }

    private safeStringify(input: unknown): string {
        if (typeof input === "string") {
            return input;
        }
        try {
            return JSON.stringify(input);
        } catch {
            return "";
        }
    }

    private readString(...values: unknown[]): string | undefined {
        for (const value of values) {
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (trimmed) {
                    return trimmed;
                }
            }
        }
        return undefined;
    }

    private isObject(value: unknown): value is JsonObject {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    private escapeRegExp(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    private unescapeJsonString(input: string): string {
        try {
            return JSON.parse(`"${input.replace(/"/g, '\\"')}"`) as string;
        } catch {
            return input;
        }
    }

    private formatError(err: unknown): string {
        if (err instanceof Error) {
            return err.message;
        }
        return String(err);
    }
}
