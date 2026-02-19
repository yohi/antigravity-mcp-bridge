# Antigravity IDE MCP Bridge Specification (v1.2 Complete Edition)

**Document Status**: Final / Ready for Implementation

**Target Architecture**: Hybrid Agentic Team (Client: Implementer / Server: Commander)

**Base Research**: 2026-02-19 Internal Investigation Report

---

## 1. Project Overview

本仕様書の目的は、Google Antigravity IDEを「MCPサーバー」化し、外部のAIクライアント（OpenCode等）と連携する**分業型AI開発チーム**を構築することである。

Antigravityの「サーバー機能欠如」という課題を、拡張機能とブリッジCLIによる中間層で解決する。特に、Antigravityが標準の `vscode.lm` APIを公開していない技術的制約を踏まえ、**「ファイルシステムを介した協調（Stigmergy）」**と**「一方的なタスク委譲（Fire-and-Forget）」**を核としたアーキテクチャを採用する。

### 1.1 Team Roles & Responsibility

このシステムでは、クライアントとサーバーが明確な役割分担を持つ。

| Role | Agent | Function | Strength |
| :--- | :--- | :--- | :--- |
| **Client Side** (Active) | **OpenCode** (GPT-Codex) | **Implementer (手足)** コードの実装、修正、ファイル操作。 | 高速、低コスト、細かい指示に忠実。 |
| **Server Side** (Passive) | **Antigravity** (Gemini 3 Pro) | **Commander (頭脳)** 設計、計画、UI確認、複雑な推論。 | 深いコンテキスト理解、自律性、マルチモーダル(UI)認識。 |

### 1.2 Scope (v1.2)

* **Capabilities**:
    * **File System Bridge**: 外部からAntigravity内のファイルを読み書き可能にする。
    * **Agent Dispatch**: 外部からAntigravityのエージェントパネルに指示を投入する。
* **Constraints**:
    * **No Direct LLM Response**: AntigravityからのテキストレスポンスはAPI経由では取得しない（成果物ファイルで判断）。
    * **Auth**: 静的トークンによる簡易認証。
    * **Localhost Only**: セキュリティリスク低減のためループバックアドレス限定。

## 2. Tech Stack

### Core Components

| Component | Technology | Description |
| :--- | :--- | :--- |
| **IDE Extension** | **TypeScript** | VS Code Extension API (`vscode.workspace`, `vscode.commands`) を利用。WebSocket Server (Port 8888) をホストする。 |
| **Bridge CLI** | **Node.js** | `@modelcontextprotocol/sdk` を使用。StdioでMCPクライアントと話し、WebSocketでExtensionと話すプロキシ。 |
| **Protocol** | **MCP v1.0** | Model Context Protocol Specification準拠。 |
| **Integration** | **Internal Command** | `antigravity.sendPromptToAgentPanel` コマンドを利用してAgentを駆動する。 |

## 3. Architecture

### 3.1 System Context Diagram

```mermaid
graph LR  
    subgraph "Client Side: OpenCode (Implementer)"  
        L[Lightweight LLM<br>(Router/Bridge)]  
        I[GPT-Codex<br>(Coding Engine)]  
    end

    subgraph "Bridge Layer"  
        B[Bridge CLI<br>(Node.js Process)]  
    end

    subgraph "Server Side: Antigravity IDE (Commander)"  
        ext[Extension<br>(WebSocket Server)]  
          
        subgraph "Brain & UX"  
            C[Antigravity Agent<br>(Gemini 3 Pro)]  
            UI[Agent Panel / Preview]  
        end  
          
        subgraph "Memory"  
            FS[File System<br>(Workspace) ]  
        end  
    end

    %% Data Flow  
    L -- "1. Implementation Task" --> I  
    I -- "2. read/write_file" --> B  
    L -- "3. dispatch_agent_task" --> B  
      
    B -- "WebSocket (JSON-RPC)" --> ext  
      
    ext -- "fs.*" --> FS  
    ext -- "cmd: sendPromptToAgentPanel" --> UI  
      
    UI -- "Autonomous Action" --> C  
    C -- "Edits / Planning" --> FS
```

### 3.2 Workflow Sequence

1. **Direct Implementation (高速ループ)**
    * OpenCodeが `read_file` でコードを読み、`write_file` で修正を行う。Antigravityは単なるエディタとして振る舞う。
2. **Delegation (司令塔への委譲)**
    * OpenCodeが困難なタスク（全体設計、原因不明のバグ）に遭遇。
    * `dispatch_agent_task` をコールし、Antigravityに「調査して修正せよ」と指示。
    * Antigravity Agentが起動し、自律的に思考・修正を行う。
    * OpenCodeはファイルシステムを監視し、`DONE.md` 等の生成を持って完了を知る。

## 4. Features & Requirements

### 4.1 Configuration

VS Code `settings.json` 設定項目:

* `antigravity.mcp.port`: 8888 (Default)
* `antigravity.mcp.token`: (Required) - クライアント接続時の認証用。

### 4.2 Functional Requirements

#### FR-01: List Resources

* **Role**: Implementer (OpenCode) 用
* **Action**: `list_files`
* **Behavior**: `.gitignore` を考慮したファイル一覧取得。

#### FR-02: Read Resource

* **Role**: Implementer (OpenCode) 用
* **Action**: `read_file`
* **Behavior**: ファイル内容の取得。100KB以上のファイルは制限をかける(Configurable)。

#### FR-03: Write Resource

* **Role**: Implementer (OpenCode) 用
* **Action**: `write_file`
* **Behavior**: ファイルの新規作成・上書き。
* **Safety**: 変更通知（Notification）をIDE側に表示する。

#### FR-04: Dispatch Agent Task (Core of v1.2)

* **Role**: Commander (Antigravity) への指示出し用
* **Action**: `dispatch_agent_task`
* **Input**: prompt (String)
* **Internal Logic**:
    * VS Codeコマンド `antigravity.sendPromptToAgentPanel` を実行。
    * 引数: `{ action: "sendMessage", text: prompt }`
    * 戻り値: 即座に Success を返す（非同期実行）。

## 5. API Definition (MCP Mapping)

MCPクライアント（OpenCode）に公開されるツール定義。

| Tool Name | Assigned Role | Description | Arguments |
| :--- | :--- | :--- | :--- |
| read_file | **Implementer** | 指定パスのファイルを読み込む。 | { path: string } |
| write_file | **Implementer** | 指定パスにファイルを書き込む。 | { path: string, content: string } |
| list_files | **Implementer** | プロジェクト構成を把握する。 | { recursive: boolean } |
| dispatch_agent_task | **Commander** | **重要:** Antigravity(頭脳)にタスクを丸投げする。レスポンスは返らないため、結果はファイル変更で確認すること。 | { prompt: string } |

## 6. Implementation Guidelines for AI

この仕様書を基に実装を行うAIへの具体的指示（プロンプトテンプレート）。

### Step 1: Extension Scaffolding

"VS Code拡張機能を作成してください。`ws` パッケージを含め、`activate` 関数でWebSocketサーバー(Port 8888)を起動し、`settings.json` からトークンを読み込んで認証するミドルウェアを実装してください。"

### Step 2: FS Implementation

"WebSocketメッセージ `fs/read`, `fs/write`, `fs/list` をハンドリングし、`vscode.workspace.fs` APIを使ってファイル操作を行うロジックを実装してください。`write` 時は `vscode.window.showInformationMessage` で通知を出してください。"

### Step 3: Agent Dispatch Implementation (Critical)

"WebSocketメッセージ `agent/dispatch` をハンドリングしてください。

処理内容は `vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', { action: 'sendMessage', text: params.prompt })` です。

このコマンドは `undefined` を返すため、エラーがなければ `success` をクライアントに返してください。"

### Step 4: Bridge CLI Implementation

"Node.jsでMCPサーバー(`@modelcontextprotocol/sdk`)を作成してください。

起動時にWebSocketでExtensionに接続し、MCPツールリクエストをWebSocketメッセージに変換して転送するプロキシロジックを実装してください。"

## 7. Best Practices: "The Stigmergy Pattern"

OpenCodeがAntigravityと連携する際の推奨ワークフローパターン。

### Pattern A: "Plan & Execute" (Architect Handoff)

1. **OpenCode**: `dispatch_agent_task("このプロジェクトの要件定義を行い、ARCHITECTURE.md にまとめてください。完了したら DONE_PLANning を作成してください")`
2. **Antigravity**: (自律的に思考・作成)
3. **OpenCode**: `list_files` で `DONE_PLANning` を検知 -> `read_file("ARCHITECTURE.md")` -> 実装開始。

### Pattern B: "Review & Fix" (UI Check)

1. **OpenCode**: UIコンポーネントを実装 (`write_file`)。
2. **OpenCode**: `dispatch_agent_task("プレビュー画面を確認し、レイアウト崩れがあれば修正してください。修正完了時は UI_FIXED を作成してください")`
3. **Antigravity**: (プレビューを見ながらCSSを修正)

## 8. Troubleshooting & Limitations

* **制限事項**: Antigravityがタスクを完了したかどうかを直接APIで知る方法はない。必ず「完了時にファイルを作成する」という規約（Signal File）をプロンプトに含める必要がある。
* **トラブルシューティング**:
    * 接続拒否: `settings.json` のトークンがBridge CLI側の設定と一致しているか確認する。
    * コマンドエラー: Antigravity拡張機能が正しくロードされているか確認する（起動直後はロード待ちが必要な場合がある）。
