# Antigravity MCP Bridge: Investigation Handover (v1.3 Synchronous Response)

**Status**: Experimental / Research Phase Complete
**Current Goal**: Realize synchronous LLM response retrieval from Antigravity IDE (Gemini 3 Pro) via MCP.

---

## 1. Executive Summary

Initially, the "Synchronous LLM Response" was thought impossible due to the `undefined` return values of all public Antigravity commands. However, reverse engineering has revealed a "side-channel" via internal storage and trace APIs that makes this achievable.

## 2. Key Discoveries

### A. The "Silent" API Problem

- `antigravity.sendPromptToAgentPanel` and other core commands return `undefined` (Fire-and-Forget).
- `antigravity.getDiagnostics` (58KB JSON) contains system info but lacks active `cascade_id` or conversation history.

### B. The Internal Data Source (The Breakthrough)

- **Global Storage**: `~/.config/Antigravity/User/globalStorage/state.vscdb` (SQLite).
- **Key Data**: `antigravityUnifiedStateSync.trajectorySummaries`.
- **Format**: Base64 encoded Protocol Buffers containing the full history of "Trajectories" (conversations/tasks) and their results.
- **Why this matters**: We can identify the new `cascade_id` by monitoring this DB's updates immediately after sending a prompt.

### C. Internal Extension Logic

- **Path**: `/usr/share/antigravity/resources/app/extensions/antigravity/dist/extension.js`.
- **Internal RPC**: The extension uses Protobuf (`exa.language_server_pb`) to talk to the backend.
- **Trajectory Fetching**: The command `GetCascadeTrajectoryRequest` exists internally and is used to fetch the LLM results for a specific ID.

## 3. Updated Implementation Strategy (v1.3.1)

1. **Prompt Dispatch**: Call `antigravity.sendPromptToAgentPanel` with the user prompt.
2. **ID Capture**: Monitor `state.vscdb` or internal trace commands (`getManagerTrace`, `getWorkbenchTrace`) to capture the newly generated `cascade_id`.
3. **Wait & Poll**: Poll for the completion of the cascade in the background.
4. **Extraction**: Once completed, extract the text response from the DB or via internal trajectory fetch logic.

## 4. Current Progress & Ready-to-Test Assets

- **Spec v1-3.md**: Updated to reflect the "Internal Monitor" approach.
- **Diagnostic Commands**: Added to the extension (run `npm run build` & Reload):
  - `Antigravity MCP Bridge: Test Internal APIs`: Probes `getManagerTrace`, `pollMcpServerStates`, etc.
  - `Antigravity MCP Bridge: Test Storage Content`: Verifies access to the `state.vscdb` file.
  - `Antigravity MCP Bridge: Test Storage Paths`: Identifies the current workspace's storage ID.

## 5. Completed Tasks / Findings

1. **Verify Internal Trace Returns**:
   - `getManagerTrace` and `getWorkbenchTrace` returned `undefined`. `getCascadeTrajectoryRequest` command is not exported.
   - Therefore, DB polling is the *only* reliable way to capture the newly generated `cascade_id` immediately after prompt dispatch.
2. **DB Polling Implementation**:
   - Implemented `child_process.execFile` with `sqlite3` to periodically query `state.vscdb` for `antigravityUnifiedStateSync.trajectorySummaries`.
   - The query runs efficiently and grabs the new baseline `cascade_id` before the LLM finishes.
3. **Protobuf Decoding**:
   - Investigated the Protobuf/Base64 payload in `trajectorySummaries`. Found that it only contains metadata (like the prompt/title), NOT the full LLM text response.
   - Discovered that UUIDs (`cascade_id`) are stored as plain ascii characters inside the Protobuf binary structure.
   - Refined the decoder to simply decode Base64 to binary ascii and run a UUID regex. This perfectly and reliably extracts the `cascade_id` without heavy Protobuf libraries.
4. **Text Extraction**:
   - Once the new `cascade_id` is captured via DB polling, the tracker falls back to polling `getDiagnostics` JSON to extract the actual text stream as the LLM writes it out, bypassing the limitation of DB summaries.

## 6. Detailed Testing Logs & Architecture Discoveries (2026-02-20)

### 6.1. The "Say hello" Experiment

Through repeated iterations using the `Antigravity MCP Bridge: Test llm/ask Flow` command, we gathered the following critical terminal output and behavior:

#### Experiment 1: Payload Encoding vs. Plain String

- **Action**: Sent `PayloadEncoder.buildAgentRequest("Say hello")` to `antigravity.sendPromptToAgentPanel`.
- **Result**: The agent panel received `[object Object]` and the LLM replied: *"It looks like your message didn't come through properly (I only received an empty object)."*
- **Discovery**: VS Code implicitly stringifies object payloads passed to `executeCommand` depending on the recipient command's definition. The target command was expecting a plain string.

#### Experiment 2: Plain String & Chat Execution

- **Action**: Sent `"Say hello"` using `antigravity.sendTextToChat` (and later tested `sendPromptToAgentPanel` with a plain string).
- **Result**: The string successfully populated the agent's chat panel, and the LLM natively responded with: *"Hello! How can I help you today?"*
- **Crucial Problem**: The `TrajectoryTracker` timed out (60,000ms) waiting for a new `cascade_id` in the database.

### 6.2. Chat vs. Cascade Architecture Uncovered

Why did the tracker time out even though the LLM answered successfully?

1. **The Separation of State**:
   - The heavily scrutinized SQLite table `antigravityUnifiedStateSync.trajectorySummaries` (in `globalStorage/state.vscdb`) is exclusively reserved for **"Cascade"** events.
   - Cascades are autonomous, multi-step actions where the agent is explicitly tasked to edit files (e.g., generating code, refactoring).
   - Simple prompts sent via chat panels constitute a **"Chat"** event, which are historically stored separately and do not register a new `cascade_id` in the trajectory DB.
2. **The "command not found" Wall**:
   - We attempted to forcefully initiate a Cascade to trigger the database using commands like `antigravity.cascadeStarterPrompt` and `antigravity.executeCascadeAction`.
   - **Result**: `Error: command 'antigravity.cascadeStarterPrompt' not found`. These powerful internal RPC actions are strictly localized or completely untrustworthy for external invocation within the current extension manifest.

### 6.3. The vscode.lm Pivot Attempt

- **Action**: Investigated if Antigravity provided a native VS Code Language Model API implementation by checking `vscode.lm.selectChatModels()`.
- **Result**: `Found 0 chat models via vscode.lm`. Antigravity's Gemini models are tightly coupled to their proprietary UI/RPC layers and are not registered as standard VS Code LM providers.

## 7. Next Steps for v1.3.2 (The Final Pivot)

To achieve synchronous extraction of the LLM text, we must pivot our monitoring strategy based on the recent "Chat" discovery:

### Strategy A: Monitor Chat Database (Recommended)

Since `antigravity.sendTextToChat` works flawlessly to trigger a response:

1. Identify exactly where "Chat" history is persisted. (e.g., `chat.ChatSessionStore.index` in `workspaceStorage`, or a specific memento object).
2. Repurpose `TrajectoryTracker` to monitor this **Chat DB** instead of the Cascade DB.
3. Extract the diff/append text directly from the Chat DB JSON.

### Strategy B: Discover the True Cascade Trigger

1. Reverse engineer exactly which frontend command triggers a true Cascade action.
2. E.g., commands like `antigravity.executeCascadeAction` or testing through UI simulation (such as sending a `BridgeRequest` Payload).

## 8. Important Paths

| Resource | Path |
| :--- | :--- |
| Antigravity Binary | `/usr/share/antigravity/antigravity` |
| Internal Ext Source | `/usr/share/antigravity/resources/app/extensions/antigravity/dist/extension.js` |
| User Data | `~/.config/Antigravity/User/` |
| Global Storage DB | `~/.config/Antigravity/User/globalStorage/state.vscdb` |
| Workspace State | `~/.config/Antigravity/User/workspaceStorage/<WORKSPACE_ID>/state.vscdb` |

---
**Maintained by**: Antigravity (AI Agent)
**Project Root**: `/home/y_ohi/program/antigravity-mcp-bridge`
