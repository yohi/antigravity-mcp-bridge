# Antigravity IDE Command List

Antigravity IDE (VS Code Fork) における、Antigravity 特有のコマンドおよび標準的な VS Code コマンドのリストです。

## 1. Antigravity 特有のコマンド (Antigravity Specific Commands)

これらのコマンドは Google Antigravity IDE に独自に実装されている、またはフォーク時に追加された AI 機能やシステム連携に関するものです。

### 1.1 AI Agent & Cascade (AI エージェント・ Cascade 機能)
| コマンド ID | 内容 (Title) |
| :--- | :--- |
| `antigravity.sendPromptToAgentPanel` | エージェントパネルにプロンプトを送信 |
| `antigravity.agent.acceptAgentStep` | エージェントの提案を承認 |
| `antigravity.agent.rejectAgentStep` | エージェントの提案を却下 |
| `antigravity.prioritized.chat.open` | 優先チャットを開く |
| `antigravity.prioritized.chat.openNewConversation` | 新規会話を優先チャットで開始 |
| `antigravity.startNewConversation` | 新規会話の開始 |
| `antigravity.openConversationPicker` | 会話ピッカーを開く |
| `antigravity.executeCascadeAction` | Cascade アクションの実行 |
| `antigravity.explainAndFixProblem` | 問題の説明と修正を行なう |
| `antigravity.generateCommitMessage` | コミットメッセージの生成 |
| `antigravity.command.accept` | コマンドの承認 |
| `antigravity.command.reject` | コマンドの却下 |

### 1.2 IDE & System Management (システム・設定管理)
| コマンド ID | 内容 (Title) |
| :--- | :--- |
| `antigravity.login` | IDE にログイン |
| `antigravity.loginWithAuthToken` | 認証トークンでログイン (バックアップ) |
| `antigravity.importVSCodeSettings` | VS Code の設定をインポート |
| `antigravity.importVSCodeExtensions` | VS Code の拡張機能をインポート |
| `antigravity.importCursorSettings` | Cursor の設定をインポート |
| `antigravity.importWindsurfSettings` | Windsurf の設定をインポート |
| `antigravity.copyApiKey` | API キーをクリップボードにコピー |
| `antigravity.reloadWindow` | ウィンドウの再読み込み |
| `antigravity.restartLanguageServer` | 言語サーバーの再起動 |
| `antigravity.downloadDiagnostics` | 診断情報のダウンロード |

### 1.3 UI & Experience (UI 操作・体験)
| コマンド ID | 内容 (Title) |
| :--- | :--- |
| `antigravity.openBrowser` | ブラウザを開く |
| `antigravity.showLaunchpad` | ローンチパッドを表示 |
| `antigravity.toggleChatFocus` | チャットフォーカスの切り替え |
| `antigravity.openDiffView` | 差分表示を開く |
| `antigravity.showBrowserAllowlist` | ブラウザの許可リストを表示 |
| `antigravity.openChangeLog` | チェンジログを開く |

### 1.4 その他のコマンド (Other Antigravity Commands)
- `antigravity.google.sshToCloudtop`
- `antigravity.mcpConfigFileInfoWidget`
- `antigravity.pollMcpServerStates`
- `antigravity.unleashService`
- `antigravity.updateTerminalLastCommand`
- `browserLauncher.launchBrowser`
- `antigravity-code-executor.executeCode`

---

## 2. VS Code 標準コマンド (Standard VS Code Commands)

Antigravity は VS Code のフォークであるため、以下の標準的なコマンドも全て利用可能です。
(数千件あるため、主要なカテゴリの抜粋です)

### 2.1 Workbench & UI
- `workbench.action.openSettings`: 設定を開く
- `workbench.action.openGlobalKeybindings`: キーバインドを開く
- `workbench.action.quickOpen`: クイックオープン
- `workbench.action.showCommands`: コマンドパレットを表示
- `workbench.action.terminal.toggleTerminal`: ターミナルの切り替え
- `workbench.action.reloadWindow`: ウィンドウのリロード

### 2.2 File & Explorer
- `file.newFile`: 新規ファイル
- `file.save`: 保存
- `workbench.view.explorer`: エクスプローラー表示

### 2.3 Editor & Text
- `editor.action.formatDocument`: ドキュメントの整形
- `editor.action.quickFix`: クイックフィックス
- `editor.action.rename`: 名前変更
- `editor.action.showHover`: ホバー表示

### 2.4 Git & Source Control
- `git.commit`: コミット
- `git.push`: プッシュ
- `git.pull`: プル
- `git.branch`: ブランチ作成

---

## 3. 全ての Antigravity コマンド一覧 (Raw List)

以下は、バイナリおよび拡張機能の解析により抽出された全ての `antigravity.` プレフィックスを持つコマンドIDです。

<details>
<summary>クリックして展開</summary>

```text
antigravity.JetskiFullScreenViewController
antigravity.PerformanceMonitoring
antigravity.RerenderFrequencyAlerts
antigravity.SignInToAntigravity
antigravity.acceptCompletion
antigravity.action.
antigravity.agent.acceptAgentStep
antigravity.agent.manageAnnotations
antigravity.agent.rejectAgentStep
antigravity.agentBarVisible
antigravity.agentPanel
antigravity.agentSidePanel
antigravity.agentSidePanelInputBox
antigravity.agentViewContainerId
antigravity.antigravityFileDragAndDrop
antigravity.antigravityReviewChangesEditor
antigravity.antigravityReviewChangesEditorInput
antigravity.appIconCustomization
antigravity.artifacts.startComment
antigravity.artifactsEditorInput
antigravity.bottomBar
antigravity.browserFeatureEnabled
antigravity.canAcceptOrRejectAllAgentEditsInFile
antigravity.canAcceptOrRejectCommand
antigravity.canAcceptOrRejectFocusedHunk
antigravity.canResetOnboarding
antigravity.canTriggerTerminalCommandAction
antigravity.cancelGenerateCommitMessage
antigravity.cancelLogin
antigravity.cancelSnoozeAutocomplete
antigravity.cascadeBar
antigravity.cascadeStarterPrompt
antigravity.cascadeState
antigravity.clearAndDisableTracing
antigravity.closeAllDiffZones
antigravity.command.accept
antigravity.command.reject
antigravity.commandPopupDocker
antigravity.createGlobalWorkflow
antigravity.createRule
antigravity.createWorkflow
antigravity.customAppIcon.nux
antigravity.customCompletionShown
antigravity.customTrusted
antigravity.customizeAppIcon
antigravity.debugInfoWidget
antigravity.debugInfoWidget.collapseState
antigravity.diff.insertionText
antigravity.disableAutocomplete
antigravity.downloadDiagnostics
antigravity.editorModeSettings
antigravity.enableAgentMode
antigravity.enableAutocomplete
antigravity.enableTracing
antigravity.executeCascadeAction
antigravity.explainAndFixProblem
antigravity.finishIDESetup
antigravity.forceSupercomplete
antigravity.generateCommitMessage
antigravity.getBrowserOnboardingPort
antigravity.getCascadePluginTemplate
antigravity.getDiagnostics
antigravity.getManagerTrace
antigravity.getWorkbenchTrace
antigravity.globalArtifactsEditorInput
antigravity.google
antigravity.google.exec
antigravity.google.sshToCloudtop
antigravity.handleAuthRefresh
antigravity.handleDiffZoneEdit
antigravity.hideFullScreenView
antigravity.hunkCompactnessPreference
antigravity.importAntigravityExtensions
antigravity.importAntigravitySettings
antigravity.importCiderSettings
antigravity.importCursorExtensions
antigravity.importCursorSettings
antigravity.importVSCodeExtensions
antigravity.importVSCodeRecentWorkspaces
antigravity.importVSCodeSettings
antigravity.initializeAgent
antigravity.inlayHint
antigravity.inlayHintsManager
antigravity.inlineSuggest.disableDebounce
antigravity.inlineTabToJumpWidget
antigravity.interactiveCascade.acceptSuggestedAction
antigravity.interactiveCascade.annotationsEnabled
antigravity.interactiveCascade.enabled
antigravity.interactiveCascade.focusEditIntent
antigravity.interactiveCascade.isCursorPosInSuggestedAction
antigravity.interactiveCascade.rejectSuggestedAction
antigravity.interactiveCascade.updateDisabled
antigravity.isAbleToCustomizeAppIcon
antigravity.isAgentModeInputBoxFocused
antigravity.isFileGitIgnored
antigravity.isGoogle3Workspace
antigravity.isGoogleInternal
antigravity.isInAgentModeView
antigravity.isNotTeamsNorEnterprise
antigravity.isRemoteSsh
antigravity.jetskiArtifactsEditor
antigravity.jetskiConversationPickerController
antigravity.jetskiGlobalArtifactsEditor
antigravity.languageServerService
antigravity.logObservabilityDataAction
antigravity.login
antigravity.manager.onboarding.reset
antigravity.markerHoverInlayHint
antigravity.marketplaceExtensionGalleryServiceURL
antigravity.marketplaceGalleryItemURL
antigravity.mcpConfigFileInfoWidget
antigravity.mcpConfigFileInfoWidget.collapseState
antigravity.migrateWindsurfSettings
antigravity.onShellCommandCompletion
antigravity.onboarding.reset
antigravity.openAgent
antigravity.openAntigravityCommand
antigravity.openBrowser
antigravity.openChangeLog
antigravity.openChatView
antigravity.openConfigurePluginsPage
antigravity.openConversationPicker
antigravity.openConversationWorkspaceQuickPick
antigravity.openCustomizationsTab
antigravity.openDiffView
antigravity.openDiffZones
antigravity.openDocs
antigravity.openDocumentation
antigravity.openGenericUrl
antigravity.openGlobalRules
antigravity.openInCiderAction
antigravity.openInteractiveEditor
antigravity.openIssueReporter
antigravity.openMcpConfigFile
antigravity.openMcpDocsPage
antigravity.openQuickSettingsPanel
antigravity.openReviewChanges
antigravity.openRulesEducationalLink
antigravity.openTroubleshooting
antigravity.playAudio
antigravity.playNote
antigravity.pollMcpServerStates
antigravity.prioritized
antigravity.prioritized.agentAcceptAllInFile
antigravity.prioritized.agentAcceptFocusedHunk
antigravity.prioritized.agentFocusNextFile
antigravity.prioritized.agentFocusNextHunk
antigravity.prioritized.agentFocusPreviousFile
antigravity.prioritized.agentFocusPreviousHunk
antigravity.prioritized.agentRejectAllInFile
antigravity.prioritized.agentRejectFocusedHunk
antigravity.prioritized.chat.open
antigravity.prioritized.chat.openNewConversation
antigravity.prioritized.command.open
antigravity.prioritized.explainProblem
antigravity.prioritized.interactiveCascade.debug
antigravity.prioritized.submitCodeAcknowledgement
antigravity.prioritized.supercompleteAccept
antigravity.prioritized.supercompleteEscape
antigravity.prioritized.tabJumpAccept
antigravity.prioritized.tabJumpEscape
antigravity.prioritized.terminalCommand.open
antigravity.profileUrl
antigravity.reloadWindow
antigravity.rendererStartupPerf
antigravity.restartLanguageServer
antigravity.restartUserStatusUpdater
antigravity.rulesFileInfoWidget
antigravity.rulesFileInfoWidget.collapseState
antigravity.searchMaxWorkspaceFileCount
antigravity.sendAnalyticsAction
antigravity.sendChatActionMessage
antigravity.sendPromptToAgentPanel
antigravity.sendTerminalToChat
antigravity.sendTerminalToSidePanel
antigravity.sendTextToChat
antigravity.setDiffZonesState
antigravity.setVisibleConversation
antigravity.setWorkingDirectories
antigravity.showAuthFailureFullScreenView
antigravity.showBrowserAllowlist
antigravity.showLanguageServerCrashFullScreenView
antigravity.showLanguageServerInitFailureFullScreenView
antigravity.showLaunchpad
antigravity.showManagedTerminal
antigravity.showSshDisconnectionFullScreenView
antigravity.sidecar.sendDiffZone
antigravity.snoozeAutocomplete
antigravity.soundManager
antigravity.startNewConversation
antigravity.switchBetweenWorkspaceAndAgent
antigravity.tabInfoWidget
antigravity.tabReporting
antigravity.tabToJump
antigravity.tabToJumpPointerWidget
antigravity.terminalCommand.accept
antigravity.terminalCommand.reject
antigravity.terminalCommand.run
antigravity.terminalSelectionNudge
antigravity.toggleChatFocus
antigravity.toggleDebugInfoWidget
antigravity.toggleManagerDevTools
antigravity.toggleRerenderFrequencyAlerts
antigravity.toggleSettingsDevTools
antigravity.trackBackgroundConversationCreated
antigravity.unleashService
antigravity.updateDebugInfoWidget
antigravity.updatePluginInstallationCount
antigravity.updateTerminalLastCommand
antigravity.uploadErrorAction
antigravity.useNewAgentSidePanel
```
</details>

---
Created at: 2026-02-24
Generated by: Antigravity IDE Reverse Engineering Agent
