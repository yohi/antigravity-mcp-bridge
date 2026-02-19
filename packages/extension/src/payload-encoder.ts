export class PayloadEncoder {
    static encodePrompt(prompt: string): string {
        return Buffer.from(prompt, "utf-8").toString("base64");
    }

    static buildAgentRequest(prompt: string): Record<string, unknown> {
        return {
            prompt,
            promptBase64: PayloadEncoder.encodePrompt(prompt),
            encoding: "base64",
        };
    }
}
