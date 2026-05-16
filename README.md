# 学生向けカレンダーアプリ

Firebase Authentication + Cloud Firestore を使った学生向け Web カレンダーアプリ。

## 機能

- **認証**: Firebase Authentication（Email/Password + Google OAuth）
- **カレンダー**: 予定（Event）の CRUD と 日 / 週 / 月 ビュー
- **空き時間検索**: 期間 × 1 日内時間帯 × 最小時間で空きスロットを算出
- **シフト連携（オプション）**: 外部シフト API からシフトを取得し、カレンダー上に読み取り専用でマージ表示

## 技術スタック

| レイヤー | 採用 |
|---|---|
| フロントエンド | Next.js 14（App Router）+ TypeScript + Tailwind CSS |
| API | Next.js Route Handlers（Node ランタイム） |
| 認証 | Firebase Authentication（client SDK + Admin SDK） |
| DB | Cloud Firestore |
| 日付 | date-fns 3.x |
| 入力検証 | zod 3.x |
| テスト | vitest |

## セットアップ手順

### 1. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、各変数を設定してください。

```bash
cp .env.local.example .env.local
```

#### 必須項目

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase JS SDK |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase JS SDK |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase JS SDK |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase JS SDK |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase JS SDK |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase JS SDK |
| `FIREBASE_PROJECT_ID` | Admin SDK（サーバーのみ） |
| `FIREBASE_CLIENT_EMAIL` | Admin SDK サービスアカウント |
| `FIREBASE_PRIVATE_KEY` | Admin SDK 秘密鍵（`\n` を含む文字列） |

#### オプション

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SHIFT_API_BASE` | 外部シフト API のベース URL。未設定でシフト連携 OFF |

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. Firestore の設定

```bash
# セキュリティルールのデプロイ
npm run firebase:rules

# インデックスのデプロイ
npm run firebase:indexes
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## スクリプト

```bash
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm start            # 本番サーバー起動
npm run lint         # Lint チェック
npm test             # ユニットテスト（vitest）
npm run firebase:rules    # Firestore ルールデプロイ
npm run firebase:indexes  # Firestore インデックスデプロイ
```

## API エンドポイント

すべて `Authorization: Bearer <Firebase ID Token>` 必須。

| メソッド | パス | 概要 |
|---|---|---|
| `GET` | `/api/events?startDate=&endDate=` | 範囲指定でイベント一覧 |
| `POST` | `/api/events` | イベント作成 |
| `PUT` | `/api/events/[id]` | イベント部分更新 |
| `DELETE` | `/api/events/[id]` | イベント削除 |
| `GET` | `/api/free-slots?startDate=&endDate=&dayStart=&dayEnd=&minDuration=` | 空き時間算出 |

## ライセンス

MIT
