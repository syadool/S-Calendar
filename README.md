# 学生向けカレンダーアプリ

時間割とバイトシフトを管理し、空き時間を自動提案する学生向けWebカレンダーアプリ。

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **バックエンド**: Next.js API Routes (Route Handlers)
- **データベース**: PostgreSQL + Prisma ORM
- **認証**: NextAuth.js v4
- **OCR**: Tesseract.js

## 主な機能

### Phase 1: 認証
- メール/パスワード認証
- Google OAuth（オプション）
- セッション管理

### Phase 2: カレンダー表示
- 週ビュー・日ビュー・月ビューの切り替え
- 授業とシフトの統合表示
- レスポンシブ対応

### Phase 3: 授業・シフト管理
- 授業（時間割）のCRUD
- シフトのCRUD
- 時限設定のカスタマイズ

### Phase 4: OCR機能
- 時間割表の画像アップロード
- シフト表の画像アップロード
- OCR結果の確認・修正・一括登録

### Phase 5: 空き時間提案
- 指定期間内の空き時間を自動計算
- 最小時間のフィルタリング
- 空き時間の一覧表示

## セットアップ手順

### 1. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成し、以下の変数を設定してください。

```bash
cp .env.example .env
```

#### 必須項目

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/student_calendar?schema=public"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here-generate-with-openssl-rand-base64-32"
```

#### オプション（Google OAuth を使用する場合）

```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

**NEXTAUTH_SECRET の生成方法**:
```bash
openssl rand -base64 32
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. データベースのセットアップ

#### PostgreSQL の準備

ローカルまたはクラウド（Supabase、Railway など）で PostgreSQL データベースを用意してください。

#### Prisma マイグレーション

```bash
npx prisma migrate dev --name init
```

#### Prisma Client の生成

```bash
npx prisma generate
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## プロジェクト構成

```
student-calendar/
├── prisma/
│   └── schema.prisma          # Prismaスキーマ
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # 認証ページ（ログイン・登録）
│   │   ├── (dashboard)/      # 認証後のページ
│   │   │   ├── calendar/     # カレンダー
│   │   │   ├── timetable/    # 時間割管理
│   │   │   ├── shifts/       # シフト管理
│   │   │   ├── free-time/    # 空き時間
│   │   │   └── settings/     # 設定
│   │   ├── api/              # API Routes
│   │   └── layout.tsx        # ルートレイアウト
│   ├── components/           # Reactコンポーネント
│   │   ├── ui/              # 汎用UIコンポーネント
│   │   ├── layout/          # ヘッダー、サイドバーなど
│   │   ├── auth/            # 認証関連
│   │   ├── calendar/        # カレンダー関連
│   │   ├── timetable/       # 時間割関連
│   │   ├── shifts/          # シフト関連
│   │   ├── ocr/             # OCR関連
│   │   └── free-time/       # 空き時間関連
│   ├── lib/                 # ユーティリティ
│   │   ├── prisma.ts        # Prisma Client
│   │   ├── auth.ts          # NextAuth設定
│   │   ├── date.ts          # 日付ユーティリティ
│   │   ├── utils.ts         # 汎用ユーティリティ
│   │   ├── validation.ts    # Zodバリデーション
│   │   ├── free-slots.ts    # 空き時間計算
│   │   └── ocr/             # OCR関連ロジック
│   ├── providers/           # Context Providers
│   └── types/               # 型定義
├── .env.example             # 環境変数テンプレート
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## API エンドポイント

### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/[...nextauth]` - NextAuth.js認証

### 授業（Course）
- `GET /api/courses` - 授業一覧取得
- `POST /api/courses` - 授業登録
- `PUT /api/courses/[id]` - 授業更新
- `DELETE /api/courses/[id]` - 授業削除
- `POST /api/courses/bulk` - 授業一括登録

### シフト（Shift）
- `GET /api/shifts` - シフト一覧取得
- `POST /api/shifts` - シフト登録
- `PUT /api/shifts/[id]` - シフト更新
- `DELETE /api/shifts/[id]` - シフト削除
- `POST /api/shifts/bulk` - シフト一括登録

### OCR
- `POST /api/ocr/timetable` - 時間割OCR
- `POST /api/ocr/shift` - シフトOCR

### 空き時間
- `GET /api/free-slots` - 空き時間取得

### 設定
- `GET /api/settings/periods` - 時限設定取得
- `PUT /api/settings/periods` - 時限設定更新

## デプロイ

### Vercel へのデプロイ

1. Vercel アカウントを作成
2. GitHub リポジトリと連携
3. 環境変数を設定（DATABASE_URL、NEXTAUTH_SECRET など）
4. デプロイ

### データベース（Supabase）

1. [Supabase](https://supabase.com) でプロジェクト作成
2. PostgreSQL の接続文字列を取得
3. `.env` の `DATABASE_URL` に設定
4. `npx prisma migrate deploy` でマイグレーション実行

## 開発

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm start

# Lintチェック
npm run lint

# Prisma Studio（データベースGUI）
npx prisma studio
```

## ライセンス

MIT
