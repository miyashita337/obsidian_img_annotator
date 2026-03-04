# Obsidian Image Annotator - Project Instructions

## Project Overview
Obsidian上でSkitch/Flameshot相当の画像注釈機能を実現するコミュニティプラグイン。

## Architecture
```
src/
├── main.ts          # Plugin entrypoint（コマンド登録・画像解決）
├── editor-modal.ts  # ImageEditorModal（UI・イベント・保存）
├── renderer.ts      # Renderer（Canvas描画・ヒットテスト）
├── history.ts       # HistoryManager（Undo/Redo）
├── types.ts         # 型定義・定数
└── __tests__/       # ユニットテスト
```

## Commands
```bash
npm install          # 依存関係インストール
npm run build        # 本番ビルド（tsc + esbuild）
npm run dev          # 開発モード（watch）
npm test             # ユニットテスト（vitest）
npm run test:watch   # テストwatch
```

## Autonomous Work Rules (夜間作業モード)
- ユーザーに質問する前にAgentTeamsに相談する
- 3回同じ失敗をしたらAgentTeamsで相談（PM, senior engineer, backend engineer, frontend engineer, QA engineer, LLM engineer, UI designer）
- git push / GitHub操作 / ユーザー承認が必要な操作は実行しない
- コード変更・テスト追加・バグ修正・ローカルファイル作成は自律的に進めてよい

## Known Issues
- moveAnnotation の履歴記録が不完全（ドラッグ終了時に1回だけmoveを記録する処理が未実装）
- テキスト入力のblurイベントでダブルコミットの可能性（removeTextInputで対策したが要確認）
- `app://` URLからのファイル解決ロジックの検証
