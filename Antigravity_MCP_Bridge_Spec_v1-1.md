# Antigravity IDE MCP Bridge Specification (v1.1)

## 1. Project Overview

本プロジェクトの目的は、Google Antigravity IDE（VS Codeフォーク）の内部状態および**計算資源（搭載されたLLMモデル）**を、Model Context Protocol (MCP) を通じて外部のエージェント（Claude Desktop等）に公開・操作可能にすることである。

Antigravity自体はMCPクライアント機能を持つが、サーバー機能を持たない。本プロジェクトでは「VS Code拡張機能」と「中継CLI」を組み合わせたブリッジ構成により、この非対称性を解消する。

### Scope (v1.1)

* **Target**: ローカル環境 (Localhost) での動作。
* **Capabilities**:
  * **[v1.0]** ファイルシステムの読み取り（プロジェクトツリー、ファイル内容）。
  * **[v1.0]** ファイルの作成・編集（書き込み）。
  * **[v1.1] Antigravity内部LLM（Gemini）への推論リクエストの中継。**
* **Constraints**:
  * ターミナル操作や汎用コマンド実行は対象外。
  * 認証は静的トークンを使用。

## 2. Tech Stack

### Core Components

| Component | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **IDE Extension** | **TypeScript** | 5.x | VS Code API (vscode.workspace, **vscode.lm**) を利用。WebSocket Serverとして振る舞う。 |
| **Bridge CLI** | **Node.js** | 20+ | MCP SDKを使用。WebSocket ClientとしてExtensionに接続し、StdioでMCP Clientと通信する。 |
| **Protocol** | **MCP** | 1.0 | Model Context Protocol Specification。 |
| **Transport** | **WebSocket** | ws (8.x) | Extension <-> CLI間の低遅延通信。 |

### Dependencies

* @modelcontextprotocol/sdk: MCPサーバー実装用。
* ws: WebSocket通信用。
* zod: スキーマ検証用。

## 3. Architecture

### 3.1 System Context

```mermaid
graph LR  
    subgraph "External World"  
        A[Claude Desktop<br>(MCP Client)]  
    end

    subgraph "Local Environment"  
        B[Bridge CLI<br>(Node.js Process)]  
    end

    subgraph "Antigravity IDE"  
        C[VS Code Extension<br>(WebSocket Server)]  
        D[Workspace State<br>(Files)]  
        E[Language Model API<br>(vscode.lm)]  
    end  
      
    subgraph "Google Cloud"  
        F[Gemini 3 Pro<br>(Antigravity Backend)]  
    end

    A -- "Tool Use: ask_antigravity" --> B  
    B -- "WS Request" --> C  
    C -- "FS API" --> D  
    C -- "selectChatModels / sendRequest" --> E  
    E -- "Inference" --> F
```

### 3.2 Sequence: LLM Request (v1.1 Feature)

1. **Request**: Claude Desktopがツール `ask_antigravity` を実行。
2. **Bridge**: CLIがWebSocketでExtensionに `{ method: "llm/chat", params: { prompt: "..." } }` を送信。
3. **Extension**: `vscode.lm.selectChatModels({ family: 'gemini' })` でモデルを取得。
4. **Inference**: `model.sendRequest(...)` でAntigravity経由でGeminiに問い合わせ。
5. **Response**: ストリーム結果を結合し、CLI経由でClaude Desktopに返却。

## 4. Features & Requirements

### 4.1 Configuration (User Settings)

VS Codeの `settings.json` で以下の設定を可能にする。

| Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| antigravity.mcp.port | number | 8888 | WebSocketサーバーのポート番号。 |
| antigravity.mcp.token | string | (random) | 認証用トークン（必須）。 |
| antigravity.mcp.defaultModelFamily | string | gemini | 使用するモデルファミリー（gpt, claude ではなくAntigravity内蔵のもの）。 |

### 4.2 Functional Requirements

#### FR-01: List Resources (File Tree) [v1.0]

* **Priority**: Must Have
* **Input**: なし
* **Output**: ワークスペース内のファイル一覧（相対パス）。

#### FR-02: Read Resource (File Content) [v1.0]

* **Priority**: Must Have
* **Input**: URI (file:///path/to/project/src/main.ts)
* **Output**: ファイルのテキストコンテンツ。
* **Constraints**: ファイルサイズ制限（デフォルト100KB）を適用。

#### FR-03: Write Resource (Create/Update) [v1.0]

* **Priority**: Should Have
* **Input**: Path, Content
* **Output**: Success/Failure Message
* **Safety**: 変更時のユーザー通知（Human-in-the-Loop）。

#### FR-04: Proxy LLM Request (Model Access) [v1.1]

* **Priority**: **Must Have (v1.1 Core)**
* **Input**: Prompt (string)
* **Output**: Model Response (string)
* **Behavior**:
  * VS Codeの `vscode.lm` API (Language Model API) を使用する。
  * Antigravityが提供するモデル（Gemini 3 Pro等）を取得して推論を実行する。
  * **意義**: Claude Desktop等の外部エージェントが、Googleのエコシステム（認証・クォータ）を利用してGeminiの能力を活用できる。

## 5. Data Structure & Protocol

### 5.1 WebSocket Messages (Bridge Protocol)

ExtensionとCLI間でやり取りするJSONメッセージ形式。

**Request (CLI -> Extension):**

```json
{  
  "jsonrpc": "2.0",  
  "id": 1,  
  "method": "llm/chat",  
  "params": {  
    "prompt": "このコードのバグを見つけて: ..."  
  }  
}
```

**Response (Extension -> CLI):**

```json
{  
  "jsonrpc": "2.0",  
  "id": 1,  
  "result": {  
    "content": "Gemini 3 Proです。ご提示のコードには..."  
  }  
}
```

## 6. API Definition (MCP Mapping)

### 6.1 Tools (Actions)

MCPクライアント（Claude等）には以下のツールとして公開する。

| Tool Name | Description | Arguments (Zod Schema) |
| :--- | :--- | :--- |
| list_files | プロジェクト内のファイル構造を取得する。 | { recursive: boolean } |
| read_file | 指定したパスのファイル内容を読み込む。 | { path: string } |
| write_file | 指定したパスにファイルを保存する。 | { path: string, content: string } |
| ask_antigravity | **Antigravity内のAIモデル(Gemini)に質問する。** | { prompt: string } |

## 7. Implementation Guidelines for AI

この仕様書を基にAI（Cursor/Windsurf）に実装を指示する際は、以下のステップとプロンプトを使用してください。

### Step 1: Scaffold Extension

"VS Code拡張機能のプロジェクトを生成してください。ws ライブラリを含め、activate 関数内でWebSocketサーバー（ポート8888）を起動するスケルトンを作成してください。"

### Step 2: Implement File Operations [v1.0]

"Extension側に fs/list, fs/read, fs/write のメッセージハンドラを実装してください。vscode.workspace.fs APIを使用してください。"

### Step 3: Implement LLM Proxy [v1.1]

"llm/chat ハンドラを追加してください。vscode.lm APIを使用し、family: 'gemini' (または vendor: 'google') で利用可能なチャットモデルを検索してください。見つかったモデルにプロンプトを送信し、レスポンスを返してください。package.json の engines フィールドで vscode のバージョンを ^1.90.0 (Language Model API対応版) に設定してください。"

### Step 4: Implement Bridge CLI (MCP Server)

"Node.jsでMCPサーバー(@modelcontextprotocol/sdk)を実装してください。起動時にWebSocketでExtensionに接続し、MCPの CallToolRequest (ask_antigravity 等) を受け取ったらWebSocket経由でExtensionに転送し、結果を返すプロキシロジックを書いてください。"
