import { WsClient } from "./ws-client.js";
import { BRIDGE_METHODS } from "@antigravity-mcp-bridge/shared";
import { formatUnknownError } from "@antigravity-mcp-bridge/shared";

async function main(): Promise<void> {
    const host = process.env.ANTIGRAVITY_HOST ?? "127.0.0.1";
    const port = parseInt(process.env.ANTIGRAVITY_PORT ?? "8888", 10);
    const token = process.env.ANTIGRAVITY_TOKEN;

    if (!token) {
        console.error(
            "Error: ANTIGRAVITY_TOKEN environment variable is required."
        );
        process.exit(1);
    }

    const url = `ws://${host}:${port}`;
    console.log(`[Test] Connecting to ${url}...`);

    const wsClient = new WsClient(url, token);

    try {
        await wsClient.connect();
    } catch (err: unknown) {
        console.error(`[Test] Failed to connect: ${formatUnknownError(err)}`);
        process.exit(1);
    }

    const prompt = process.argv[2] ?? "Test prompt from CLI";
    const model = process.argv[3]; // optional

    console.log(`[Test] Sending dispatch request...`);
    console.log(`  Prompt: ${prompt}`);
    if (model) {
        console.log(`  Model: ${model}`);
    }

    try {
        const response = await wsClient.sendRequest(BRIDGE_METHODS.AGENT_DISPATCH, {
            prompt,
            model,
        });
        console.log("[Test] Response received:");
        console.log(JSON.stringify(response, null, 2));
    } catch (err: unknown) {
        console.error(`[Test] Request failed: ${formatUnknownError(err)}`);
    }

    wsClient.close();
    process.exit(0);
}

main().catch((err: unknown) => {
    console.error(`[Test] Fatal error: ${formatUnknownError(err)}`);
    process.exit(1);
});
