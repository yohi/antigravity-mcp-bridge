# Antigravity IDE MCP Bridge Specification (v1.3 Advanced RPC Hack Edition)

**Document Status**: Experimental / High Complexity

**Target Architecture**: Two-way LLM Proxy via Internal RPC Trajectory Tracking

**Base Research**: 2026-02-19 Internal Investigation Report

---

## 1. Project Overview

本プロジェクトの目的は、Google Antigravity IDEを「MCPサーバー」化し、外部のAIクライアント（OpenCode等）に対してファイルシステムだけでなく、**Antigravity内部のLLM（Gemini 3 Pro）の推論結果を直接提供（Serve）する**ことである。

v1.2までは、標準API (vscode.lm) の欠如により「片方向のタスク委譲」に留まっていた。本バージョン（v1.3）では、調査レポートで判明した**「Protobuf内部通信のハック」**および**「Cascade Trajectory（軌跡）の追跡」**アプローチ（Approach A）を採用し、完全な双方向通信（Prompt IN -> Text OUT）を実現する。

### 1.1 Scope (v1.3)

* **Capabilities**:  
  * **[v1.0]** ファイルシステムの完全な操作（Read/Write/List）。  
  * **[v1.3] Antigravity内部LLMへのプロンプト送信と、レスポンスの同期取得。**
    * 公開APIの制限を回避するため、内部ストレージ (`state.vscdb`) または内部トレースコマンド (`getManagerTrace`, `getWorkbenchTrace` 等) を利用しIDを特定する。
* **Constraints**:  
  * 非公開APIへの依存: Antigravityのアップデートにより破損するリスク（Fragile）がある。  
  * 処理遅延: 内部状態（Trajectory）の変更を検知するまでのポーリングまたは監視によるタイムラグが発生する。

---

## 2. Tech Stack & Dependencies

v1.2の構成に加え、Protobufのエンコード/デコードと複雑なポーリングを処理するための技術スタックを追加する。

| Component | Technology | Description |
| :---- | :---- | :---- |
| **Extension** | **TypeScript** | VS Code API。非公開コマンド (antigravity.getDiagnostics 等) を実行。 |
| **Bridge CLI** | **Node.js** | MCP SDK。クライアントからの同期リクエストを待機する。 |
| **Data Format** | **Protocol Buffers** | protobufjs を利用し、exa.language_server_pb メッセージを構築・解析。 |
| **Encoding** | **Base64** | Protobufの bytes ペイロードをJSONコマンド経由で渡すためのエンコーディング。 |

---

## 3. Architecture

### 3.1 System Context Diagram (The Trajectory Hack)

```mermaid
graph LR  
    subgraph "Client Side"  
        A[OpenCode<br>(MCP Client)]  
    end

    subgraph "Bridge"  
        B[Bridge CLI<br>(Node.js)]  
    end

    subgraph "Antigravity IDE (Server Side)"  
        ext[Extension<br>(Hack Layer)]  
          
        subgraph "Internal Workbench"  
            UI[Agent Panel]  
            RPC[Protobuf RPC<br>exa.language_server_pb]  
            Diag[Diagnostics Engine]  
        end  
    end  
      
    subgraph "Google Cloud"  
        Backend[cloudcode-pa.googleapis.com]  
    end

    A -- "ask_antigravity(prompt)" --> B  
    B -- "WS: llm/ask" --> ext  
      
    ext -- "1. sendPromptToAgentPanel<br>(Base64 Encoded Payload)" --> UI  
    ext -- "2. Polling: getDiagnostics" --> Diag  
    Diag -- "Extract: cascade_id" -.-> ext  
    ext -- "3. GetCascadeTrajectoryRequest" --> RPC  
    RPC <--> Backend  
    RPC -- "Decode Text" --> ext  
      
    ext -- "Response Text" --> B  
    B -- "Result" --> A
```

### 3.2 Sequence: Synchronous LLM Request (The Hack Loop)

1. **Request**: クライアントが ask_antigravity ツールを呼び出す。  
2. **Dispatch**: Extensionがプロンプトを受け取り、antigravity.sendPromptToAgentPanel を実行。
3. **Tracking (The Internal Monitor)**:  
   * Extensionは内部Traceコマンド (`antigravity.getManagerTrace`, `antigravity.getWorkbenchTrace`) または 物理ストレージ (`~/.config/Antigravity/User/globalStorage/state.vscdb`) を監視。
   * 送信したプロンプトに対応する最新の `cascade_id` とステータス（実行中/完了）を抽出。
4. **Fetch Trajectory**:  
   * ステータスが完了になったら、抽出した cascade_id を用いて exa.language_server_pb.GetCascadeTrajectoryRequest を内部RPC（または特定の内部コマンド）経由で発行。  
5. **Decode & Return**: 取得したバイナリデータをテキストにデコードし、MCPクライアントへ返却。

---

## 4. Protocol & Message Structures

調査レポート「8. 内部 RPC 仕様の深掘り」に基づくペイロード構造の定義。

### 4.1 Protobuf Payload Definitions (Mock)

Extension内に以下の構造をマッピング（または protobufjs で動的生成）する。

```typescript
// exa.language_server_pb  
interface StartCascadeRequest {  
    metadata: any;  
    prompt_text: string;  
}

interface GetCascadeTrajectoryRequest {  
    cascade_id: string;  
}

interface TrajectoryResponse {  
    steps: Array<{  
        type: string;  
        content: string; // LLMの回答テキストが含まれるフィールド  
    }>;  
}
```

### 4.2 Handling the 'bytes' Encoding Issue

レポート3.1項のデコードエラー (Unexpected token 'R') を回避するため、文字列を直接渡さず、以下のように処理する。

```javascript
// 拡張機能側のペイロード構築例  
const rawString = "Reply with...";  
const buffer = Buffer.from(rawString, 'utf-8');  
const base64Payload = buffer.toString('base64');

// 送信オブジェクト（Antigravity内部パーサーが受理できる形式を模索）  
const requestObj = {  
    action_type: "sendMessage",  
    payload_b64: base64Payload // または Protobufエンコード済みのバイナリ配列  
};
```

---

## 5. API Definition (MCP Mapping)

### 5.1 Tools (Actions)

| Tool Name | Assigned Role | Description | Arguments |
| :---- | :---- | :---- | :---- |
| read_file | Implementer | 指定パスのファイルを読み込む。 | { path: string } |
| write_file | Implementer | 指定パスにファイルを書き込む。 | { path: string, content: string } |
| ask_antigravity | **Commander** | **[v1.3 新機能]** Antigravity内部のLLM（Gemini）にプロンプトを送信し、**その回答テキストを同期的に取得する。** | { prompt: string } |

---

## 6. Implementation Guidelines for AI

この野心的な仕様を実装するためのAIへのステップバイステップ指示。

### Step 1: Base FS Implementation

"v1.0仕様のファイル操作 (read_file, write_file, list_files) を実装した拡張機能とBridgeサーバーを構築してください。"

### Step 2: The Tracker (Internal State Monitor)

"拡張機能内に TrajectoryTracker クラスを実装してください。

このクラスは、以下のいずれかの方法で `cascade_id` を特定します：

1. `vscode.commands.executeCommand('antigravity.getManagerTrace')` または `getWorkbenchTrace` の出力をパース。
2. `~/.config/Antigravity/User/globalStorage/state.vscdb` の `antigravityUnifiedStateSync.trajectorySummaries` 項目の更新をフック。"

### Step 3: The Payload Encoder

"レポートによると antigravity.sendChatActionMessage はProtobufの bytes 型を期待しています。prompt 文字列をBase64にエンコードし、エラーが発生しないJSONペイロード構造を構築する PayloadEncoder を実装してください。"

### Step 4: The Synchronous Bridge (ask_antigravity)

"llm/ask WebSocketメッセージを受け取った際のハンドラを実装してください。

1. sendPromptToAgentPanel でプロンプトを送信。  
2. TrajectoryTracker で内部状態を監視し、新しい `cascade_id` の完了を待機。  
3. 結果のテキストを抽出してWebSocketでクライアントに返却（最大タイムアウト60秒）。"

---

## 7. Risks and Mitigations (Important)

* **Risk 1: 内部構造の変更 (High)** * Antigravityのアップデートで getDiagnostics のJSON構造やRPCのProtobuf定義が変わると動作しなくなる。  
  * *Mitigation*: JSONパース処理には厳密な型チェックを行わず、try-catch とオプショナルチェーン (?.) を多用した防御的プログラミング（Defensive Programming）を行う。  
* **Risk 2: パフォーマンスの劣化 (Medium)** * 毎秒58KBのJSONを取得・パースするため、VS CodeのExtension Hostプロセスに負荷がかかる。  
  * *Mitigation*: ポーリングは ask_antigravity 実行中の「待機状態」でのみアクティブにし、アイドル時は完全に停止する。
