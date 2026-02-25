# Cursor IDE 内部仕様（リバースエンジニアリング）

本ドキュメントは Cursor IDE 本体（`/usr/share/cursor` 配下）の読み取りのみによる調査結果をまとめたものです。拡張機能・MCP 等の Cursor 本体外の要素は対象外とし、**編集は一切行っていません**。

---

## 1. 製品識別情報

| 項目 | 値 |
|------|-----|
| アプリ名（短縮） | Cursor |
| アプリ名（正式） | Cursor |
| アプリケーション名（内部） | `cursor` |
| バージョン | 2.5.25 |
| VS Code ベースバージョン | 1.105.1 |
| 作者 | Anysphere, Inc. |
| メインエントリ | `./out/main.js` |
| パッケージタイプ | `module` (ES Module) |
| デスクトップ名 | cursor.desktop |

---

## 2. ディレクトリ・データパス

| 用途 | パス／名前 |
|------|------------|
| ユーザーデータフォルダ名 | `.cursor` |
| リモートサーバーデータフォルダ名 | `.cursor-server` |
| トンネルアプリ名 | cursor-tunnel |
| ライセンスファイル名 | LICENSE.txt |
| Linux アイコン名 | co.anysphere.cursor |
| URL プロトコル | `cursor` |
| Win32 ミューテックス名 | cursor |
| Win32 トンネル用ミューテックス | cursor-tunnel-mutex, cursor-tunnel-service-mutex |

---

## 3. product.json 由来の内部設定

### 3.1 AI 関連

- **aiConfig.ariaKey**: `"control-key"`（アクセシビリティ／キー表記用）

### 3.2 更新・ダウンロード

- **updateUrl**: https://api2.cursor.sh/updates  
- **backupUpdateUrl**: http://cursorapi.com/updates  
- **downloadUrl**: https://cursor.com/downloads  
- **releaseNotesUrl**: https://www.cursor.com/changelog  

### 3.3 リモート・ビルド

- **serverDownloadUrlTemplate**:  
  `https://cursor.blob.core.windows.net/remote-releases/${commit}/vscode-reh-${os}-${arch}.tar.gz`

### 3.4 拡張機能マーケットプレース

- **extensionsGallery.galleryId**: cursor  
- **serviceUrl**: https://marketplace.cursorapi.com/_apis/public/gallery  
- **itemUrl**: https://marketplace.cursorapi.com/items  
- **resourceUrlTemplate**: https://marketplace.cursorapi.com/{publisher}/{name}/{version}/{path}  
- **controlUrl**: https://api2.cursor.sh/extensions-control  

### 3.5 拡張機能の差し替え（extensionReplacementMapForImports）

| 元 ID | 差し替え先 ID |
|-------|----------------|
| ms-vscode-remote.remote-ssh | anysphere.remote-ssh |
| ms-vscode-remote.remote-containers | anysphere.remote-containers |
| ms-vscode-remote.remote-wsl | anysphere.remote-wsl |
| jeanp413.open-remote-ssh | anysphere.remote-ssh |
| jeanp413.open-remote-wsl | anysphere.remote-wsl |
| ms-python.vscode-pylance | anysphere.cursorpyright |
| ms-vscode.cpptools | anysphere.cpptools |
| ms-dotnettools.csharp | anysphere.csharp |

### 3.6 信頼される拡張（Cursor 固有）

- **cursorTrustedExtensionAuthAccess**:  
  `anysphere.cursor-retrieval`, `anysphere.cursor-commits`
- **trustedExtensionProtocolHandlers**:  
  `vscode.git`, `vscode.github-authentication`, `vscode.microsoft-authentication`,  
  `anysphere.cursor-deeplink`, `anysphere.cursor-mcp`

### 3.7 ビルド時除去フラグ（removeLinesBeforeCompilingIfTheyContainTheseWords）

本番ビルド時にソースから削除される開発用フラグの例（抜粋）:

- `__disable_cursoreval__`
- `__disable_ai_assert__`
- `__disable_cpp_control_token__`
- `__disable_ai_debugger__`
- `__disable_shadow_workspace_debugging__`
- `__disable_context_ast_typescript_fork__`
- `__disable_cpp_eval__`
- `__disable_multi_file_applies__`
- `__disable_embedding_model_switch__`
- `__disable_cursor_prediction_options__`
- `__disable_always_on_fast_apply_chunk_speculation__`
- `__disable_runnable_code_blocks__`
- `__disable_auto_import_experiments__`
- `__disable_multiple_embeddings__`
- `__disable_hmr__`
- `__disable_resume__`
- `__disable_composer_migration_warning__`
- `__disable_rcp_server__`
- `__disable_agent_cli_formatter__`
- `__disable_performance_events__`
- `__disable_statsig__`
- `__disable_fill_screen__`
- `__disable_user_intent_agents__`
- その他多数（テレメトリ・開発専用機能のオン/オフ）

---

## 4. 本体組み込み拡張（Cursor 固有・コア寄り）

※ MCP・一般ユーザー向け拡張は除外。Cursor の動作に直結するものを記載。

### 4.1 cursor-agent

- **説明**: Cursor agent 拡張
- **contributes.commands**:
  - `cursor-agent.disconnect` — "Cursor Agent: Disconnect"
- **enabledApiProposals**: control, cursor, cursorTracing

### 4.2 cursor-agent-exec

- **説明**: エージェントのコマンド実行・ファイル操作・ツール利用（ユーザー許可付き）
- **contributes**: なし（API 提案のみ）
- **enabledApiProposals**: control, cursor, cursorTracing

### 4.3 cursor-always-local

- **説明**: 実験機能・常時ローカル挙動
- **activationEvents**: onStartupFinished, onResolveRemoteAuthority:background-composer
- **menus.scm/inputBox**:  
  `cursor.generateGitCommitMessage`（when: `scmProvider == git`）
- **jsonValidation**:  
  `.cursor/environment.json` → `./schemas/environment.schema.json`
- **resourceLabelFormatters**:  
  `vscode-remote` / `background-composer+*` を「cloud-agent」サフィックスで表示
- **enabledApiProposals**: cursor, control, externalUriOpener, contribSourceControlInputBoxMenu, resolvers

### 4.4 cursor-commits

- **説明**: オンラインメトリクス用のリクエスト・コミット追跡
- **extensionDependencies**: vscode.git
- **enabledApiProposals**: control, cursor, cursorTracing
- **contributes**: コマンド・キーバインド・メニューなし

### 4.5 cursor-deeplink

- **説明**: ディープリンク URI の処理
- **contributes.commands**:
  - `cursor-deeplink.debug.triggerDeeplink` — "Debug: Trigger Arbitrary Deeplink" (Cursor Deeplink)
- **enabledApiProposals**: cursor, control, externalUriOpener

### 4.6 cursor-file-service

- **説明**: インデックス・検索まわり（contributes なし、パッケージ情報のみ）

### 4.7 cursor-ndjson-ingest

- **説明**: NDJSON ログをワークスペース `.cursor/debug.log` に取り込む HTTP サーバー
- **contributes.commands**:
  - `cursor.ndjsonIngest.start` — Cursor NDJSON Ingest: Start Server
  - `cursor.ndjsonIngest.stop` — Cursor NDJSON Ingest: Stop Server
  - `cursor.ndjsonIngest.copyCurl` — Cursor NDJSON Ingest: Copy curl command
  - `cursor.ndjsonIngest.showStatus` — Cursor NDJSON Ingest: Show server info
- **contributes.configuration**:
  - `ndjson.port`: 0–65535, デフォルト 0（0 のとき 7242–7942 の自動割当）
  - `ndjson.bindAddress`: デフォルト "127.0.0.1"

### 4.8 cursor-retrieval

- **説明**: インデックスと検索
- **contributes.commands**（開発時のみコマンドパレット）:
  - `cursor.grepClient.debug` — Debug Grep Client (Developer)
  - `cursor.snapshotClient.debug` — Debug Snapshot Client (Developer)
- **menus**: 上記 2 コマンドは `when: "isDevelopment"` でコマンドパレットに表示
- **contributes.configuration**:
  - `cursor-retrieval.canAttemptGithubLogin`: boolean, default true, scope resource
- **contributes.languages**:
  - ファイル名: `.cursorignore`, `.cursorindexingignore`（id: ignore）
- **enabledApiProposals**: control, cursor, cursorTracing, textSearchProvider2

### 4.9 cursor-shadow-workspace

- **説明**: シャドウワークスペース（contributes は空の配列）
- **enabledApiProposals**: cursor

### 4.10 cursor-polyfills-remote

- **説明**: ワークスペース拡張ホスト用ポリフィル（contributes なし）

### 4.11 cursor-worktree-textmate（worktree-textmate）

- **説明**: `.cursor/worktrees` 配下の TextMate シンタックスのみ（言語サーバーは起動しない）
- **言語 ID 例**: worktree-typescript, worktree-typescriptreact, worktree-python, worktree-* 等
- **filenamePatterns**: `**/.cursor/worktrees/**/*.{ts,tsx,js,py,...}` 等
- **configurationDefaults**: 各 worktree-* 言語で `editor.semanticHighlighting.enabled: false`

### 4.12 theme-cursor（cursor-themes）

- **説明**: Cursor デフォルトテーマ
- **contributes.themes**:
  - Cursor Dark Midnight (vs-dark)
  - Cursor Dark High Contrast (hc-black)
  - Cursor Dark (vs-dark)
  - Cursor Light (vs)

---

## 5. 内部コマンド ID 一覧（Cursor 本体・拡張由来）

コマンドパレットやキーバインドで参照される Cursor 由来のコマンド ID。

| コマンド ID | 説明／タイトル |
|-------------|----------------|
| cursor-agent.disconnect | Cursor Agent: Disconnect |
| cursor.generateGitCommitMessage | （SCM 入力ボックスメニューから、Git 時） |
| cursor-deeplink.debug.triggerDeeplink | Debug: Trigger Arbitrary Deeplink |
| cursor.ndjsonIngest.start | Cursor NDJSON Ingest: Start Server |
| cursor.ndjsonIngest.stop | Cursor NDJSON Ingest: Stop Server |
| cursor.ndjsonIngest.copyCurl | Cursor NDJSON Ingest: Copy curl command |
| cursor.ndjsonIngest.showStatus | Cursor NDJSON Ingest: Show server info |
| cursor.grepClient.debug | Debug Grep Client（isDevelopment 時） |
| cursor.snapshotClient.debug | Debug Snapshot Client（isDevelopment 時） |

---

## 6. 設定（configuration）一覧

Cursor 本体拡張が定義する設定のうち、ドキュメント化可能なもの。

| 設定キー | 型 | デフォルト | 説明 |
|----------|-----|------------|------|
| cursor-retrieval.canAttemptGithubLogin | boolean | true | 検索結果補強のための GitHub ログインを試行するか（resource） |
| ndjson.port | number | 0 | NDJSON 取り込みサーバーのポート（0 で 7242–7942 を自動割当） |
| ndjson.bindAddress | string | "127.0.0.1" | NDJSON サーバーのバインドアドレス |

---

## 7. ワークスペース・スキーマ

### 7.1 .cursor/environment.json

- **役割**: 開発環境定義（cursor-always-local がバリデーション）
- **スキーマ**: `cursor-always-local/schemas/environment.schema.json`
- **主な定義**:
  - **common**: name, user, install, start, repositoryDependencies, ports, terminals
  - **container**: build (dockerfile, context), snapshot, agentCanUpdateSnapshot
  - **terminals**: name, command, description（エージェントに表示される説明）

### 7.2 .cursor 配下の役割（推測）

- **.cursor/debug.log**: cursor-ndjson-ingest が NDJSON ログを書き出す先
- **.cursor/worktrees/**: cursor-worktree-textmate がシンタックス対象とするパス
- **.cursorignore**, **.cursorindexingignore**: cursor-retrieval が ignore 言語として扱うファイル名

---

## 8. リモート・バックグラウンド

- **リモートオーソリティ**: `background-composer`（cursor-always-local でラベル「cloud-agent」として表示）
- **リソースラベル**: `vscode-remote` + `background-composer+*` → パス + "/" + "cloud-agent"

---

## 9. API 提案（enabledApiProposals）まとめ

Cursor 本体拡張が使用する主な API 提案:

- **cursor** — Cursor 固有 API
- **cursorTracing** — トレーシング
- **control** — 制御系 API
- **externalUriOpener** — 外部 URI を開く
- **contribSourceControlInputBoxMenu** — SCM 入力ボックスメニュー
- **resolvers** — リゾルバ（リモート等）
- **textSearchProvider2** — テキスト検索プロバイダ（cursor-retrieval）

---

## 10. 備考

- ワークベンチのキーバインド・コマンドの多くは VS Code 由来のため、minified な `workbench.desktop.main.js` 内に埋め込まれており、本調査では Cursor 独自分のみを拡張の `package.json` から抽出している。
- キーバインドはユーザー設定（keybindings.json）やデフォルトキーバインドの上書きで確認する必要がある。
- バージョン・URL・拡張 ID は調査時点の Cursor 2.5.25 / product.json に基づく。

---

## 11. 各コマンドの詳細仕様（深掘り）

拡張の `dist/main.js` および workbench の実装から抽出した、コマンドごとの挙動・パラメータ・条件です。

### 11.1 cursor.ndjsonIngest.start

| 項目 | 内容 |
|------|------|
| **実装場所** | cursor-ndjson-ingest 拡張（workspace 拡張） |
| **activationEvents** | `onCommand:cursor.ndjsonIngest.start`（このコマンド実行で拡張が有効化） |
| **前提条件** | ワークスペースが信頼されていること。未信頼時は「debug mode disabled in untrusted workspace」と警告して即 return。 |
| **前提条件** | ワークスペースフォルダが開いていること。ない場合は「No workspace storage available (open a folder/workspace).」でエラー。 |
| **処理概要** | 1) `.cursor` をワークスペース直下に作成（recursive）。2) `ndjson.port` / `ndjson.bindAddress` を取得。3) port が 0 の場合は `workspaceState` の `allocatedPort` を使うか、7242–7942 の範囲で空きポートを探して割当て、`workspaceState.update("allocatedPort", o)` で保存。4) HTTP サーバーを起動。5) **エンドポイント**: `POST /ingest/${targetId}`（targetId は `workspaceState` の `nrdjson.targetId`、初回は `crypto.randomUUID()`）。6) リクエストヘッダー `X-Debug-Session-Id` が任意で指定可能。7) ボディはストリームとして `.cursor/debug.log` または `.cursor/debug-${sessionId}.log` に追記（sessionId は `^[a-zA-Z0-9-]+$` のみ許可、違う場合は `debug.log`）。8) レスポンス: 204 成功 / 404 不正パス・メソッド / 500 書き込み失敗。9) CORS: `Access-Control-Allow-Origin: *` 等を設定。10) 起動後 `env.asExternalUri` で外部用 URL を取得し、返り値は `{ externalUrl, logPath }`。 |
| **戻り値** | `Promise<{ externalUrl: string, logPath: string } \| void>`。既にサーバーが起動済みの場合は再起動せず同じオブジェクトを返す。 |
| **エラー** | EADDRINUSE / EACCES 時はメッセージ表示。「Change Port」で `workbench.action.openWorkspaceSettings` に `ndjson.port` を渡して設定を開く。 |

### 11.2 cursor.ndjsonIngest.stop

| 項目 | 内容 |
|------|------|
| **実装場所** | cursor-ndjson-ingest |
| **処理** | 内部の停止用 Promise（`S()`）を resolve し、既存の HTTP サーバーを `close()`。ログに "Stopping NDJSON ingest server" を出力。 |
| **引数** | なし。 |

### 11.3 cursor.ndjsonIngest.copyCurl

| 項目 | 内容 |
|------|------|
| **実装場所** | cursor-ndjson-ingest |
| **前提** | サーバーが起動済み（グローバル変数 `h` に URL が入っていること）。未起動なら "Server is not running." と警告。 |
| **処理** | `curl -sS -H "Content-Type: application/x-ndjson" --data-binary '{"hello":"world"}' "${h}"` をクリップボードにコピーし、「NDJSON Ingest: curl command copied to clipboard.」と表示。 |
| **引数** | なし。 |

### 11.4 cursor.ndjsonIngest.showStatus

| 項目 | 内容 |
|------|------|
| **実装場所** | cursor-ndjson-ingest |
| **処理** | 起動中なら `URL: ${h}`、未起動なら "NDJSON: server not running." を Information メッセージで表示。 |
| **引数** | なし。 |

### 11.5 cursor-deeplink.debug.triggerDeeplink

| 項目 | 内容 |
|------|------|
| **実装場所** | cursor-deeplink 拡張（UI 拡張） |
| **表示** | `showInputBox` でプロンプト: "Enter a deeplink URL to test (e.g., cursor://anysphere.cursor-deeplink/command/create?name=test&content=...)"、placeHolder: "cursor://anysphere.cursor-deeplink/..."。 |
| **バリデーション** | 1) 空なら "Please enter a deeplink URL"。2) `vscode.Uri.parse(e)` でパースし、`scheme === "cursor"` かつ `authority === "anysphere.cursor-deeplink"` でなければ "URL must start with cursor://anysphere.cursor-deeplink/"。3) パース失敗時は "Invalid URL format"。 |
| **処理** | 入力があれば再度 `Uri.parse` し、`handleUri(r)` を呼ぶ。例外時は `showErrorMessage` で "Error processing deeplink: ${message}"。 |
| **備考** | 拡張は `registerUriHandler` も行っており、`cursor://anysphere.cursor-deeplink/...` を開く URI ハンドラとして登録されている。 |

### 11.6 cursor.grepClient.debug

| 項目 | 内容 |
|------|------|
| **実装場所** | cursor-retrieval 拡張（workspace） |
| **表示条件** | `when: "isDevelopment"` のため、開発モード時のみコマンドパレットに表示。 |
| **処理** | `showDebugMenu()` を実行。QuickPick で以下 3 つから選択: 1) **Tracked State** — "Debug git status, branch name, and repo layout" → `getTrackedState(workspaceFolders)`。2) **Warmup** — "Trigger GrepClient warmup" → `warmup(workspaceFolders)`。3) **Search** — "Perform a grep search query" → 検索実行。 |
| **備考** | 本番ビルドで `crepectl` バイナリがない場合は "crepectl binary not found in production build; disabling grep service" とログされ、サービスは無効。 |

### 11.7 cursor.snapshotClient.debug

| 項目 | 内容 |
|------|------|
| **実装場所** | cursor-retrieval 拡張 |
| **表示条件** | `when: "isDevelopment"`。 |
| **処理** | `showDebugMenu()`。QuickPick: 1) **Get Status** — "Show snapshotter status" → `getStatus()`。結果は "Snapshotters: ${length}, Objects in memory: ${sum}" で表示。2) **Commit Snapshot** — "Create a snapshot of current state" → `commit(e, t)`。3) **Upload Packfile** — "Stream packfile to HTTP endpoint" → `uploadPackfile(e)`。 |

### 11.8 cursor.snapshotClient.commit / cursor.snapshotClient.uploadPackfile

| 項目 | 内容 |
|------|------|
| **実装場所** | cursor-retrieval（同一拡張内で registerCommand） |
| **公開** | package.json の `contributes.commands` には含まれず、内部・デバッグ用。 |
| **cursor.snapshotClient.commit** | シグネチャ `(e, t) => this.commit(e, t)`。スナップショットのコミット処理。 |
| **cursor.snapshotClient.uploadPackfile** | シグネチャ `(e) => this.uploadPackfile(e)`。パックファイルを HTTP エンドポイントにストリーム送信。 |

### 11.9 cursor.generateGitCommitMessage

| 項目 | 内容 |
|------|------|
| **実装場所** | ワークベンチ（VS Code ホスト側）。拡張は cursor-always-local がメニュー登録のみ（`scm/inputBox`、`when: scmProvider == git`）。 |
| **呼び出し** | SCM 入力ボックスのコンテキストメニューから「Generate Commit Message」等で利用。 |
| **処理** | ワークベンチ内の AI クライアントで `writeGitCommitMessage(e, { headers: mv(Nr()) })` を呼び、返却の `.commitMessage` を利用。引数 `e` はコンテキスト（差分等）と推測。 |
| **関連** | 同一サービスに `generateBranchName(e)` もあり、`writeGitBranchName` で `.branchName` を返す。 |

### 11.10 cursor-agent.disconnect

| 項目 | 内容 |
|------|------|
| **実装場所** | cursor-agent 拡張が `contributes.commands` で登録。実装は拡張の `dist/main.js` またはワークベンチのいずれかで、minified のため本調査では呼び出し先の特定に留まる。 |
| **用途** | Cursor Agent セッションの切断。タイトルは "Cursor Agent: Disconnect"。 |
| **備考** | activationEvents が `["*"]` のため、常時ロードされる。 |

---

## 12. NDJSON Ingest の HTTP 仕様（参考）

- **メソッド**: POST
- **パス**: `/ingest/${targetId}`（targetId は UUID 形式、ワークスペースごとに保持）
- **ヘッダー**: `X-Debug-Session-Id`（任意）。アルファベット・数字・ハイフンのみ。指定時は `.cursor/debug-${sessionId}.log`、未指定時は `.cursor/debug.log` に追記。
- **ボディ**: NDJSON ストリーム（改行区切り JSON 行）。パイプラインで改行正規化の Transform を挟み、ファイルに追記。
- **ポート範囲**: 設定が 0 のとき 7242–7942 をランダムに試行し、空きポートを `workspaceState.allocatedPort` に保存。

---

## 13. 追加深掘り結果（ワークベンチ・テレメトリ・パス）

### 13.1 ワークベンチ登録の Cursor 関連コマンド

**registerCommand（workbench 内で登録）:**

| コマンド ID | 用途（推測） |
|-------------|--------------|
| deeplink.command.create | ディープリンク経由でコマンド作成 |
| deeplink.prompt.prefill | ディープリンクでプロンプトをプリフィル |
| deeplink.rule.create | ディープリンクでルール作成 |

**executeCommand で参照される Cursor 固有コマンド:**

| コマンド ID | 用途（推測） |
|-------------|--------------|
| cursor.checkonupdate | 更新チェック |
| cursor.doupdate | 更新実行 |
| cursor.newdocs | 新規ドキュメント／新規ドキュメント系 UI |
| composer.focusComposer | Composer（チャット）にフォーカス |

**その他:** `cursor.createRuleFromSelection` — エディタで選択範囲から Cursor ルールを作成（コンテキストメニュー「Create Rule」等）。

### 13.2 cursor:// ディープリンクのパス

- **スキーム**: `cursor`
- **authority**: `anysphere.cursor-deeplink`
- **例**: `cursor://anysphere.cursor-deeplink/command/create?name=test&content=...`
- **判明しているパス**: `/command/` 配下（少なくとも `create`）、`/create`。拡張の `handleUri` が URI を処理。ワークベンチの `deeplink.command.create` / `deeplink.prompt.prefill` / `deeplink.rule.create` と対応するパスが存在すると推測。

### 13.3 テレメトリイベント名（analyticsService.trackEvent）

workbench 内で **280 種類**のイベント名が使用されている。主なプレフィックス・カテゴリ:

- **agent_layout.*** — レイアウト変更、フォーカス、ウォークスルー、submit、undo 等
- **ai_pane.*** — 開閉・状態変更
- **ask_mode.submit**, **ask_question_invoked**
- **best_of_n.*** — エージェントリクエスト、submit、view_subcomposer
- **billing_banner.***
- **browser.*** — タブクリック、ボタンクリック、エディタ開く、要素選択、DevTools 等
- **browser_popup.***, **browser_visibility**
- **bug_bot.*** — diff_accepted/rejected、error、panel、run_review、run_ide_bug_finder 等
- **client.*** — git_telemetry_started、startup_metadata、workspace_info
- **composer.*** — accept_diff、cancel_chat、checkout_to_message、code_block.*、plan_mode.*、review_cta 等（多数）
- **cursor.textModel.*** — テキストモデル作成時のメタデータ（uri、lineCount、scheme 等）
- **review_changes.opened** 等

一覧は workbench の `trackEvent("...")` から抽出可能（本ドキュメントではカテゴリと代表例のみ記載）。

### 13.4 設定キー（cursor.* / cursor-*）の網羅

| 設定キー | 拡張 | 型 | デフォルト | 説明 |
|----------|------|-----|------------|------|
| cursor-retrieval.canAttemptGithubLogin | cursor-retrieval | boolean | true | 検索のため GitHub ログインを試行するか |
| cursor.iosSimulator.enabled | cursor-ios-simulator-connect | boolean | false | iOS シミュレータ MCP を有効にするか（macOS） |
| cursor.iosSimulator.dockedView.fps | cursor-ios-simulator-connect | number | 2 | ドックビュー FPS |
| cursor.androidEmulator.enabled | cursor-android-emulator-connect | boolean | false | Android エミュレータ MCP を有効にするか |
| cursor.androidEmulator.dockedView.fps | cursor-android-emulator-connect | number | 2 | ドックビュー FPS |
| ndjson.port | cursor-ndjson-ingest | number | 0 | NDJSON サーバーポート |
| ndjson.bindAddress | cursor-ndjson-ingest | string | "127.0.0.1" | バインドアドレス |

**認証:** github-authentication の `cursor-github` は Cursor 用 GitHub 認証プロバイダとして contribute。

### 13.5 .cursor 配下の参照パス（ワークスペース内）

| パス・パターン | 用途（workbench/拡張より） |
|----------------|----------------------------|
| .cursor/debug.log | NDJSON Ingest のデフォルトログ出力先 |
| .cursor/debug-${sessionId}.log | X-Debug-Session-Id 指定時のログ |
| .cursor/environment.json | 開発環境定義（cursor-always-local がスキーマ検証） |
| .cursor/worktrees.json | ワークツリー設定（worktree-setup で読み書き） |
| .cursor/plans/ | プランファイル（composer プラン、cursorPlan スキーム等） |
| .cursor/projects/${projectId}/rules/ | ルールの内部パス（computePathsFromFullPath の正規表現で参照） |
| .cursor/worktrees/ | cursor-worktree-textmate のシンタックス対象 |
| .cursorignore | cursor-retrieval が ignore 言語として扱うファイル名 |
| .cursorindexingignore | 同上 |

### 13.6 Composer / Agent 関連のコマンド・サービス

- **composer.focusComposer** — Composer（チャット）にフォーカス。ブラウザ要素選択完了時等に executeCommand される。
- **glass.openAgentById** — Agent を ID で開く（通知クリック時等）。`isGlass` 時はこちらが使われる。
- **reviewChangesService.openOrUpdateReviewChangesEditor** — Review Changes エディタを開く／更新。`fromBackgroundAgent: { bcId }` でバックグラウンド Agent 由来のレビューを開く。
- **cursor.createRuleFromSelection** — エディタの選択テキストから Cursor ルールを作成するコマンド ID（コンテキストメニュー「Create Rule」）。
- **planStorageService** — `.cursor/plans/` および `cursorPlan:` スキームのプラン URI を扱う。プランレジストリ・リダイレクトのストレージキーは `composer.planRegistry` / `composer.planRedirects` 等。

---

*本ドキュメントは Cursor IDE のインストールディレクトリを読み取り専用で解析した結果であり、公式仕様書ではありません。*
