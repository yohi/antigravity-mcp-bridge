# Antigravity IDE MCP Bridge Specification (v1.0 MVP)

## 1. Project Overview

本プロジェクトの目的は、Google Antigravity IDE（VS Codeフォーク）の内部状態（開いているファイル、プロジェクト構造など）を、Model Context Protocol (MCP) を通じて外部のエージェント（Claude Desktop等）に公開・操作可能にすることである。

Antigravity自体はMCPクライアント機能を持つが、サーバー機能を持たない。本プロジェクトでは「VS Code拡張機能」と「中継CLI」を組み合わせたブリッジ構成により、この非対称性を解消する。

### Scope (v1.0 MVP)

* **Target**: ローカル環境 (Localhost) での動作。  
* **Capabilities**:  
  * ファイルシステムの読み取り（プロジェクトツリー、ファイル内容）。  
  * ファイルの作成・編集（書き込み）。  
* **Constraints**:  
  * ターミナル操作 (run_command) は**除外**（v1.1以降）。  
  * 認証は静的トークンを使用。  
  * ファイルサイズ制限 (Hard Limit) の実装。

## 2. Tech Stack

### Core Components

| Component | Technology | Version | Description |
| :---- | :---- | :---- | :---- |
| **IDE Extension** | **TypeScript** | 5.x | VS Code Extension API (vscode.*) を利用。WebSocket Serverとして振る舞う。 |
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
        D[Workspace State<br>(Files, Tabs)]  
    end

    A -- "Stdio (JSON-RPC)" --> B  
    B -- "WebSocket (ws://127.0.0.1:Port)" --> C  
    C -- "VS Code API" --> D
```

### 3.2 Sequence: Initialization

1. **Extension Start**: IDE起動時に拡張機能が有効化。settings.jsonからポート番号とトークンを読み込み、WebSocketサーバー (ws://127.0.0.1:8888) を起動。  
2. **MCP Client Start**: ユーザーがClaude DesktopでCLIを登録。CLIプロセスが起動。  
3. **Connection**: CLIがWebSocketでExtensionに接続. ヘッダー Authorization: Bearer <TOKEN> を送信。  
4. **Handshake**: Extensionがトークンを検証。成功すればセッション確立。  
5. **Ready**: MCPの Initialize リクエストに応答。

## 4. Features & Requirements

### 4.1 Configuration (User Settings)

VS Codeの settings.json で以下の設定を可能にする。

| Key | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| antigravity.mcp.port | number | 8888 | WebSocketサーバーのポート番号。 |
| antigravity.mcp.token | string | (random) | 認証用トークン（必須）。空の場合は起動時に生成してOutputに表示。 |
| antigravity.mcp.readOnly | boolean | false | trueの場合、書き込み操作を拒否。 |
| antigravity.mcp.maxFileSize | number | 102400 | 読み込み可能な最大バイト数 (100KB)。 |

### 4.2 Functional Requirements

#### FR-01: List Resources (File Tree)

* **Priority**: Must Have  
* **Input**: なし  
* **Output**: ワークスペース内のファイル一覧（相対パス）。  
* **Behavior**: .gitignore に含まれるファイルは除外する。

#### FR-02: Read Resource (File Content)

* **Priority**: Must Have  
* **Input**: URI (file:///path/to/project/src/main.ts)  
* **Output**: ファイルのテキストコンテンツ。  
* **Constraints**:  
  * antigravity.mcp.maxFileSize を超えるファイルはエラー -32002 (File Too Large) を返す。  
  * バイナリファイルはエラーを返すか、Base64ではなく「Binary file」というプレースホルダーを返す。

#### FR-03: Write Resource (Create/Update)

* **Priority**: Should Have  
* **Input**: Path, Content  
* **Output**: Success/Failure Message  
* **Safety**:  
  * **Human-in-the-Loop**: 重要な変更（ファイルの新規作成、大幅な書き換え）については、VS Codeの vscode.window.showInformationMessage で承認を求める（v1.0では「通知」のみとし、自動承認とする設定も可とするが、仕様上は **"Notify user on write"** を必須とする）。

## 5. Data Structure & Protocol

### 5.1 WebSocket Messages (Bridge Protocol)

ExtensionとCLI間でやり取りする JSON メッセージ形式。

**Request (CLI -> Extension):**

```json
{  
  "jsonrpc": "2.0",  
  "id": 1,  
  "method": "fs/readFile",  
  "params": {  
    "path": "src/App.tsx"  
  }  
}
```

**Response (Extension -> CLI):**

```json
{  
  "jsonrpc": "2.0",  
  "id": 1,  
  "result": {  
    "content": "import React from 'react';..."  
  }  
}
```

### 5.2 Error Codes

* -32001: Access Denied (Token Invalid)  
* -32002: File Too Large  
* -32003: File Not Found  
* -32004: Read-Only Mode Violation

## 6. API Definition (MCP Mapping)

### 6.1 Tools (Actions)

MCPクライアント（Claude等）には以下のツールとして公開する。

| Tool Name | Description | Arguments (Zod Schema) |
| :---- | :---- | :---- |
| list_files | プロジェクト内のファイル構造を取得する。 | { recursive: boolean } |
| read_file | 指定したパスのファイル内容を読み込む。 | { path: string } |
| write_file | 指定したパスにファイルを保存する（上書き/新規作成）。 | { path: string, content: string } |

### 6.2 Resources (Context)

直接プロンプトに埋め込み可能なリソースとして公開。

* **URI Template**: file:///{path}  
* **MimeType**: text/plain  
* **Behavior**: URIがリクエストされると、内部的に read_file ロジックを実行してコンテンツを返す。

## 7. Implementation Guidelines for AI

この仕様書を基にAI（Cursor/Windsurf）に実装を指示する際は、以下のステップとプロンプトを使用してください。

### Step 1: Scaffold Extension

"VS Code拡張機能のプロジェクトを生成してください。ws ライブラリを含め、activate 関数内でWebSocketサーバー（ポート8888）を起動するスケルトンを作成してください。認証トークンの検証ロジックをミドルウェアとして実装してください。"

### Step 2: Implement File Operations (Extension Side)

"Extension側に fs/list, fs/read, fs/write のメッセージハンドラを実装してください。vscode.workspace.fs APIを使用し、maxFileSize のチェックを含めてください。書き込み時は vscode.window.showInformationMessage で通知を出してください。"

### Step 3: Implement Bridge CLI (MCP Server)

"Node.jsでMCPサーバー(@modelcontextprotocol/sdk)を実装してください。起動時にWebSocketでExtensionに接続し、MCPの CallToolRequest を受け取ったらWebSocket経由でExtensionに転送し、結果を返すプロキシロジックを書いてください。"

### Step 4: Configuration & Polish

"package.json に設定項目 (antigravity.mcp.*) を追加し、READMEにClaude Desktop用の設定例 (claude_desktop_config.json) を記載してください。"
