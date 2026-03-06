# Cursor IDE コマンド完全リファレンス

Cursor IDE で利用可能な全コマンドを、Cursor 固有のものと VSCode 継承コマンドに分けて記載する。  
リバースエンジニアリングおよび公式ドキュメント・API リファレンスに基づく。

---

## 1. Cursor IDE 固有のコマンド

Cursor が VSCode 上に追加している機能に対応するコマンド・ショートカット・スラッシュコマンド。

### 1.1 キーボードショートカット（一般）

| 内容 | キー (macOS) | キー (Windows/Linux) |
|------|--------------|----------------------|
| サイドパネルの表示/非表示 | Cmd + I | Ctrl + I |
| サイドパネルの表示/非表示（代替） | Cmd + L | Ctrl + L |
| モードメニューを開く | Cmd + . | Ctrl + . |
| AI モデルを切り替え | Cmd + / | Ctrl + / |
| Cursor 設定を開く | Cmd + Shift + J | Ctrl + Shift + J |
| コマンドパレットを開く | Cmd + Shift + P | Ctrl + Shift + P |

### 1.2 チャット関連ショートカット

| 内容 | キー (macOS) | キー (Windows/Linux) |
|------|--------------|----------------------|
| 送信 | Enter | Enter |
| 生成のキャンセル | Cmd + Shift + Backspace | Ctrl + Shift + Backspace |
| 選択コードをコンテキストに追加 | Cmd + L（コード選択時） | Ctrl + L（コード選択時） |
| すべての変更を承認 | Cmd + Enter | Ctrl + Enter |
| すべての変更を却下 | Cmd + Backspace | Ctrl + Backspace |
| メッセージ間を移動 | Tab / Shift + Tab | Tab / Shift + Tab |
| 新規チャット | Cmd + N / Cmd + R | Ctrl + N / Ctrl + R |
| Composer をバーとして開く | Cmd + Shift + K | Ctrl + Shift + K |
| 前/次のチャットを開く | Cmd + [ / Cmd + ] | Ctrl + [ / Ctrl + ] |

### 1.3 Cmd+K（インライン編集）関連

| 内容 | キー (macOS) | キー (Windows/Linux) |
|------|--------------|----------------------|
| Cmd+K を開く | Cmd + K | Ctrl + K |
| 入力フォーカスを切り替え | Cmd + Shift + K | Ctrl + Shift + K |
| クイック質問 | Option + Enter | Alt + Enter |

### 1.4 コード選択・コンテキスト

| 内容 | キー/入力 |
|------|-----------|
| @ シンボル（ファイル・コード・ドキュメント参照） | @ |
| ファイル参照 | # |
| スラッシュコマンド | / |
| 選択をチャットに追加 | Cmd + Shift + L (macOS) / Ctrl + Shift + L (Win/Linux) |
| ファイル読み取り戦略の切り替え | Cmd + M (macOS) / Ctrl + M (Win/Linux) |

### 1.5 スラッシュコマンド（チャット/エージェント内）

チャットまたは Composer で `/` 入力後に利用できる組み込みコマンド。

| コマンド | 内容 |
|----------|------|
| `/auto-context` | 自動で最近のファイルと IDE コンテキストを含めるオン/オフ |
| `/cloud` | クラウドモードに切り替え（リモートでタスク実行） |
| `/cloud-environment` | クラウド環境を選択（クラウドモード時） |
| `/feedback` | フィードバック送信ダイアログを開く |
| `/local` | ローカルモードに切り替え（ワークスペース内で実行） |
| `/review` | 未コミット変更のコードレビューモードを開始 |
| `/status` | スレッド ID・コンテキスト使用量・レート制限を表示 |
| `/max-mode` | Max Mode のオン/オフ（対応モデルのみ） |
| `/plan` | Plan モードに切り替え（アプローチ設計用） |
| `/ask` | Ask モードに切り替え（読み取り専用の探索） |
| `/sandbox` | コマンド実行設定を構成 |

### 1.6 カスタムスラッシュコマンド

`.cursor/commands/` に配置した Markdown ファイルがスラッシュコマンドとして登録される。  
例: `/lint-fix`, `/refactor-code`, `/optimize-performance`, `/add-error-handling`, `/code-review`, `/run-all-tests-and-fix` など。

---

## 2. VSCode 継承：executeCommand API で利用可能なコマンド

拡張機能やスクリプトから `vscode.commands.executeCommand` で呼び出せる公式ドキュメント掲載のコマンド。  
Cursor は VSCode ベースのため、これらもそのまま利用可能。

### 2.1 エディタ・ドキュメント操作

| コマンド ID | 内容 | 主な引数 |
|-------------|------|----------|
| `vscode.open` | リソースをエディタで開く（ファイルまたは http(s) URL） | uri, columnOrOptions?, label? |
| `vscode.openWith` | 指定エディタでリソースを開く | resource, viewId, columnOrOptions? |
| `vscode.diff` | 差分エディタで左右リソースを比較 | left, right, title?, options? |
| `vscode.changes` | 複数リソースを changes エディタで比較 | title, resourceList |
| `revealLine` | 指定行を指定位置に表示 | lineNumber, at: 'top' \| 'center' \| 'bottom' |
| `cursorMove` | カーソルを論理位置へ移動 | to, by?, value?, select? |
| `editorScroll` | エディタを指定方向にスクロール | to: 'up' \| 'down', by?, value?, revealCursor? |
| `editor.fold` | 範囲を折りたたむ | selectionLines?, direction?, levels? |
| `editor.unfold` | 範囲を展開 | selectionLines?, direction?, levels? |
| `editor.toggleFold` | 折りたたみ/展開をトグル | - |
| `editor.actions.findWithArgs` | インエディタ検索ウィジェットをオプション付きで開く | searchString?, replaceString?, isRegex?, isCaseSensitive?, matchWholeWord?, findInSelection?, preserveCase? |
| `editor.action.goToLocations` | 指定位置から locations へジャンプ | uri, position, locations, multiple?, noResultsMessage? |
| `editor.action.peekLocations` | 指定位置から locations を Peek | uri, position, locations, multiple? |

### 2.2 言語機能・プロバイダー実行

| コマンド ID | 内容 | 主な引数 |
|-------------|------|----------|
| `vscode.executeDocumentHighlights` | ドキュメントハイライトを実行 | uri, position |
| `vscode.executeDocumentSymbolProvider` | ドキュメントシンボルを取得 | uri |
| `vscode.executeFormatDocumentProvider` | ドキュメントフォーマットを実行 | uri, options? |
| `vscode.executeFormatRangeProvider` | 範囲フォーマットを実行 | uri, range, options? |
| `vscode.executeFormatOnTypeProvider` | 入力時フォーマットを実行 | uri, position, ch, options? |
| `vscode.executeDefinitionProvider` | 定義プロバイダーを実行 | uri, position |
| `vscode.executeTypeDefinitionProvider` | 型定義プロバイダーを実行 | uri, position |
| `vscode.executeDeclarationProvider` | 宣言プロバイダーを実行 | uri, position |
| `vscode.executeImplementationProvider` | 実装プロバイダーを実行 | uri, position |
| `vscode.executeReferenceProvider` | 参照プロバイダーを実行 | uri, position |
| `vscode.executeHoverProvider` | ホバープロバイダーを実行 | uri, position |
| `vscode.executeSelectionRangeProvider` | 選択範囲プロバイダーを実行 | uri, position |
| `vscode.executeWorkspaceSymbolProvider` | ワークスペースシンボルを検索 | query |
| `vscode.prepareCallHierarchy` | 呼び出し階層を準備 | uri, position |
| `vscode.provideIncomingCalls` | 呼び出し元を取得 | item |
| `vscode.provideOutgoingCalls` | 呼び出し先を取得 | item |
| `vscode.prepareRename` | リネーム準備 | uri, position |
| `vscode.executeDocumentRenameProvider` | リネームを実行 | uri, position, newName |
| `vscode.executeLinkProvider` | ドキュメントリンクを取得 | uri, linkResolveCount? |
| `vscode.executeCompletionItemProvider` | 補完プロバイダーを実行 | uri, position, triggerCharacter?, itemResolveCount? |
| `vscode.executeSignatureHelpProvider` | シグネチャヘルプを実行 | uri, position, triggerCharacter? |
| `vscode.executeCodeLensProvider` | CodeLens を実行 | uri, itemResolveCount? |
| `vscode.executeCodeActionProvider` | コードアクションを実行 | uri, rangeOrSelection, kind?, itemResolveCount? |
| `vscode.executeDocumentColorProvider` | ドキュメント内の色を取得 | uri |
| `vscode.executeColorPresentationProvider` | 色のプレゼンテーションを取得 | color, context |
| `vscode.executeInlayHintProvider` | Inlay Hints を取得 | uri, range? |
| `vscode.executeFoldingRangeProvider` | 折りたたみ範囲を取得 | uri |
| `vscode.executeInlineValueProvider` | インライン値を取得 | uri, range, context |
| `vscode.prepareTypeHierarchy` | 型階層を準備 | uri, position |
| `vscode.provideSupertypes` | スーパータイプを取得 | item |
| `vscode.provideSubtypes` | サブタイプを取得 | item |
| `vscode.revealTestInExplorer` | テストをエクスプローラーで表示 | testItem |

### 2.3 ノートブック・インタラクティブ

| コマンド ID | 内容 | 主な引数 |
|-------------|------|----------|
| `vscode.executeDataToNotebook` | ノートブックシリアライザーを実行 | data, notebookType |
| `vscode.executeNotebookToData` | ノートブックをバイト列に変換 | NotebookData, notebookType |
| `notebook.selectKernel` | カーネルピッカーを表示 | options? / kernelInfo? |
| `interactive.open` | インタラクティブウィンドウを開く | resource, controllerId, title?, showOptions? |
| `_interactive.open` | 同上（内部） | resource, controllerId, title?, showOptions? |
| `interactive.execute` | 入力ボックスの内容を実行 | resource |
| `notebook.cell.toggleOutputs` | セル出力の表示/非表示 | options? |
| `notebook.fold` | セルを折りたたむ | index? |
| `notebook.unfold` | セルを展開 | index? |
| `notebook.cell.changeLanguage` | セル言語を変更 | language, range? |
| `notebook.execute` | すべて実行 | uri |
| `notebook.cell.execute` | セルを実行 | options? |
| `notebook.cell.executeAndFocusContainer` | セル実行してコンテナにフォーカス | options? |
| `notebook.cell.cancelExecution` | セル実行を停止 | options? |

### 2.4 ワークスペース・ウィンドウ・ファイル

| コマンド ID | 内容 | 主な引数 |
|-------------|------|----------|
| `vscode.openFolder` | フォルダ/ワークスペースを開く | uri?, options? |
| `vscode.newWindow` | 新しいウィンドウを開く | options? |
| `vscode.removeFromRecentlyOpened` | 最近開いた一覧から削除 | path |
| `vscode.getEditorLayout` | エディタレイアウトを取得 | - |
| `workbench.action.quickOpen` | クイックオープン | prefix? |
| `workbench.action.findInFiles` | ワークスペース検索を開く | options? |
| `search.action.openNewEditor` | 新規検索エディタを開く | args? |
| `search.action.openEditor` | 検索エディタを開く | args? |
| `search.action.openNewEditorToSide` | 横に新規検索エディタを開く | args? |
| `moveActiveEditor` | アクティブエディタをタブ/グループで移動 | to, by, value? |
| `copyActiveEditor` | アクティブエディタをグループでコピー | to, value? |
| `workbench.action.files.newUntitledFile` | 新規無題テキストファイル | languageId? |
| `workbench.extensions.installExtension` | 拡張機能をインストール | extensionIdOrVSIXUri, options? |
| `workbench.extensions.uninstallExtension` | 拡張機能をアンインストール | extensionId |
| `workbench.extensions.search` | 拡張機能を検索 | query? |
| `workbench.action.tasks.runTask` | タスクを実行 | args? |
| `workbench.action.openIssueReporter` | 問題レポートを開く | options? |
| `vscode.openIssueReporter` | 同上 | options? |
| `workbench.action.openLogFile` | ログファイルを開く | logFile? |
| `workbench.action.openWalkthrough` | ウォークスルーを開く | walkthroughID, toSide? |

### 2.5 チャット（VSCode 組み込み）

| コマンド ID | 内容 |
|-------------|------|
| `vscode.editorChat.start` | 新規エディタチャットセッションを開始 |

### 2.6 コンテキスト

| コマンド ID | 内容 | 引数 |
|-------------|------|------|
| `setContext` | when 節で使うカスタムコンテキストキーを設定 | name, value |

---

## 3. VSCode デフォルトキーバインド付きコマンド一覧

キーボードショートカットエディタ（`workbench.action.openGlobalKeybindings`）や「Preferences: Open Default Keyboard Shortcuts (JSON)」で確認できる、デフォルトで割り当てられたコマンドの代表一覧。  
※ キーは macOS / Windows・Linux の順。⌘=Cmd, ⇧=Shift, ⌥=Option/Alt, ⌃=Ctrl。

### 3.1 基本編集

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `editor.action.clipboardCutAction` | 行をカット（空選択時） | ⌘X | Ctrl+X |
| `editor.action.clipboardCopyAction` | 行をコピー（空選択時） | ⌘C | Ctrl+C |
| `editor.action.clipboardPasteAction` | 貼り付け | ⌘V | Ctrl+V |
| `editor.action.deleteLines` | 行を削除 | ⇧⌘K | Ctrl+Shift+K |
| `editor.action.insertLineAfter` | 下に行を挿入 | ⌘Enter | Ctrl+Enter |
| `editor.action.insertLineBefore` | 上に行を挿入 | ⇧⌘Enter | Ctrl+Shift+Enter |
| `editor.action.moveLinesDownAction` | 行を下に移動 | ⌥↓ | Alt+Down |
| `editor.action.moveLinesUpAction` | 行を上に移動 | ⌥↑ | Alt+Up |
| `editor.action.copyLinesDownAction` | 行を下にコピー | ⇧⌥↓ | Shift+Alt+Down / Ctrl+Shift+Alt+Down |
| `editor.action.copyLinesUpAction` | 行を上にコピー | ⇧⌥↑ | Shift+Alt+Up / Ctrl+Shift+Alt+Up |
| `undo` | 元に戻す | ⌘Z | Ctrl+Z |
| `redo` | やり直す | ⇧⌘Z | Ctrl+Y |
| `editor.action.addSelectionToNextFindMatch` | 次の一致を選択に追加 | ⌘D | Ctrl+D |
| `editor.action.moveSelectionToNextFindMatch` | 最後の選択を次の一致へ | ⌘K ⌘D | Ctrl+K Ctrl+D |
| `cursorUndo` | 最後のカーソル操作を元に戻す | ⌘U | Ctrl+U |
| `editor.action.insertCursorAtEndOfEachLineSelected` | 選択行末にカーソル挿入 | ⇧⌥I | Shift+Alt+I |
| `editor.action.selectHighlights` | 現在選択の全出現を選択 | ⇧⌘L | Ctrl+Shift+L |
| `editor.action.changeAll` | 現在単語の全出現を選択 | ⌘F2 | Ctrl+F2 |
| `expandLineSelection` | 現在行を選択 | ⌘L | Ctrl+L |
| `editor.action.insertCursorBelow` | 下にカーソル挿入 | ⌥⌘↓ | Ctrl+Alt+Down / Shift+Alt+Down |
| `editor.action.insertCursorAbove` | 上にカーソル挿入 | ⌥⌘↑ | Ctrl+Alt+Up / Shift+Alt+Up |
| `editor.action.jumpToBracket` | 対応する括弧へ | ⇧⌘\ | Ctrl+Shift+\ |
| `editor.action.indentLines` | インデント追加 | ⌘] | Ctrl+] |
| `editor.action.outdentLines` | インデント削減 | ⌘[ | Ctrl+[ |
| `cursorHome` | 行頭へ | Home | Home |
| `cursorEnd` | 行末へ | End | End |
| `cursorBottom` | ファイル末尾へ | ⌘↓ | Ctrl+End |
| `cursorTop` | ファイル先頭へ | ⌘↑ | Ctrl+Home |
| `scrollLineDown` | 1 行下にスクロール | ⌃PageDown | Ctrl+Down |
| `scrollLineUp` | 1 行上にスクロール | ⌃PageUp | Ctrl+Up |
| `scrollPageDown` | 1 ページ下にスクロール | ⌘PageDown | Alt+PageDown |
| `scrollPageUp` | 1 ページ上にスクロール | ⌘PageUp | Alt+PageUp |
| `editor.fold` | 範囲を折りたたむ | ⌥⌘[ | Ctrl+Shift+[ |
| `editor.unfold` | 範囲を展開 | ⌥⌘] | Ctrl+Shift+] |
| `editor.toggleFold` | 折りたたみトグル | ⌘K ⌘L | Ctrl+K Ctrl+L |
| `editor.foldRecursively` | サブ範囲を再帰的に折りたたむ | ⌘K ⌘[ | Ctrl+K Ctrl+[ |
| `editor.unfoldRecursively` | サブ範囲を再帰的に展開 | ⌘K ⌘] | Ctrl+K Ctrl+] |
| `editor.foldAll` | すべて折りたたむ | ⌘K ⌘0 | Ctrl+K Ctrl+0 |
| `editor.unfoldAll` | すべて展開 | ⌘K ⌘J | Ctrl+K Ctrl+J |
| `editor.action.addCommentLine` | 行コメントを追加 | ⌘K ⌘C | Ctrl+K Ctrl+C |
| `editor.action.removeCommentLine` | 行コメントを削除 | ⌘K ⌘U | Ctrl+K Ctrl+U |
| `editor.action.commentLine` | 行コメントをトグル | ⌘/ | Ctrl+/ |
| `editor.action.blockComment` | ブロックコメントをトグル | ⇧⌥A | Shift+Alt+A / Ctrl+Shift+A |
| `actions.find` | 検索 | ⌘F | Ctrl+F |
| `editor.action.startFindReplaceAction` | 置換 | ⌥⌘F | Ctrl+H |
| `editor.action.nextMatchFindAction` | 次を検索 | Enter | Enter |
| `editor.action.previousMatchFindAction` | 前を検索 | ⇧Enter | Shift+Enter |
| `editor.action.selectAllMatches` | 一致をすべて選択 | ⌥Enter | Alt+Enter |
| `toggleFindCaseSensitive` | 大文字小文字を区別 | ⌥⌘C | Alt+C |
| `toggleFindRegex` | 正規表現 | ⌥⌘R | Alt+R |
| `toggleFindWholeWord` | 単語単位 | ⌥⌘W | Alt+W |
| `editor.action.toggleTabFocusMode` | Tab でフォーカス移動をトグル | ⌃⇧M | Ctrl+M |
| `editor.action.toggleWordWrap` | 折り返しをトグル | ⌥Z | Alt+Z |

### 3.2 リッチ言語編集

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `editor.action.triggerSuggest` | 候補を表示 | ⌃Space | Ctrl+Space |
| `editor.action.triggerParameterHints` | パラメータヒントを表示 | ⇧⌘Space | Ctrl+Shift+Space |
| `editor.action.formatDocument` | ドキュメントをフォーマット | ⇧⌥F | Shift+Alt+F / Ctrl+Shift+I |
| `editor.action.formatSelection` | 選択範囲をフォーマット | ⌘K ⌘F | Ctrl+K Ctrl+F |
| `editor.action.revealDefinition` | 定義へ移動 | F12 | F12 |
| `editor.action.showHover` | ホバーを表示 | ⌘K ⌘I | Ctrl+K Ctrl+I |
| `editor.action.peekDefinition` | 定義を Peek | ⌥F12 | Alt+F12 / Ctrl+Shift+F10 |
| `editor.action.revealDefinitionAside` | 定義を横に開く | ⌘K F12 | Ctrl+K F12 |
| `editor.action.quickFix` | クイックフィックス | ⌘. | Ctrl+. |
| `editor.action.goToReferences` | 参照へ移動 | ⇧F12 | Shift+F12 |
| `editor.action.rename` | シンボル名を変更 | F2 | F2 |
| `editor.action.inPlaceReplace.down` | 次の値で置換 | ⇧⌘. | Ctrl+Shift+. |
| `editor.action.inPlaceReplace.up` | 前の値で置換 | ⇧⌘, | Ctrl+Shift+, |
| `editor.action.smartSelect.expand` | AST 選択を拡大 | ⌃⇧⌘→ | Shift+Alt+Right |
| `editor.action.smartSelect.shrink` | AST 選択を縮小 | ⌃⇧⌘← | Shift+Alt+Left |
| `editor.action.trimTrailingWhitespace` | 末尾空白を削除 | ⌘K ⌘X | Ctrl+K Ctrl+X |
| `workbench.action.editor.changeLanguageMode` | 言語モードを変更 | ⌘K M | Ctrl+K M |

### 3.3 ナビゲーション

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `workbench.action.showAllSymbols` | 全シンボルを表示 | ⌘T | Ctrl+T |
| `workbench.action.gotoLine` | 行へ移動 | ⌃G | Ctrl+G |
| `workbench.action.quickOpen` | クイックオープン / ファイルへ | ⌘P | Ctrl+P |
| `workbench.action.gotoSymbol` | シンボルへ | ⇧⌘O | Ctrl+Shift+O |
| `workbench.actions.view.problems` | 問題を表示 | ⇧⌘M | Ctrl+Shift+M |
| `editor.action.marker.nextInFiles` | 次のエラー/警告 | F8 | F8 |
| `editor.action.marker.prevInFiles` | 前のエラー/警告 | ⇧F8 | Shift+F8 |
| `workbench.action.showCommands` | すべてのコマンドを表示 | ⇧⌘P / F1 | Ctrl+Shift+P / F1 |
| `workbench.action.quickOpenPreviousRecentlyUsedEditorInGroup` | エディタグループ履歴 | ⌃Tab | Ctrl+Tab |
| `workbench.action.navigateBack` | 戻る | ⌃- | Alt+Left / Ctrl+Alt+- |
| `workbench.action.quickInputBack` | クイック入力で戻る | ⌃- | Alt+Left / Ctrl+Alt+- |
| `workbench.action.navigateForward` | 進む | ⌃⇧- | Alt+Right / Ctrl+Shift+- |
| `breadcrumbs.focus` | パンくずリストにフォーカス | ⇧⌘; | Ctrl+Shift+; |
| `breadcrumbs.focusAndSelect` | パンくずをフォーカスして選択 | ⇧⌘. | Ctrl+Shift+. |

### 3.4 エディタ/ウィンドウ管理

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `workbench.action.newWindow` | 新しいウィンドウ | ⇧⌘N | Ctrl+Shift+N |
| `workbench.action.closeWindow` | ウィンドウを閉じる | ⌘W | Alt+F4 |
| `workbench.action.closeActiveEditor` | エディタを閉じる | ⌘W | Ctrl+F4 / Ctrl+W |
| `workbench.action.closeFolder` | フォルダを閉じる | ⌘K F | Ctrl+K F |
| `workbench.action.splitEditor` | エディタを分割 | ⌘\ | Ctrl+\ |
| `workbench.action.focusFirstEditorGroup` | 1 番目のエディタグループ | ⌘1 | Ctrl+1 |
| `workbench.action.focusSecondEditorGroup` | 2 番目のエディタグループ | ⌘2 | Ctrl+2 |
| `workbench.action.focusThirdEditorGroup` | 3 番目のエディタグループ | ⌘3 | Ctrl+3 |
| `workbench.action.focusLeftGroup` | 左のグループ | ⌘K ⌘← | Ctrl+K Ctrl+Left |
| `workbench.action.focusRightGroup` | 右のグループ | ⌘K ⌘→ | Ctrl+K Ctrl+Right |
| `workbench.action.moveEditorLeftInGroup` | エディタを左に移動 | ⌘K ⇧⌘← | Ctrl+Shift+PageUp |
| `workbench.action.moveEditorRightInGroup` | エディタを右に移動 | ⌘K ⇧⌘→ | Ctrl+Shift+PageDown |
| `workbench.action.moveActiveEditorGroupLeft` | アクティブグループを左に | ⌘K ← | Ctrl+K Left |
| `workbench.action.moveActiveEditorGroupRight` | アクティブグループを右に | ⌘K → | Ctrl+K Right |
| `workbench.action.moveEditorToNextGroup` | エディタを次のグループへ | ⌃⌘→ | Ctrl+Alt+Right |
| `workbench.action.moveEditorToPreviousGroup` | エディタを前のグループへ | ⌃⌘← | Ctrl+Alt+Left |

### 3.5 ファイル管理

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `workbench.action.files.newUntitledFile` | 新規ファイル | ⌘N | Ctrl+N |
| `workbench.action.files.openFile` | ファイルを開く | ⌘O | Ctrl+O |
| `workbench.action.files.save` | 保存 | ⌘S | Ctrl+S |
| `saveAll` | すべて保存 | ⌥⌘S | Ctrl+K S |
| `workbench.action.files.saveAs` | 名前を付けて保存 | ⇧⌘S | Ctrl+Shift+S |
| `workbench.action.closeEditorsInGroup` | グループを閉じる | ⌘K W | Ctrl+K W |
| `workbench.action.closeAllEditors` | すべて閉じる | ⌘K ⌘W | Ctrl+K Ctrl+W |
| `workbench.action.reopenClosedEditor` | 閉じたエディタを再度開く | ⇧⌘T | Ctrl+Shift+T |
| `workbench.action.keepEditor` | 開いたままにする | ⌘K Enter | Ctrl+K Enter |
| `workbench.action.files.copyPathOfActiveFile` | アクティブファイルのパスをコピー | ⌘K P | Ctrl+K P |
| `workbench.action.files.revealActiveFileInWindows` | OS でファイルを表示 | ⌘K R | Ctrl+K R |

### 3.6 表示

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `workbench.action.toggleFullScreen` | フルスクリーン | ⌃⌘F | F11 |
| `workbench.action.toggleZenMode` | Zen モード | ⌘K Z | Ctrl+K Z |
| `workbench.action.exitZenMode` | Zen モードを終了 | Escape Escape | Escape Escape |
| `workbench.action.zoomIn` | ズームイン | ⌘= | Ctrl+= |
| `workbench.action.zoomOut` | ズームアウト | ⌘- | Ctrl+- |
| `workbench.action.zoomReset` | ズームリセット | ⌘Numpad0 | Ctrl+Numpad0 |
| `workbench.action.toggleSidebarVisibility` | サイドバーの表示/非表示 | ⌘B | Ctrl+B |
| `workbench.view.explorer` | エクスプローラー | ⇧⌘E | Ctrl+Shift+E |
| `workbench.view.search` | 検索 | ⇧⌘F | Ctrl+Shift+F |
| `workbench.view.scm` | ソース管理 | ⌃⇧G | Ctrl+Shift+G |
| `workbench.view.debug` | 実行とデバッグ | ⇧⌘D | Ctrl+Shift+D |
| `workbench.view.extensions` | 拡張機能 | ⇧⌘X | Ctrl+Shift+X |
| `workbench.action.output.toggleOutput` | 出力 | ⇧⌘U | Ctrl+Shift+U / Ctrl+K Ctrl+H |
| `workbench.action.quickOpenView` | ビューのクイックオープン | ⌃Q | Ctrl+Q |
| `workbench.action.terminal.openNativeConsole` | 外部ターミナルを開く | ⇧⌘C | Ctrl+Shift+C |
| `markdown.showPreview` | Markdown プレビュー | ⇧⌘V | Ctrl+Shift+V |
| `markdown.showPreviewToSide` | 横にプレビュー | ⌘K V | Ctrl+K V |
| `workbench.action.terminal.toggleTerminal` | 統合ターミナル | ⌃` | Ctrl+` |

### 3.7 検索

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `workbench.action.replaceInFiles` | ファイル内で置換 | ⇧⌘H | Ctrl+Shift+H |
| `toggleSearchCaseSensitive` | 大文字小文字を区別 | ⌥⌘C | Alt+C |
| `toggleSearchWholeWord` | 単語単位 | ⌥⌘W | Alt+W |
| `toggleSearchRegex` | 正規表現 | ⌥⌘R | Alt+R |
| `workbench.action.search.toggleQueryDetails` | 検索の詳細をトグル | ⇧⌘J | Ctrl+Shift+J |
| `search.action.focusNextSearchResult` | 次の検索結果 | F4 | F4 |
| `search.action.focusPreviousSearchResult` | 前の検索結果 | ⇧F4 | Shift+F4 |
| `history.showNext` | 次の検索語 | ↓ | Down |
| `history.showPrevious` | 前の検索語 | ↑ | Up |
| `search.action.openInEditor` | 結果をエディタで開く | ⌘Enter | Alt+Enter |
| `search.action.focusQueryEditorWidget` | 検索エディタにフォーカス | Escape | Escape |
| `rerunSearchEditorSearch` | 再検索 | ⇧⌘R | Ctrl+Shift+R |
| `search.searchEditor.action.deleteFileResults` | ファイル結果を削除 | ⇧⌘Backspace | Ctrl+Shift+Backspace |

### 3.8 設定

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `workbench.action.openSettings` | 設定を開く | ⌘, | Ctrl+, |
| `workbench.action.openGlobalKeybindings` | キーボードショートカットを開く | ⌘K ⌘S | Ctrl+K Ctrl+S |
| `workbench.action.selectTheme` | テーマを選択 | ⌘K ⌘T | Ctrl+K Ctrl+T |

### 3.9 チャット（VSCode 組み込み）

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `workbench.action.chat.open` | チャットビューを開く | ⌃⌘I | Ctrl+Alt+I |
| `workbench.action.chat.openagent` | エージェントモードでチャットを開く | ⇧⌘I | Ctrl+Shift+I / Ctrl+Shift+Alt+I |
| `inlineChat.start` | エディタインラインチャット | ⌘I | Ctrl+I |
| `workbench.action.terminal.chat.start` | ターミナルインラインチャット | ⌘I | Ctrl+I |
| `workbench.action.quickchat.toggle` | クイックチャット | ⇧⌥⌘L | Ctrl+Shift+Alt+L |
| `workbench.action.chat.openModePicker` | モードピッカー | ⌘. | Ctrl+. |
| `workbench.action.chat.openModelPicker` | 言語モデルピッカー | ⌥⌘. | Ctrl+Alt+. |
| `workbench.action.chat.newChat` | 新しいチャット | ⌘N | Ctrl+N |
| `editor.action.inlineSuggest.commit` | インライン提案を適用 | Tab | Tab |

### 3.10 デバッグ

| コマンド ID | 内容 | キー |
|-------------|------|------|
| `editor.debug.action.toggleBreakpoint` | ブレークポイントのトグル | F9 |
| `workbench.action.debug.start` | デバッグ開始 | F5 |
| `workbench.action.debug.continue` | 続行 | F5 |
| `workbench.action.debug.run` | デバッグなしで実行 | ⌃F5 / Ctrl+F5 |
| `workbench.action.debug.pause` | 一時停止 | F6 |
| `workbench.action.debug.stepInto` | ステップイン | F11 |

### 3.11 タスク

| コマンド ID | 内容 | キー (macOS) | キー (Win/Linux) |
|-------------|------|--------------|------------------|
| `workbench.action.tasks.build` | ビルドタスクを実行 | ⇧⌘B | Ctrl+Shift+B |

---

## 4. 補足

- **全コマンドの確認方法**: コマンドパレット（`workbench.action.showCommands`）で「Preferences: Open Default Keyboard Shortcuts (JSON)」を実行すると、デフォルトのキーバインドと未割り当てコマンドのコメント一覧が確認できる。
- **Cursor と VSCode の差異**: Cursor は VSCode をベースにしているため、上記 VSCode コマンドは基本的に利用可能。AI チャット・Composer・スラッシュコマンド・@ 参照などは Cursor 固有。
- **カスタムキーバインド**: `keybindings.json` で任意のコマンドにキーを割り当て可能。

---

Created: 2026-02-24  
Generated by: Cursor IDE リバースエンジニアリング（公式ドキュメント・VSCode API リファレンス・デフォルトキーバインド参照）
