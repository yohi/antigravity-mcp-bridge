# 作業引き継ぎメモ：Antigravity MCP Bridge モデル指定機能のデバッグ

## 1. 現状の課題
- **チャット表示の不具合**: `dispatch_agent_task` 実行時、IDEのチャットパネルにメッセージ内容ではなく `[object Object]` という文字列が表示されてしまう。
- **モデル選択の不効化**: `model` パラメータを指定しても、IDE側で適切なモデルに切り替わっていない、あるいは無視されている。

## 2. 調査結果
### 原因の特定
IDE内部（`/usr/share/antigravity/resources/app/out/vs/workbench/workbench.desktop.main.js`）を解析した結果、`antigravity.sendPromptToAgentPanel` コマンドが最終的に呼び出す `sendMessageToChatPanel(e)` メソッドの定義を確認しました。

```javascript
sendMessageToChatPanel(e) {
    const t = [new Hq({ chunk: { case: "text", value: e } })];
    this.openPanel(),
    this.b.fire({
        actionType: "sendMessage",
        payload: t.map(i => i.toBinary())
    })
}
```

- **不具合の理由**: 
  - 現在の拡張機能は、`vscode.commands.executeCommand` に対してオブジェクト `{ action: "sendMessage", text: promptText, modelId: params.model }` を渡している。
  - しかし、IDE側の実装は**第1引数 `e` を直接プロンプト文字列として処理**している。
  - そのため、渡されたオブジェクトが文字列化され、チャットに `[object Object]` と表示されている。

### モデル指定の制約
- IDEの `sendMessageToChatPanel` は引数を1つしか受け取っておらず、APIレベルでの `modelId` 指定には現状対応していない可能性が高い。
- つまり、以前試みた「プロンプト冒頭へのシステム指示（System Directive）の注入」が、モデルを制御するための最も現実的な手段である。

## 3. 次の修正ステップ

### ① 拡張機能（extension）の修正
`packages/extension/src/handlers.ts` の `handleAgentDispatch` を修正し、コマンドの引数を「文字列のみ」に変更する。

```typescript
// packages/extension/src/handlers.ts

async function handleAgentDispatch(
    params: AgentDispatchParams,
    config: ServerConfig
): Promise<AgentDispatchResult> {
    // ... promptText の構築ロジックは維持 ...

    try {
        await vscode.commands.executeCommand(
            "antigravity.sendPromptToAgentPanel",
            promptText // オブジェクトではなく、文字列を直接渡す
        );
    } catch (err: unknown) {
        // ...
    }
    // ...
}
```

### ② 動作確認手順
1. 上記修正を適用。
2. `npm run build` でビルド。
3. Antigravity IDEを **Reload Window** する。
4. `dispatch_agent_task` を実行し、チャットに正しい内容が表示されることを確認。

## 4. 関連ファイル
- `/home/y_ohi/program/private/antigravity-mcp-bridge/packages/extension/src/handlers.ts`
- `/home/y_ohi/program/private/antigravity-mcp-bridge/packages/shared/src/types.ts`
