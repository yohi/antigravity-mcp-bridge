The dispatch code `packages/extension/src/handlers.ts` successfully implements sending text prompts and model payload.

The user should now:
1. Reload the window using "Developer: Reload Window".
2. Execute a dispatch prompt.
   - Example command: `antigravity-mcp-bridge: Post prompt`
   - Example prompt text: "Hello, could you explain this file?"
   - Example selection: "gemini-3-pro" (this triggers the DB patch mechanism)

Alternatively, use the CLI:
`ANTIGRAVITY_TOKEN=... ./test-dispatch.sh "Your prompt here" "gemini-3-pro"`
