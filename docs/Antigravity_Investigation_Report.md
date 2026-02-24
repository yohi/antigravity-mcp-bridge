# Antigravity IDE 内部仕様調査報告書

本報告書は、Antigravity IDEの内部仕様に関するリバースエンジニアリング調査の結果をまとめたものです。

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
- **特徴:** UIコンポーネント（チャットパネル等）はReactで構築されており、`@exa/chat-client` ライブラリを通じてバックエンドと通信します。

### B. 推論・行動層 (Language Server)
- **バイナリ:** `/usr/share/antigravity/resources/app/extensions/antigravity/bin/language_server_linux_x64`
- **役割:** LSP(Language Server Protocol)の提供、ブラウザ操作（Playwright）、コンテキスト解析、計画立案（Planner）。
- **主要な起動引数:**
  - `--api_server_url`: 内部APIサーバー（デフォルト 50001）
  - `--lsp_port`: LSP用ポート（デフォルト 42101）
  - `--browser_eval_env`: ブラウザ実行環境の制御

### C. 隔離・保護層 (Sandbox)
- **バイナリ:** `/usr/share/antigravity/resources/app/extensions/antigravity/bin/sandbox-wrapper.sh`
- **技術:** macOSのSeatbelt (sandbox-exec) をベースとした保護機構。
- **仕様:** AIが実行するコマンドをサンドボックス化し、`.gitignore` などの設定を動的に読み込んで、機密ファイルへのアクセスを環境レベルで遮断します。

---

## 3. 内部コマンドとプロトコル

### 内部コマンド名前空間 (`antigravity.*`)
膨大なコマンドが定義されており、特にAI操作に関するものが中心です。
- **エージェント制御:** `antigravity.agent.acceptAgentStep`, `antigravity.initializeAgent`
- **UI操作:** `antigravity.prioritized.chat.open`, `antigravity.openDiffView`
- **移行ツール:** `antigravity.importCursorSettings`, `antigravity.importWindsurfSettings`

### 通信プロトコル (ConnectRPC)
UIとLanguage Server間は高性能な **ConnectRPC** で接続されています。
- **ApiServerService:** `GetStreamingModelAPI` により、推論結果のストリーミングと動的なツール呼び出しを実現。
- **LanguageServerService:** エージェントのコンフィグ管理やLSP通信を担当。

---

## 4. AIの記憶と知能の仕組み (Brain & Knowledge)

### 記憶構造 (`~/.gemini/antigravity/brain`)
- 各セッションの「思考の軌跡（Trajectory）」がバイナリ形式で詳細に記録されます。
- 推論が複雑化するとプランナーが自律的にコンテキストを最適化し、要約を行うアルゴリズムが組み込まれています。

### ナレッジの蒸留 (`~/.gemini/antigravity/knowledge`)
- 過去の重要な調査結果やルールは「Knowledge Item (KI)」として抽出され、インデックス化（`KI_Summaries`）されます。
- 新しいタスク開始時に、関連するKIが自動的にAIのコンテキストに再注入される仕組みです。

---

## 5. 推論連鎖（Cascade）の仕様
AIが問題を解決する際、**Cascade（カスケード）** と呼ばれる推論連鎖プロセスを実行します。
- **Trajectory管理:** 実行された全ステップの履歴。
- **Planner:** タスクを完遂するまで「計画・実行・検証」のサイクル（最大反復回数管理付き）を回す司令塔。

---

## 6. 特殊インフラ仕様
- **Actuation Overlay:** AIがブラウザやエディタを操作する際、注視点を可視化する独自のオーバーレイ表示。
- **SSO/プロキシ連携:** 内部認証局 (`cert.pem`) と連携し、エンタープライズ環境でのSSOプロキシ経由の通信をセキュアに維持。

---

## 調査の結論
Antigravity IDEは、単なるテキストエディタではなく、**「推論（Goバックエンドサーバー）」「行動（サンドボックス・ブラウザ操作）」「記憶（KIシステム）」**が完全に統合された、高度に自律的なAI開発プラットフォームであると言えます。
