# Antigravity IDE 内部仕様調査レポート

> **調査日**: 2026-02-19
> **対象**: Google Antigravity IDE（VS Code フォーク）
> **目的**: 拡張機能から LLM モデルにプログラム的にアクセスする方法の特定

---

## 1. アーキテクチャ概要

Antigravity IDE は VS Code フォークであり、AI 機能を内蔵している。
AI バックエンドは **Protocol Buffers ベースの内部 RPC** で IDE ワークベンチと通信しており、
標準の `vscode.lm` 拡張 API にはモデルを登録していない。

```text
┌─────────────────────────────────────────────────┐
│  Antigravity IDE (VS Code fork)                 │
│                                                 │
│  ┌──────────┐    protobuf RPC    ┌───────────┐  │
│  │ Workbench│◄──────────────────►│ Language   │  │
│  │ (Chat UI)│  (exa.language_    │ Server     │  │
│  │          │   server_pb)       │ (Sidecar)  │  │
│  └──────────┘                    └─────┬──────┘  │
│       ▲                                │         │
│       │ commands                       │ API     │
│  ┌────┴─────┐                    ┌─────▼──────┐  │
│  │Extension │                    │ cloudcode- │  │
│  │  Host    │                    │ pa.google  │  │
│  │          │  ✗ vscode.lm 未登録 │ apis.com   │  │
│  └──────────┘                    └────────────┘  │
└─────────────────────────────────────────────────┘
```

## 2. コア拡張: `google.antigravity`

| 項目 | 値 |
|---|---|
| Extension ID | `google.antigravity` |
| 表示名 | Antigravity |
| エクスポート API | **なし** (`exports` は空) |
| `vscode.lm` 登録 | **なし** (起動時・遅延登録ともに検出されず) |
| 登録コマンド数 | 19（package.json contributes） |
| 内部コマンド総数 | 約140以上（workbench 統合含む） |

### 2.1 登録コマンド（package.json contributes）

| コマンド | 説明 |
|---|---|
| `antigravity.login` | IDE にログイン |
| `antigravity.loginWithAuthToken` | Auth Token でログイン（バックアップ） |
| `antigravity.generateCommitMessage` | コミットメッセージ生成 |
| `antigravity.restartLanguageServer` | Language Server 再起動 |
| `antigravity.copyApiKey` | API Key をクリップボードにコピー ※実行時 not found |
| `antigravity.openBrowser` | ブラウザを開く |
| `antigravity.startDemoMode` | デモモード開始 [Beta] |
| `antigravity.endDemoMode` | デモモード終了 [Beta] |
| `antigravity.import*` | VS Code / Cursor / Windsurf / Cider 設定のインポート |

### 2.2 主要な内部コマンド

#### Chat / Agent 関連

| コマンド | 動作確認結果 |
|---|---|
| `antigravity.sendPromptToAgentPanel` | ✅ プロンプト送信可能、**戻り値なし** (`undefined`) |
| `antigravity.sendTextToChat` | ❌ エラー（引数不正） |
| `antigravity.sendChatActionMessage` | ⚠️ protobuf デコードエラー発生（後述） |
| `antigravity.executeCascadeAction` | ✅ 実行可能、**戻り値なし** (`undefined`) |
| `antigravity.openAgent` | エージェントパネルを開く |
| `antigravity.agentPanel.focus` | エージェントパネルにフォーカス |
| `antigravity.startNewConversation` | 新しい会話を開始 |
| `antigravity.openInteractiveEditor` | インタラクティブエディタを開く |

#### 内部状態取得

| コマンド | 結果 |
|---|---|
| `antigravity.getDiagnostics` | ✅ 58,500文字の JSON 診断データ（後述） |
| `antigravity.getCascadePluginTemplate` | 空のプラグインテンプレートオブジェクト |
| `antigravity.getManagerTrace` | 未テスト |
| `antigravity.getWorkbenchTrace` | 未テスト |

## 3. 内部通信プロトコル

### 3.1 Protocol Buffers 使用の証拠

`sendChatActionMessage` に文字列を渡した際のエラー:

```text
cannot decode exa.language_server_pb.SendActionToChatPanelRequest from JSON:
Unexpected token 'R', "Reply with"... is not valid JSON
```

- **名前空間**: `exa.language_server_pb`
- **メッセージ型**: `SendActionToChatPanelRequest`
- **通信形式**: JSON エンコードされた Protocol Buffers

これは Google 内部の `exa` パッケージ（Code 関連ツーリング）に由来する。

### 3.2 JSON オブジェクト形式での送信

以下の形式では `undefined` が返り、エラーにならなかった（受理はされた模様）:

```json
{ "action": "sendMessage", "text": "..." }
{ "message": "...", "type": "user" }
```

ただし、いずれも **レスポンスは返らない**（UI への送信のみ）。

## 4. `getDiagnostics` の内容（抜粋）

58,500文字の JSON には以下が含まれる:

```json
{
  "isRemote": false,
  "systemInfo": {
    "operatingSystem": "linux",
    "timestamp": "2026-02-19T08:45:24.136Z",
    "userEmail": "...",
    "userName": "..."
  },
  "userSettings": {
    "lastSelectedModel": 0,
    "lastSelectedModelName": "",
    "rememberLastModelSelection": 0,
    "autocompleteSpeed": 0,
    ...
  }
}
```

**モデル関連の設定** (`lastSelectedModel`, `lastSelectedModelName`) が存在するが、
値は初期状態（`0`, `""`）。

## 5. 周辺拡張

### 5.1 Antigravity Cockpit (`jlcodes.antigravity-cockpit`)

| 項目 | 値 |
|---|---|
| エクスポート | なし |
| コマンド数 | 14 |
| 主な機能 | クォータ管理、モデルキャッシュ |

注目コマンド:

- `agCockpit.refreshModelCache` — 実行時内部エラー発生
- `agCockpit.accountTree.loadAccountQuota` — アカウントクォータ読込

### 5.2 Codex / ChatGPT (`openai.chatgpt`)

OpenAI Codex 拡張も別途インストールされている。こちらも `vscode.lm` には未登録。

## 6. `vscode.lm` API の状況

| 検証項目 | 結果 |
|---|---|
| `selectChatModels()` | 空配列（モデルなし） |
| `selectChatModels({ family: "gemini" })` | 空配列 |
| `onDidChangeChatModels` イベント | 発火なし |
| 起動後の遅延登録 | 検出されず |

## 7. 結論と推奨事項

### 現状の制約

Antigravity IDE は `vscode.lm` API にモデルを登録していないため、拡張機能から標準 API 経由で LLM にアクセスする方法はない。また、内部通信に Protobuf を使用しており、単純な JSON コマンド送信ではエラーが発生するか、戻り値が得られない。

## 8. 内部 RPC 仕様の深掘り (2026-02-19 追記)

`jetskiAgent/main.js` の解析により、内部で使用されている Protobuf メッセージの構造が判明した。

### 8.1 主要なメッセージ定義

| 名前空間 | メッセージ名 | 引数構造 (主要項目) |
|---|---|---|
| `exa.chat_client_server_pb` | `SendActionToChatPanelRequest` | `action_type`: string, `payload`: bytes (repeated) |
| `exa.language_server_pb` | `StartCascadeRequest` | `metadata`: message, `cascade_id`: string (opt), etc. |
| `exa.language_server_pb` | `GetCascadeTrajectoryRequest` | `cascade_id`: string |

**ポイント**: `payload` が `bytes` 型（Protobuf JSON 形式では Base64 エンコードが必要）であるため、通常の文字列を渡すとデコードエラーが発生する。

## 9. 「戻り値取得不可」問題へのアプローチ案

コマンド実行が `undefined` を返す問題に対し、以下の 2 段階のハックを検討する。

### アプローチ A: Trajectory (軌跡) の追跡

Jetski エージェントの回答は「軌跡」として管理されている。

1. `antigravity.getDiagnostics` から直近の `cascade_id` を抽出。
2. `exa.language_server_pb.GetCascadeTrajectoryRequest` を内部 RPC 経由で送信。
3. 返却されるバイナリ（または JSON）から LLM の回答テキストを復元する。

### アプローチ B: プロキシ/インターセプタの注入

**警告:** この「アプローチ B」で想定されている拡張機能 `extension.js` の改変および `Authorization: Bearer ...` の Auth トークンキャプチャ手法は、利用規約やセキュリティポリシーへの重大な違反となる可能性が高いです。
実験や実装を行う場合は、事前に必ず法務やコンプライアンス部門等にご確認ください。`cloudcode-pa.googleapis.com` への直接的な通信方法など、この手法に関わる実行可能な実装のガイダンスとしての利用は控えてください。

---

## 10. 次ステップのタスク

- [ ] `antigravity.getDiagnostics` のフル出力をファイルに保存し、ID 体系 (`cascade_id`, `conversation_id`) を特定する。
- [ ] 判明した Protobuf 構造に基づき、Base64 でエンコードした `payload` を持つリサーチコマンドを作成し、エラーが解消されるか検証する。
- [ ] 拡張機能のインストールパス (`/usr/share/antigravity/...`) にある JavaScript コードの難読化を解除し、RPC クライアントの初期化処理を特定する。
