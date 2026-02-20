import * as vscode from "vscode";

export class RingBufferLogger {
    private buffer: string[] = [];
    private maxLines: number;
    private channel: vscode.OutputChannel;

    constructor(channel: vscode.OutputChannel, maxLines: number = 500) {
        this.channel = channel;
        this.maxLines = maxLines;
    }

    appendLine(value: string) {
        this.channel.appendLine(value);
        this.buffer.push(value);
        if (this.buffer.length > this.maxLines) {
            this.buffer.shift();
        }
    }

    getLogs(lines?: number): string[] {
        if (lines === undefined || lines >= this.buffer.length) {
            return [...this.buffer];
        }
        return this.buffer.slice(this.buffer.length - lines);
    }

    show(preserveFocus?: boolean) {
        this.channel.show(preserveFocus);
    }
}
