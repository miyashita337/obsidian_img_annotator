# Obsidian Image Annotator - 開発ステータス

## 概要
Obsidian上でSkitch/Flameshot相当の画像注釈機能を実現するコミュニティプラグイン。

## リポジトリ情報
- **リポジトリ**: `git@github.com:miyashita337/obsidian_img_annotator.git`
- **対象Vault**: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/my-vault`
- **AC（受け入れ基準）**: `my-vault/test/Obsidian画像エディタプラグイン企画/` 内、および前セッションのプランに定義済み

## 完了済み作業

### プロジェクト基盤
- [x] `package.json` / `tsconfig.json` / `esbuild.config.mjs` セットアップ
- [x] `manifest.json`（`isDesktopOnly: true`、審査準拠フォーマット）
- [x] `.gitignore`（node_modules, main.js, data.json）
- [x] npm install / ビルド通過確認（`main.js` 33KB）

### ソースコード（src/）
| ファイル | 内容 | 対応AC |
|---|---|---|
| `types.ts` | 型定義（Annotation, Point, ToolType, EditorState, PRESET_COLORS 6色） | AC-CORE-04 |
| `history.ts` | Undo/Redo管理（コマンドパターン、add/remove/move対応） | AC-CORE-07 |
| `renderer.ts` | Canvas描画（矩形枠・矢印・テキスト・モザイク・ヒットテスト・選択ハイライト） | AC-CORE-01〜06 |
| `editor-modal.ts` | メインUI（フローティングモーダル・ツールバー・マウス/キーボード・PNG保存） | AC-UI-01〜05, AC-CORE-08〜09 |
| `main.ts` | プラグインエントリポイント（コマンド登録・画像検出・クリップボード・コンテキストメニュー） | AC-UI-02〜04 |
| `styles.css` | テーマ追従スタイル（CSS変数ベース、ダーク/ライト対応） | AC-COMPAT-01 |

### テスト
- [x] `src/__tests__/history.test.ts` — HistoryManager 9テスト
- [x] `src/__tests__/types.test.ts` — types 5テスト
- [x] 全14テスト Pass

### AC対応状況サマリー
| 優先度 | 実装状況 |
|---|---|
| **P0（16件）** | コード作成済み。**未テスト**（Obsidian実機での手動テスト未実施） |
| **P1（3件）** | キーボードショートカット実装済み（R/A/T/M/Ctrl+Z/Ctrl+S/Delete/Escape） |
| **P2（9件）** | manifest.json準拠・isDesktopOnly設定済み。残りはリリース時対応 |

## 未完了・次にやること

### 1. Obsidian実機テスト（最優先）
プラグインをObsidianにインストールして手動テストする。

```bash
# symlinkでObsidianのplugins/に配置
ln -s ~/obsidian_img_annotator ~/.obsidian/plugins/image-annotator
# または ビルド成果物だけをコピー
```

**テスト項目チェックリスト:**
- [ ] コマンドパレットから起動できる
- [ ] 既存画像（`![[image.png]]`）をカーソル位置から開ける
- [ ] クリップボード画像を読み込める
- [ ] 矩形枠が描画できる
- [ ] 矢印が描画できる（arrowhead付き）
- [ ] テキストが配置できる（日本語・英語）
- [ ] モザイクが適用できる
- [ ] 色選択が反映される（6色）
- [ ] オブジェクトの選択・移動・削除ができる
- [ ] Undo/Redo（Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z）
- [ ] PNG保存（元ファイル上書き）
- [ ] 保存後にエディタが閉じ、履歴がクリアされる
- [ ] ダークテーマ・ライトテーマで表示が崩れない
- [ ] 画像読み込み1秒以内（1920x1080）
- [ ] 描画がスムーズ（体感60fps）
- [ ] 右クリックコンテキストメニューから起動できる

### 2. バグ修正・改善（実機テスト後に判明する見込み）
- [x] moveAnnotation の履歴記録が不完全 → **修正済み**: ドラッグ終了時にmoveStartStateを保存し、onMouseUpで1回だけhistory.push
- [x] テキスト入力のblurイベントでダブルコミットの可能性 → **修正済み**: isCommittingTextフラグで二重実行防止、cloneNode tricksを除去
- [x] `app://` URLからのファイル解決ロジックの検証 → **改善済み**: ファイル名によるvault全体フォールバック検索を追加
- [ ] PNG出力サイズ最適化（AC-PERF-04: 元画像の1.5倍以内）

### 3. 追加テスト
- [x] renderer.ts のユニットテスト（Canvas mockが必要） → **追加済み**: 22テスト（clear, drawImage, drawAnnotations, drawMosaic, drawPreview, hitTest）
- [ ] editor-modal.ts の統合テスト

### 4. P2対応（コミュニティ審査向け）
- [ ] AC-RELEASE-02: GitHub Releaseにmain.js, manifest.json, styles.cssアップロード
- [ ] AC-RELEASE-03: README.md（英語、目的・使い方・スクリーンショット）
- [x] AC-RELEASE-04: MITライセンスファイル → **作成済み**
- [x] AC-RELEASE-05: 外部リソース非依存の確認 → **確認済み**: 外部CDN・API依存なし
- [x] AC-RELEASE-06: トラッキング非実装の確認 → **確認済み**: テレメトリ・アナリティクスなし
- [x] AC-RELEASE-07: onunload()のクリーンアップ検証 → **修正済み**: 未使用のeventRefs手動クリーンアップを削除、Plugin基底クラスの自動クリーンアップに依存
- [ ] AC-COMPAT-02: Windows/Linux動作確認
- [x] AC-COMPAT-03: manifest.jsonのisDesktopOnly確認（済）

### 5. GitHub Issue管理
- [ ] 親Issue作成
- [ ] AC-CORE / AC-UI / AC-PERF / AC-COMPAT / AC-RELEASE をsub-issueに分解

## ビルド・テストコマンド

```bash
npm install          # 依存関係インストール
npm run build        # 本番ビルド（tsc + esbuild）
npm run dev          # 開発モード（watch）
npm test             # ユニットテスト（vitest）
npm run test:watch   # テストwatch
```

## アーキテクチャ

```
src/
├── main.ts          # Plugin entrypoint（コマンド登録・画像解決）
├── editor-modal.ts  # ImageEditorModal（UI・イベント・保存）
├── renderer.ts      # Renderer（Canvas描画・ヒットテスト）
├── history.ts       # HistoryManager（Undo/Redo）
├── types.ts         # 型定義・定数
└── __tests__/       # ユニットテスト
```

**データフロー**: `main.ts` → 画像取得 → `ImageEditorModal` 起動 → `Renderer` で描画 → `HistoryManager` で操作記録 → 保存時にCanvas合成 → vault書き込み
