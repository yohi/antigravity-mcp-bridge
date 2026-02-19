# Antigravity MCP Bridge

Antigravity IDE（VS Code フォーク）の内部状態を [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 経由で外部エージェント（Claude Desktop 等）に公開するブリッジシステム。

## アーキテクチャ

```
Claude Desktop  ──Stdio (JSON-RPC)──►  Bridge CLI  ──WebSocket──►  VS Code Extension
(MCP Client)                           (MCP Server)                (WebSocket Server)
                                                                        │
                                                                   VS Code API
                                                                   (Workspace/Files)
```

## コンポーネント

| コンポーネント | パス | 説明 |
|:--|:--|:--|
| **Extension** | `packages/extension` | VS Code 拡張機能。WebSocket サーバーとして IDE の状態を公開 |
| **Bridge CLI** | `packages/bridge-cli` | MCP サーバー。Stdio で MCP クライアントと通信し、WebSocket で Extension に転送 |
| **Shared** | `packages/shared` | 共有型定義（JSON-RPC メッセージ型、定数） |

## MCPツール

| ツール名 | 説明 |
|:--|:--|
| `list_files` | プロジェクト内のファイル構造を取得 |
| `read_file` | 指定パスのファイル内容を読み込み |
| `write_file` | 指定パスにファイルを保存（上書き/新規作成） |

## セットアップ

### 1. ビルド

```bash
npm install
npm run build
```

### 2. Extension の設定

VS Code の `settings.json` で以下を設定:

```json
{
  "antigravity.mcp.port": 8888,
  "antigravity.mcp.token": "your-secret-token",
  "antigravity.mcp.readOnly": false,
  "antigravity.mcp.maxFileSize": 102400
}
```

> **Note**: `token` を空にすると、Extension 起動時に自動生成されたトークンが Output パネルに表示されます。

### 3. Claude Desktop の設定

`claude_desktop_config.json` に以下を追加:

```json
{
  "mcpServers": {
    "antigravity": {
      "command": "node",
      "args": ["/path/to/antigravity-mcp-bridge/packages/bridge-cli/dist/index.js"],
      "env": {
        "ANTIGRAVITY_PORT": "8888",
        "ANTIGRAVITY_TOKEN": "your-secret-token"
      }
    }
  }
}
```

## 環境変数（Bridge CLI）

| 変数名 | 説明 | デフォルト |
|:--|:--|:--|
| `ANTIGRAVITY_TOKEN` | 認証トークン（**必須**） | - |
| `ANTIGRAVITY_PORT` | WebSocket ポート番号 | `8888` |
| `ANTIGRAVITY_HOST` | WebSocket ホスト | `127.0.0.1` |

## ライセンス

MIT
