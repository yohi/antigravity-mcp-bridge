# Antigravity IDE 内部仕様調査報告書

本報告書は、Antigravity IDEの内部仕様に関するリバースエンジニアリング調査の結果をまとめたものです。
ファイルの変更は一切行わずに調査を実施しました。

---

## 1. 総合アーキテクチャ

Antigravity IDEは、VS Code (VSCodium/OSSビルド) を基盤とし、Google独自のAIエージェントスタックを高度に統合したElectronアプリケーションです。

- **Electronバージョン:** 39.2.3
- **Node.jsバージョン:** 22.20.0
- **基盤構造:** VS CodeのUI層を拡張し、バックエンドにGo言語で実装された高度なAIエンジン（Language Server）を配しています。

---

## 2. 主要コンポーネントと実行環境

システムは主に以下の3つの層で構成されています。

### A. UI層 (VS Code / Electron)

- **パス:** `/usr/share/antigravity`
- **リソース:** `/usr/share/antigravity/resources/app`
- **エージェントUI実装:** `resources/app/extensions/antigravity/dist/panel/chat/chat.tsx`
- **特徴:** UIコンポーネント（チャットパネルやエージェント表示等）はReactで構築されており、`@exa/chat-client` ライブラリを通じてバックエンドと通信します。Webview内でレンダリングされ、`AntigravityPanelManager`がステートを管理します。

### B. 推論・行動層 (Language Server)

- **バイナリ:** `/usr/share/antigravity/resources/app/extensions/antigravity/bin/language_server_linux_x64`
- **役割:** LSP(Language Server Protocol)の提供、ブラウザ操作（Playwright連携）、コンテキスト解析、計画立案（Planner）、各種内部アクション（Actuation）の実行。
- **主要な起動引数仕様:**
  - `--api_server_url`: 内部APIサーバー（デフォルト `http://0.0.0.0:50001`）
  - `--lsp_port`: LSP用ポート（デフォルト 42101）
  - `--server_port`: 拡張機能と通信するためのポート（デフォルト 42100）
  - `--browser_eval_env`: ブラウザ実行環境の初期化フラグ（Playwright統合用）
  - `--mquery_for_context_module`: 高度なコンテキスト検索機能の有効化フラグ

### C. 隔離・保護層 (Sandbox Wrapper)

- **バイナリスクリプト:** `/usr/share/antigravity/resources/app/extensions/antigravity/bin/sandbox-wrapper.sh`
- **技術:** macOSのSeatbelt (`sandbox-exec`) 相当のサンドボックス制約スクリプト。
- **仕様:**
  - 実行直前に動的にプロファイル（`TEMP_PROFILE`）を生成。
  - `--allow-network` フラグがない場合、ネットワーク通信を完全遮断。
  - ワークスペース(`/tmp`等指定ディレクトリ以外)への書き込みをデフォルトで禁止。
  - プロジェクト内の `.gitignore` や独自の `.agyignore` ファイルをパースし、AIエージェントがアクセスしてはいけないファイル群をOSレベルの読み取り・書き込み禁止ルール (`deny file-read*`, `deny file-write*`) へ変換して強制適用。機密情報の意図せぬ読み取りを防ぎます。

---

## 3. 内部コマンド (Commands) 完全リストと仕様

IDEのUIおよびバックエンド全体で定義されている `antigravity.*` 名前空間のコマンドを網羅しています。これらはVS Codeのコマンドパレットや内部ショートカット、AI推論エンジンから呼び出されます。

### エージェント制御・操作 (Agent Control)

AIやエージェントウィジェットの制御、提案の採否に関するコマンドです。`prioritized` プレフィックスが付くものは、標準のVS Codeコマンドよりも高い優先度で処理されます（例えば、標準の補完よりもAI補完を優先して受諾させるなど）。

- `antigravity.openAgent`: エージェントUI（サイドパネル）を開く。
- `antigravity.initializeAgent`: AIエージェントのセッションを初期化する。
- `antigravity.agent.acceptAgentStep`: AIが提案したアクションの「1ステップ」を承認し実行する。
- `antigravity.agent.rejectAgentStep`: 提案された1ステップを却下する。
- `antigravity.agent.manageAnnotations`: エージェントが付与したコードアノテーションを管理する。
- `antigravity.prioritized.chat.open`: 最優先でAIチャットウィンドウをアクティブにする。
- `antigravity.prioritized.chat.openNewConversation`: 新しい会話セッションを最優先で開始する。
- `antigravity.prioritized.command.open`: コマンド入力用のAIパレットを開く。
- `antigravity.startNewConversation`: 新規会話を開始する。
- `antigravity.openConversationPicker`: 過去の会話履歴を選択するピッカーを開く。
- `antigravity.openConversationWorkspaceQuickPick`: ワークスペースに紐づく会話をクイックピックで開く。
- `antigravity.setVisibleConversation`: 特定の会話を現在のビューに表示する。
- `antigravity.trackBackgroundConversationCreated`: バックグラウンドでの会話生成を追跡・記録する。
- `antigravity.toggleChatFocus`: チャット入力欄とエディタ間でフォーカスを切り替える。
- `antigravity.sendTextToChat`: エディタ上のテキストをチャットへ送信する。
- `antigravity.sendPromptToAgentPanel`: 指定したプロンプトを直接エージェントパネルに送る。
- `antigravity.artifacts.startComment`: アーティファクト上でコメントスレッドを開始する。

### インライン編集・差分管理 (Inline Edit & Diff)

コードのインライン提案や変更箇所のレビューに関するコマンドです。

- `antigravity.prioritized.agentAcceptFocusedHunk`: 現在フォーカスされている変更箇所（Hunk）を適用する。
- `antigravity.prioritized.agentRejectFocusedHunk`: 現在の変更箇所を却下する。
- `antigravity.prioritized.agentAcceptAllInFile`: ファイル内のすべてのAI提案を一括適用する。
- `antigravity.prioritized.agentRejectAllInFile`: ファイル内のすべてのAI提案を一括却下する。
- `antigravity.prioritized.agentFocusNextHunk`: 次の変更箇所にフォーカスを移動する。
- `antigravity.prioritized.agentFocusPreviousHunk`: 前の変更箇所にフォーカスを移動する。
- `antigravity.prioritized.agentFocusNextFile`: 次の変更ファイルに移動する。
- `antigravity.prioritized.agentFocusPreviousFile`: 前の変更ファイルに移動する。
- `antigravity.openDiffView`: AIが生成した変更案と元のコードの差分ビューを開く。
- `antigravity.openDiffZones`: インラインの差分ゾーンを展開表示する。
- `antigravity.closeAllDiffZones`: すべての差分ゾーンを閉じる。
- `antigravity.setDiffZonesState`: 差分ゾーンの表示状態（展開/折りたたみ等）を設定する。
- `antigravity.sidecar.sendDiffZone`: サイドカーアプローチで差分ゾーン情報を送信する。
- `antigravity.handleDiffZoneEdit`: 差分ゾーン内での直接編集をキャプチャ・処理する。
- `antigravity.openReviewChanges`: 複数の変更を一元レビューするビューを開く。

### 補完・予測 (Autocomplete & Supercomplete)

強力なコード補完機能である「Supercomplete」に関連するコマンドです。

- `antigravity.prioritized.supercompleteAccept`: 提案されたSupercomplete（巨大なコードブロック補完）を受け入れる。
- `antigravity.prioritized.supercompleteEscape`: Supercompleteの提案をキャンセル（エスケープ）する。
- `antigravity.acceptCompletion`: 通常のAIコード補完を受け入れる。
- `antigravity.snoozeAutocomplete`: 一定時間、自動補完を停止（スヌーズ）する。
- `antigravity.cancelSnoozeAutocomplete`: スヌーズを解除し補完を再開する。
- `antigravity.prioritized.tabJumpAccept`: `Tab`キーによる次の入力地点へのジャンプを受け入れる。
- `antigravity.prioritized.tabJumpEscape`: Tabジャンプをキャンセルする。
- `antigravity.forceSupercomplete`: 強制的にSupercompleteによる推論・補完をトリガーする。

### ターミナル・コマンド実行 (Terminal & Execution)

ターミナルとAIの連携に関するコマンドです。

- `antigravity.prioritized.terminalCommand.open`: ターミナル上でAIにコマンド生成を依頼するプロンプトを開く。
- `antigravity.terminalCommand.accept`: AIが生成したターミナルコマンドを承認する。
- `antigravity.terminalCommand.reject`: 生成されたコマンドを却下する。
- `antigravity.terminalCommand.run`: ターミナル上で提案されたコマンドを直ちに実行する。
- `antigravity.sendTerminalToChat`: ターミナルの出力内容をAIチャットのコンテキストとして送信する。
- `antigravity.sendTerminalToSidePanel`: ターミナル出力をサイドパネルのエージェントに送る。
- `antigravity.updateTerminalLastCommand`: 最後に実行したターミナルコマンドの情報をAIバックエンドに同期する。
- `antigravity.showManagedTerminal`: IDEによって管理されている（AI実行用の）ターミナルを表示する。

### インポート・移行設定 (Imports & Migration)

他のエディタ環境からの移行をシームレスに行う機能です。

- `antigravity.importCursorSettings`: Cursor IDEから設定（`settings.json`等）をインポートする。
- `antigravity.importCursorExtensions`: Cursorインストール済みの拡張機能を移行する。
- `antigravity.importWindsurfSettings`: Windsurf IDEの設定をインポートする。
- `antigravity.importWindsurfExtensions`: Windsurfの拡張機能を移行する。
- `antigravity.migrateWindsurfSettings`: Windsurfからの完全移行タスクを実行。
- `antigravity.importVSCodeSettings`: ローカルのVS Code設定をインポートする。
- `antigravity.importVSCodeExtensions`: VS Codeの拡張機能を移行する。
- `antigravity.importVSCodeRecentWorkspaces`: VS Codeの「最近開いた項目」を移行する。
- `antigravity.importCiderSettings`: Google社内IDE(Cider)の設定をインポートする。

### Cascade / 推論連鎖制御 (Cascade & Execution)

AIの連続的な思考と行動（Cascade）を制御するコマンド群です。

- `antigravity.executeCascadeAction`: パネルやチャットで決定されたアクション（変更適用、コマンド実行）の推論連鎖をキックする。
- `antigravity.interactiveCascade.acceptSuggestedAction`: 提示された対話的アクション（ファイル作成、ターミナル実行等）を承認する。
- `antigravity.interactiveCascade.rejectSuggestedAction`: 提示されたアクションを却下する。
- `antigravity.prioritized.interactiveCascade.debug`: Cascadeの内部状態をデバッグ表示する。
- `antigravity.interactiveCascade.focusEditIntent`: AIが「編集しようとしている意図」の箇所にカーソルをフォーカスする。

### デバッグ・システム管理 (Diagnostics & System)

Language Serverの管理やトラブルシューティング用です。

- `antigravity.restartLanguageServer`: バックエンドのGo Language Serverを強制再起動する。
- `antigravity.getDiagnostics`: システム全体の診断情報を収集・出力する。
- `antigravity.downloadDiagnostics`: 診断情報をZIP等でダウンロードする。
- `antigravity.getManagerTrace` / `getWorkbenchTrace`: 内部処理のトレースログを取得する。
- `antigravity.captureTraces`: トレースをキャプチャし保存する。
- `antigravity.enableTracing` / `clearAndDisableTracing`: トレース機能の有効化/無効化。
- `antigravity.toggleDebugInfoWidget`: 画面上にデバッグ情報ウィジェットの表示を切り替える。
- `antigravity.toggleManagerDevTools`: 内部プロセスマネージャー用の開発者ツールをトグル表示する。
- `antigravity.pollMcpServerStates`: 登録されているMCP（Model Context Protocol）サーバーのヘルスチェックをポーリングする。
- `antigravity.killRemoteExtensionHost`: リモート接続時の拡張機能ホストをキル（強制終了）する。
- `antigravity.simulateSegFault`: (テスト・デバッグ用) セグメンテーションフォールトを意図的に発生させる。
- `antigravity.uploadErrorAction`: 発生したエラーアクションのログをサーバーへアップロードする。

### UIカスタマイズ・機能補助 (Customization & Utilities)

* `antigravity.customizeAppIcon`: Antigravity IDEのアプリケーションアイコン（Dock等）を変更する。
- `antigravity.generateCommitMessage`: 差分（Git）を解析し、AIによるコミットメッセージを生成する。
- `antigravity.cancelGenerateCommitMessage`: 生成処理をキャンセルする。
- `antigravity.createWorkflow` / `createGlobalWorkflow`: エージェントが実行するワークフローファイル（`.md`）を作成する。
- `antigravity.createRule`: ワークスペースやプロジェクト単位のカスタムルールを定義する。
- `antigravity.openGlobalRules` / `openWorkspaceRules`: グローバルまたはワークスペース固有のルールファイルを開く。
- `antigravity.openConfigurePluginsPage` / `openMcpConfigFile`: MCPやプラグインの設定画面（`mcp_config.json`）を開く。
- `antigravity.showBrowserAllowlist`: ブラウザ操作スキルが許可されているドメインのホワイトリストを表示。
- `antigravity.explainProblem` / `explainAndFixProblem`: エディタ上で発生しているエラーをAIに説明させ、可能なら修正案を提示させる。
- `antigravity.login` / `loginWithAuthToken`: プラットフォームへのログイン、または代替トークンログイン処理をトリガー。

---

## 4. 内部状態識別用コンテキストキー (Context Keys)

ショートカットの有効化やUI要素の表示可否を判定するためのフラグ仕様です。

- `antigravity.isGoogle` / `antigravity.isGoogleInternal`: Google社内ユーザー向け機能の切り分け。
- `antigravity.isAgentModeInputBoxFocused`: エージェントモードの入力欄にフォーカスがあるか。
- `antigravity.canAcceptOrRejectFocusedHunk`: 現在のカーソル位置で変更の受諾/却下アクションが可能か。
- `antigravity.customCompletionShown`: スーパーコンプリートの提案が表示中であるか。
- `antigravity.canTriggerTerminalCommandAction`: 現在のターミナル状態においてAI機能がトリガー可能か。
- `antigravity.interactiveCascade.enabled`: インタラクティブ推論（Cascade）が有効になっているか。
- `antigravity.browserFeatureEnabled`: Playwrightを用いたブラウザ操作スキルが有効化されているか。
- `antigravity.isNotTeamsNorEnterprise`: 特定のエンタープライズライセンスを持たない一般ユーザーかどうかの判定。
- `antigravity.isFileGitIgnored`: 現在見ているファイルが `.gitignore` に含まれているか。

---

## 5. Cortex (行動・操作) システムの仕様

バックエンドのLanguage Server（Go）において、AIが実際の環境に干渉するための内部フレームワークは **「Cortex（コーテックス）」** と呼ばれています。
AIのアクションはすべて「ステップ」として正規化されており、以下の型（`CORTEX_STEP_TYPE`）に基づいて厳密に実行されます。

- `CORTEX_STEP_TYPE_VIEW_FILE_OUTLINE`: ファイルの構造を読み取る。
- `CORTEX_STEP_TYPE_BROWSER_GET_DOM`: ブラウザからDOMツリーを取得する。
- `CORTEX_STEP_TYPE_RUN_EXTENSION_CODE`: サンドボックス内でコードを実行する。
- `CORTEX_STEP_TYPE_OPEN_BROWSER_URL` / `READ_URL_CONTENT`: ブラウザ起動/URL読み取り。
- `CORTEX_STEP_TYPE_INVOKE_SUBAGENT`: サブエージェント（特定の専門タスク用AI）を呼び出す。
- `CORTEX_STEP_TYPE_RETRIEVE_MEMORY`: 過去の「Brain/Knowledge」から記憶を検索する。
- `CORTEX_STEP_TYPE_MANAGER_FEEDBACK`: マネージャーや内部評価者プロセスからのフィードバック受領。

### アクチュエーションと安全策

- **Actuation Overlay**: ブラウザ操作時に、AIがどの要素を操作しようとしているかをUI層の `window.updateActuationOverlay` 関数を通じてリアルタイムに可視化します。
- **承認プロセス**: コマンド実行時の事前判定 (`RUN_EXTENSION_CODE_AUTO_RUN_DECISION`) により、破壊的な操作に対してはユーザーの明示的な承認（`CORTEX_STEP_SOURCE_USER_EXPLICIT` フラグ）を要求するように設計されています。

---

## 6. 通信・統合仕様パラメータ (ConnectRPC と ApiServer)

UI（Electron/React）と推論バックエンド（Language Server）は、**ConnectRPC (gRPC互換通信)** を用いて高頻度に状態を同期します。

- **主要サービス (`ApiServerService`)**:
  - `GetStreamingModelAPI`: モデルからのレスポンスをストリーミング形式でUIへ流し込むエンドポイント。推論と同時に「ツール呼び出し（Tool Call）」の挿入がバイナリレベルでサポートされています。
- **管理サービス (`LanguageServerService`)**:
  - `GetAllCustomAgentConfigs`: 各ユーザー・ワークスペース固有のエージェント設定情報を取得。
- **認証とSSO (`Auth & Proxy`)**:
  - `Successfully loaded SSO proxy cookie` のように、開発環境特有のSSOクッキーロード機能を持ち、プロキシ環境下でもAIとのセキュアなエンドツーエンド通信を独自の `cert.pem` で確立しています。

---

## 7. AIの記憶（Brain）とナレッジの蒸留プロセス

### Brain構造 (`~/.gemini/antigravity/brain`)

- 各「会話セッション」ごとに独立したディレクトリ (`uuid`形式) を作成。
- **推論軌跡 (Trajectory)**: エージェントが何を考え、どう行動したかの全プロセス（プロンプトとその実行結果）がバイナリ形式 (`.pb`) でシリアライズされ保存されます。
- `Trajectory has exceeded max length` エラーログから分かるように、軌跡の長さをPlannerが自己監視し、長すぎると最適化・刈り込みを行います。

### ナレッジ項目の抽出と保存 (`~/.gemini/antigravity/knowledge`)

- **Knowledge Item (KI)**: 過去の調査履歴の要約や発見されたアーキテクチャ情報は `Knowledge Item` として自動的に蒸留（学習）されます。
- `knowledge/metadata.json` などで管理され、AIが新しいタスクを始めるとき、事前に `KI_Summaries` を検索し、コンテキストに再注入してから初動の計画を立てる仕様になっています。

---

## 8. Cascade（推論連鎖）と Planner（計画機能）

- **Planner の自律反復**: 複雑な要求に対してPlannerアルゴリズムが動作します。「計画→実行→検証→再計画」のループを回し、最大試行回数（`reached max iterations for planner`）に達するまで自律的に行動を継続します。
- **CORTEX_TRAJECTORY_SOURCE**: AIの思考の起点がトラッキングされており、ユーザーのアクティブな指示（`INTERACTIVE_CASCADE`）なのか、非同期によるタスク（`ASYNC_PRR` など）からの起動なのかが分類されています。

以上が、Antigravity IDEを構成する内部コマンド群とディープな仕様の全容です。これらは「VS Codeの単なるラッパー」としてではなく、「UI・推論・行動が三位一体で統合された次世代AI開発プラットフォーム」として構築されています。
