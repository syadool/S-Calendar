# 学生向けカレンダーアプリ 設計書（slim 版 / rev.2）

> 旧仕様（時間割 courses / シフト管理 shifts / OCR）は実装から削除済み。
> 本書は **現状コードに整合する slim 版仕様** を、信頼境界・データモデル・API 契約・cleanup 対象まで一貫して規定する。
> 旧仕様の残骸（`firestore.indexes.json` / `firestore.rules` のコメント / `README.md` / `.env.local.example` の既定値 / `tesseract.js` 依存）は §13 cleanup 対象に列挙し、本文では扱わない。

---

## 1. スコープと非スコープ

### 1.1 機能スコープ

| カテゴリ | 機能 |
|---|---|
| 認証 | Firebase Authentication（Email/Password + Google OAuth） |
| カレンダー | ユーザーごとの予定（Event）の CRUD と日 / 週 / 月ビュー |
| 空き時間検索 | 期間 × 1 日内時間帯 × 最小時間で空きスロットを算出 |
| シフト連携（オプション） | 外部シフト API からシフトを取得し、カレンダー上に **読み取り専用** でマージ表示。`NEXT_PUBLIC_SHIFT_API_BASE` 未設定なら無効化 |

### 1.2 非スコープ（本リリースでは扱わない）

時間割（courses）/ シフト管理（shifts の作成・編集）/ OCR / プッシュ通知 / マルチデバイス Push 同期 / 共有・コラボ / Cookie セッション / SSR でのユーザー個別データ取得。

### 1.3 技術スタック

| レイヤー | 採用 |
|---|---|
| フロント | Next.js 14（App Router）+ TypeScript + Tailwind |
| API | Next.js Route Handlers（Node ランタイム） |
| 認証 | Firebase Authentication（client SDK + Admin SDK 検証） |
| DB | Cloud Firestore（**API 経由のみ**。クライアント直アクセス禁止） |
| サーバー SDK | `firebase-admin` 12.x |
| クライアント SDK | `firebase` 10.x |
| 日付 | `date-fns` 3.x |
| 入力検証 | `zod` 3.x |
| テスト | `vitest` |

---

## 2. アーキテクチャと信頼境界

### 2.1 信頼境界

```
[信頼境界 A: ブラウザ] -- 信頼しない（入力源） -- [信頼境界 B: Next.js サーバー] -- [信頼境界 C: Firebase]
```

- 境界 A→B: ブラウザは敵対的とみなす。サーバーは **すべての入力を Zod で検証** し、URL の `[id]` も `users/{uid}/events/{id}` パスに必ずバインドする。
- 境界 B→C: Admin SDK は Rules をバイパスする。よって **API 側で `users/{user.uid}/...` パス以外を絶対に参照しない** ことが第一防御線。Firestore Security Rules は二重防御。
- 境界 A→外部 Shift API: ブラウザから直接呼び出す（クライアント側オプション機能）。失敗・401・型不正は本体カレンダーを **絶対に壊さない**（フェイルセーフ）。

### 2.2 ランタイム境界

| ファイル | ランタイム | 役割 |
|---|---|---|
| `src/middleware.ts` | Edge | `/api/*` の `Authorization: Bearer` ヘッダの **存在のみ** をチェック（Token 検証はしない。Edge では `firebase-admin` が動かないため） |
| `src/app/api/**/route.ts` | Node | `withAuth` で `adminAuth.verifyIdToken` を実行し、Firestore Admin SDK でアクセス |
| `src/lib/firebase-client.ts` | Browser | `initializeApp` + `getAuth` |
| `src/lib/firebase-admin.ts` | Node only | サービスアカウントで初期化 |

### 2.3 データフロー（読み取り例）

```
Browser
 └ AuthProvider が onIdTokenChanged で AuthUser を保持
 └ apiFetch('/api/events?...')
      Header: Authorization: Bearer <ID Token>
        ↓
middleware (Edge): Bearer ヘッダ存在チェック → 無ければ 401
        ↓
route handler (Node)
  withAuth → adminAuth.verifyIdToken → AuthUser{ uid, email }
  adminDb.collection('users').doc(uid).collection('events').where(...).get()
  toEventDTO で Firestore 型 → EventDTO に正規化
        ↓
Response { events: EventDTO[] }
```

---

## 3. Firestore データモデル

### 3.1 コレクション

```
users/{uid}/events/{eventId}
  ├─ title:     string                         1..100 文字
  ├─ date:      string  "YYYY-MM-DD"           ※ Timestamp ではない（§3.3）
  ├─ startTime: string  "HH:mm"
  ├─ endTime:   string  "HH:mm"                ※ endTime > startTime
  ├─ color:     string  "#RRGGBB"              既定 "#10B981"
  ├─ note:      string | null                  最大 500 文字
  ├─ createdAt: Timestamp                       serverTimestamp()
  └─ updatedAt: Timestamp                       serverTimestamp()
```

`users/{uid}` 自体は本リリースでは未使用フィールド（プロファイルは Firebase Auth に保持）。

### 3.2 必要な複合インデックス

API は `where date >= start && date <= end` + `orderBy('date').orderBy('startTime')` を実行する。

| コレクション | フィールド | 用途 |
|---|---|---|
| `events`（Collection scope） | `date ASC`, `startTime ASC` | `/api/events` 一覧、`/api/free-slots` の事前取得 |

`firestore.indexes.json` を **このインデックス 1 件だけ** に書き換える（旧 `courses` / `shifts` を削除）。

### 3.3 設計判断（なぜ文字列か）

| 項目 | 採用 | 理由 |
|---|---|---|
| `date` を `"YYYY-MM-DD"` 文字列に | 採用 | Firestore Timestamp は UTC 保存となり、JST 想定のユーザーが「23:00 の予定が翌日になる」TZ 起因のズレを起こす。文字列で保存すれば日付概念をそのまま扱える |
| `startTime` / `endTime` を `"HH:mm"` 文字列に | 採用 | 同上。比較は `toMinutes`（§10）でのみ行う |
| `users/{uid}/events` サブコレクション | 採用 | Rules を 1 行で書け、ユーザー間データ分離を **構造で** 担保 |
| 単一コレクション（`events` トップ + `ownerId` フィールド）案 | 不採用 | Rules・クエリ共に複雑化、`ownerId` の付け忘れバグの危険 |

---

## 4. Firestore Security Rules

`firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 自分のユーザードキュメントのみ R/W 可
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // events サブコレクションのみ本人に限り R/W 可（明示列挙し、将来の追加サブコレクションが
      // 自動的に公開されることを防ぐ。新規サブコレクション追加時は本ファイルへの追記必須）
      match /events/{eventId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

注意:

- `match /{collection}/{docId}` は **直下 1 階層のみ**。さらにネストする場合は明示宣言が必要（本仕様では不要）。
- Admin SDK は Rules をバイパスする。Rules は **クライアント直アクセスへの最後の砦** であり、サーバー側のパスバインド規約（§6.6）と二段構えで防御する。
- 既存コメント `// すべてのサブコレクション (courses, shifts, settings) を自分のみ` は旧仕様。`events` 用に書き換える（§13）。

---

## 5. 環境変数

`src/lib/env.ts`（クライアント、Zod）と `src/lib/env-server.ts`（サーバー、Zod）で起動時検証し、未設定なら `throw`。

| 変数 | スコープ | 必須 | 用途 |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | client + server | 必須 | Firebase JS SDK |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | client + server | 必須 | 同上 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | client + server | 必須 | 同上 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | client + server | 必須 | 同上 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | client + server | 必須 | 同上 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | client + server | 必須 | 同上 |
| `FIREBASE_PROJECT_ID` | server only | 必須 | Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | server only | 必須 | サービスアカウント |
| `FIREBASE_PRIVATE_KEY` | server only | 必須 | `\n` を含む文字列。`replace(/\\n/g, '\n')` 済み |
| `NODE_ENV` | server | 既定値 `development` | `development`/`production`/`test` |
| `NEXT_PUBLIC_SHIFT_API_BASE` | client only | 任意 | 未設定なら シフト連携 OFF。**自プロジェクトを指す既定値は禁止** |

規約:

- `process.env.X || ''` のような暗黙フォールバックは禁止。必ず `clientEnv` / `serverEnv` 経由。
- 機能 ON/OFF を変数有無で判定するオプション変数（`NEXT_PUBLIC_SHIFT_API_BASE`）は例外として `process.env` を直接参照してよいが、**未設定時は throw → 呼び出し元 catch → 機能無効化** のパターンを統一する（現実装と一致）。
- `serverEnv` は `typeof window !== 'undefined'` でクライアント import を `throw` で禁止する。

---

## 6. API 仕様

すべて `Authorization: Bearer <Firebase ID Token>` 必須。`middleware.ts` がヘッダ存在を、`withAuth` が ID Token を検証する **二段認証ガード**。

### 6.1 エンドポイント

| メソッド | パス | 概要 |
|---|---|---|
| `GET`    | `/api/events?startDate=&endDate=`         | 範囲指定でイベント一覧 |
| `POST`   | `/api/events`                              | 作成 |
| `PUT`    | `/api/events/[id]`                         | 部分更新 |
| `DELETE` | `/api/events/[id]`                         | 削除 |
| `GET`    | `/api/free-slots?startDate=&endDate=&dayStart=&dayEnd=&minDuration=` | 空き時間算出 |

### 6.2 共通レスポンス

```jsonc
// 成功 (CRUD 単体)
{ "event": EventDTO }
// 成功 (一覧)
{ "events": EventDTO[] }
// 成功 (free-slots)
{ "freeSlots": FreeSlot[] }
// エラー
{ "error": ErrorCode, "message": string }
```

`ErrorCode` は `"Unauthorized" | "BadRequest" | "ValidationError" | "NotFound" | "InternalError"` の閉じた列挙とする。

### 6.3 ステータスコード

| 条件 | ステータス |
|---|---|
| `Authorization` ヘッダ無 / `Bearer ` で始まらない | 401（middleware） |
| ID Token 無効 / 期限切れ | 401（withAuth） |
| JSON パース失敗 / 必須クエリ不足 | 400 `BadRequest` |
| Zod 検証失敗 | 400 `ValidationError` |
| 対象 `[id]` 不在 | 404 `NotFound` |
| 作成成功 | 201 |
| 削除成功 | 204（ボディ無し） |
| その他成功 | 200 |
| 想定外例外 | 500 `InternalError`（メッセージは詳細を露出させない） |

### 6.4 リクエスト契約

#### `POST /api/events`

```ts
body: {
  title:     string,            // 1..100
  date:      "YYYY-MM-DD",
  startTime: "HH:mm",
  endTime:   "HH:mm",           // > startTime（toMinutes 比較）
  color?:    "#RRGGBB",         // 既定 "#10B981"
  note?:     string | null      // <=500
}
→ 201 { event: EventDTO }
```

#### `PUT /api/events/[id]`

全フィールド optional。`startTime` と `endTime` の **両方** が含まれた場合のみ `endTime > startTime` を再検証する（片方のみのときは検証不可。**整合性破壊の余地**として §6.7 既知のリスクに記載）。

#### `DELETE /api/events/[id]`

→ `204 No Content`

#### `GET /api/events?startDate=&endDate=`

- `startDate` / `endDate` は省略可。指定された場合のみ範囲フィルタ。
- 仕様: 文字列比較で `date >= startDate && date <= endDate`（Firestore のレキシコグラフィカル比較が ISO 形式と一致するため安全）。
- レスポンスは `(date ASC, startTime ASC)` でソート済み。
- **追加検証**: `startDate` / `endDate` も同じ `dateStringSchema` で検証することを規約とする（現実装は無検証 → §6.7 リスク）。

#### `GET /api/free-slots`

| クエリ | 既定 | 検証 |
|---|---|---|
| `startDate` | 必須 | `^\d{4}-\d{2}-\d{2}$` |
| `endDate` | 必須 | 同上、かつ `endDate >= startDate`、かつ **`endDate - startDate` ≤ 366 日**（DoS 防止の入力値域制約。詳細は §16） |
| `dayStart` | `"08:00"` | `HH:mm` |
| `dayEnd` | `"22:00"` | `HH:mm`、かつ `dayEnd > dayStart` |
| `minDuration` | `30` | 正の整数（`Number.isFinite` && `> 0`）。`NaN` / 非数 / 0 / 負は 400 |

レスポンス: `{ freeSlots: FreeSlot[] }`。

これらクエリは **Zod 製 `freeSlotsQuerySchema`** で一括検証する（現実装は手動 `parseInt` のみ → §6.7 / §13）。

### 6.5 認証ヘルパ仕様

```ts
// src/lib/auth-server.ts
export interface AuthUser { uid: string; email: string | null }
export class AuthError extends Error { constructor(public status: number, msg: string) }
export async function requireAuth(req: NextRequest): Promise<AuthUser>;
export function withAuth<T>(
  handler: (req: NextRequest, ctx: { user: AuthUser; params?: Record<string, string> }) => Promise<T>
): (req: NextRequest, ctx: { params?: Record<string, string> }) => Promise<Response>;
```

`withAuth` は `AuthError` 以外の例外を **再 throw する**（現実装どおり）。Next.js のデフォルト 500 にフォールバックする想定。将来的には `try/catch` で 500 を整形すべき（§17）。

### 6.6 サーバー側パスバインド規約（最重要）

すべての Firestore アクセスは **必ず**:

```ts
adminDb.collection('users').doc(user.uid).collection('events')...
```

の形でなければならない。`user.uid` 以外（クエリ文字列やボディに含まれる任意の uid）を `.doc()` の引数にしてはならない。これを破ると Admin SDK の権限で他人のデータを読み書きできる。コードレビューでは **この一点を最優先で確認**。

### 6.7 既知のリスク（仕様レベルで明示）

| ID | 内容 | 対応方針 |
|---|---|---|
| R-1 | `PUT` で `startTime` のみ更新 → 既存の `endTime` と矛盾しても通る | 仕様としては「片方更新時はサーバーで既存 doc を読み合算検証」が正。実装修正は cleanup |
| R-2 | `GET /api/events` の `startDate` / `endDate` が無検証 → 不正値で Firestore に投入される | `dateStringSchema` で検証必須。現実装は未対応 |
| R-3 | `/api/free-slots` の `minDuration` が `parseInt` のみ → `"abc"` → `NaN`、`"-30"` → 負値が流れる | `freeSlotsQuerySchema` 必須 |
| R-4 | `/api/free-slots` で `new Date(startDate + 'T00:00:00')` を使用 → サーバー TZ に依存 | `parseISO(startDate)` に置換（§10 規約） |
| R-5 | `withAuth` が非 `AuthError` 例外を素 throw → Next.js デフォルト 500 ボディが露出する可能性 | catch して `InternalError` に正規化（§17） |

---

## 7. クライアント認証フロー

### 7.1 初期化

`src/lib/firebase-client.ts` で `getApps().length` チェック付きで `initializeApp`。`auth` と `googleProvider` を named export。

### 7.2 AuthProvider

```ts
// src/providers/AuthProvider.tsx
const AuthContext = createContext<{
  user: AuthUser | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
}>(...);
```

- `onIdTokenChanged` を購読し、トークンの自動更新も拾う（`onAuthStateChanged` ではなく `onIdTokenChanged` を使うのは仕様）。
- `AuthUser` は `src/types/auth.ts` のもの（`uid` / `email` / `displayName` / `photoURL`）。

### 7.3 認証操作

| 操作 | API |
|---|---|
| サインアップ | `createUserWithEmailAndPassword`（パスワード ≥ 8 文字をクライアント側で事前検証） |
| ログイン | `signInWithEmailAndPassword` |
| Google OAuth | `signInWithPopup(auth, googleProvider)` |
| ログアウト | `signOut(auth)` |
| ガード | `(dashboard)/layout.tsx` で `useAuth()` を見て、`!loading && !user` なら `/login` へ |

### 7.4 API 呼び出し

```ts
// src/lib/api-client.ts
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T>
```

- `auth.currentUser?.getIdToken()` を取得。未取得なら `throw new Error('Not authenticated')`。
- `Content-Type: application/json` と `Authorization: Bearer <token>` を自動付与（呼び出し側の `init.headers` でオーバーライド可）。
- 非 2xx は本文 JSON の `message` を `Error` として throw。

---

## 8. 型定義（DTO）

```ts
// src/types/api.ts
export interface EventDTO {
  id: string;
  title: string;
  date: string;        // "YYYY-MM-DD"
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  color: string;       // "#RRGGBB"
  note: string | null;
  source?: 'local' | 'shift';   // 'shift' は外部シフト API 由来。未指定なら local 扱い
}

export interface FreeSlot {
  date: string;              // "YYYY-MM-DD"
  dayOfWeek: string;         // "月曜" 等の表示用
  startTime: string;         // "HH:mm"
  endTime: string;           // "HH:mm"
  duration: number;          // 分
  displayText: string;       // "月曜 09:00〜10:30（1時間30分）"
}

export interface ErrorResponse { error: string; message: string }
export interface CreateEventRequest { title; date; startTime; endTime; color?; note?; }
export interface UpdateEventRequest { /* 全 optional */ }
```

```ts
// src/types/auth.ts
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
```

`src/lib/dto.ts` の `toEventDTO(id, data)` で **Firestore 型 → DTO** に正規化。クライアントコードは `firebase-admin/firestore` の型を一切 import しない。

---

## 9. バリデーション

`src/lib/validation.ts`:

| スキーマ | 内容 |
|---|---|
| `hhmmSchema` | `z.string().refine(isValidHHmm)` |
| `dateStringSchema` | `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` |
| `createEventSchema` | title(1..100) / date / startTime / endTime / color? / note?(<=500) + `endTime > startTime` |
| `updateEventSchema` | 全 optional + start/end 両方ある場合のみ `end > start` |
| `eventsListQuerySchema` | `{ startDate?: dateStringSchema, endDate?: dateStringSchema }`（**追加すべき**、§13） |
| `freeSlotsQuerySchema` | `{ startDate, endDate, dayStart="08:00", dayEnd="22:00", minDuration=30 }` を全検証＋関係制約（**追加すべき**、§13） |

規約:

- 型アサーション (`as`) のみで API 境界を通すコードは **禁止**。必ず `safeParse`。
- エラー本文は `parsed.error.errors[0].message`（=Zod の最初のメッセージ）を採用。

---

## 10. 時刻 / 日付ユーティリティ

### 10.1 `src/lib/time.ts`

```ts
export function toMinutes(hhmm: string): number;        // 不正なら throw
export function fromMinutes(minutes: number): string;   // 0..1439 範囲外は throw
export function diffMinutes(start: string, end: string): number;
export function isValidHHmm(s: string): boolean;
export const timeStringSchema: z.ZodString;
```

### 10.2 `src/lib/date.ts`

`date-fns` の薄いラッパ。`formatDate` / `formatDateJa` / `getDayOfWeekJa` / `dateToDayOfWeek` / `getWeekRange` / `getMonthRange` / `getWeekDays` 等をエクスポート。`addDays` / `subDays` / `addWeeks` / `subWeeks` / `addMonths` / `subMonths` / `isSameDay` / `isBefore` / `isAfter` / `parseISO` / `startOfWeek` / `endOfWeek` / `startOfMonth` / `endOfMonth` を再 export。

### 10.3 規約（仕様レベルで禁止）

| 禁止パターン | 代替 | 理由 |
|---|---|---|
| `parseInt(hhmm, 10)` で直接時刻分解 | `toMinutes(hhmm)` | フォーマット検証が抜ける |
| `new Date(s + 'T00:00:00')` | `parseISO(s)` | サーバー TZ に依存。Vercel/Cloud Run など UTC コンテナで日付ずれ |
| 日付の `<` / `>` 演算 | `isBefore` / `isAfter` / `isSameDay` | 同上 |
| `Date.now()` を期待値計算に直接使用 | `parseISO` 経由 + ロケール固定の date-fns | TZ 依存 |

`/api/free-slots` 現実装の `new Date(startDate + 'T00:00:00')` は本規約違反 → §13 cleanup。

---

## 11. 空き時間算出（`src/lib/free-slots.ts`）

```ts
export function calculateFreeSlots(
  events: EventDTO[],
  startDate: Date,
  endDate: Date,
  dayStart?: string,    // 既定 "08:00"
  dayEnd?: string,      // 既定 "22:00"
  minDuration?: number  // 既定 30
): FreeSlot[];
```

アルゴリズム:

1. `startDate..endDate` を 1 日ずつイテレート（`isAfter` で停止判定、`addDays` で前進）。
2. その日付に `e.date === dateStr` で一致するイベントを busy 区間（`{startMinutes, endMinutes}`）に変換。
3. `mergeIntervals` で開始順ソート → 重複/隣接マージ。
4. `dayStart..dayEnd` 区間内で merged の隙間を抽出。
5. `duration >= minDuration` のみ採用。
6. `displayText` を `"<曜日> HH:mm〜HH:mm（X時間Y分）"` で生成（`formatDuration` ユーティリティ）。

注意: 入力 `events` は **range フィルタ済み** であることが前提（route handler 側で `where('date','>=',start).where('date','<=',end)`）。

---

## 12. シフト連携（オプション）

外部シフトアプリの API を **クライアントから直接呼び、表示専用でマージ** する機能。本アプリでは作成・編集を行わない。

### 12.1 構成

| ファイル | 役割 |
|---|---|
| `src/lib/shiftApi/types.ts` | 外部レスポンス `ShiftEvent` 型（`id` / `title` / `start` / `end` / `allDay:false` / `color` / `workplaceId` / `breakMin` / `memo`） |
| `src/lib/shiftApi/client.ts` | `fetchShiftEvents({from, to, workplaceId?})`、`ShiftApiUnauthorizedError` を export |
| `src/lib/shiftApi/adapter.ts` | `shiftEventToEventDTO(s)` → `EventDTO` (`source: 'shift'`、`id` は `'shift:'+s.id`) |
| `src/hooks/useShiftEvents.ts` | React フック。`{ events, loading, error, unauthorized }` |

### 12.2 仕様

- ベース URL: `process.env.NEXT_PUBLIC_SHIFT_API_BASE`。**ビルド時に静的に埋め込まれる前提で、実行時に書き換わってはならない**（攻撃者がベース URL を誘導できると ID Token を任意ホストへ送信できる脆弱性につながる）。値は信頼できる自社/許可済みドメインに限定する（運用上の allowlist）。未設定なら `client.ts` で sentinel エラーを `throw` → フックで catch → 機能 OFF。
- 認証: 自プロジェクトの Firebase ID Token をそのまま `Authorization: Bearer` で渡す（外部 API が同 Firebase Project の verify を行う前提）。**外部 API が異なる Firebase Project の場合は本方式では動作しない** → §17 将来課題。
- エンドポイント: `GET {base}/api/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD[&workplaceId=]`。
- `401` → `ShiftApiUnauthorizedError` をフックで捕捉、`unauthorized: true`、`events: []`。**カレンダー本体に影響を与えない**。
- 非 2xx → 通常の `Error` としてフックの `error` に格納（カレンダー本体は通常表示）。
- レスポンス本体: `{ events: ShiftEvent[] }`。`events` フィールドが無い場合は空配列にフォールバック。

### 12.3 フェイルセーフ要件（仕様）

| ケース | 振る舞い |
|---|---|
| `NEXT_PUBLIC_SHIFT_API_BASE` 未設定 | フック側で `events: []` を返し、`error` は表面化させない（現実装はキャッチしているが `error` に立ててしまっている → §13 cleanup） |
| ネットワーク失敗 | `error` を立てるが UI は本体カレンダーを表示し続ける |
| 401 | `unauthorized: true`、`events: []` |
| 200 だが型不正（`start`/`end` が ISO 文字列でない等） | adapter 内で `slice(0,10)` / `slice(11,16)` を行う前に **形式バリデーション**（Zod or 正規表現）を行い、不正アイテムは **黙ってスキップ**。例外で UI を壊さない（現実装は無検証 → §13 cleanup） |

### 12.4 マージ表示

`src/app/(dashboard)/calendar/page.tsx` で `mergedEvents = [...events, ...shiftEvents.map(shiftEventToEventDTO)]` を生成し、各ビュー（Day / Week / Month）に渡す。`source === 'shift'` のものは **編集 UI を出さない**（モーダルを開かない / コンテキストメニュー無効）。

---

## 13. Cleanup 対象（旧仕様 / 設計違反の残骸）

実装ループで順次解消する。

| # | 対象 | 現状 | 対応 |
|---|---|---|---|
| C-1 | `firestore.indexes.json` | `courses` / `shifts` インデックスのみ。`events` 用が無い | 両者を削除し `events (date ASC, startTime ASC)` を追加 |
| C-2 | `firestore.rules` のコメント | `// すべてのサブコレクション (courses, shifts, settings) を自分のみ` | `// 直下のサブコレクション (events) を本人のみ R/W 可` に修正 |
| C-3 | `README.md` | 確認のうえ旧仕様（Prisma/NextAuth 等）が残っていれば全面書き換え | Firebase + slim 機能版に書き直し |
| C-4 | `.env.local.example` | `NEXT_PUBLIC_SHIFT_API_BASE=http://localhost:3000`（自プロジェクトを指す誤誘導） | コメントアウトまたは `# NEXT_PUBLIC_SHIFT_API_BASE=https://shift.example.com` のプレースホルダ化 |
| C-5 | `package.json` | `tesseract.js` が依存に残存（OCR 削除済みで未使用） | `dependencies` から削除 |
| C-6 | `src/middleware.ts` | `/api/auth/*` 除外条件があるが該当エンドポイントは無し | 残置可。残すならコメントで「将来 Cookie セッション用」と明示 |
| C-7 | `src/app/api/free-slots/route.ts` | `parseInt` + `new Date(s+'T00:00:00')` 使用（規約違反） | `freeSlotsQuerySchema` 経由 + `parseISO` に置換 |
| C-8 | `src/app/api/events/route.ts` (GET) | `startDate` / `endDate` 無検証 | `eventsListQuerySchema` で検証 |
| C-9 | `src/app/api/events/[id]/route.ts` (PUT) | start/end 片方更新時の整合性検証なし | 既存 doc を読み合算で `end > start` 検証 |
| C-10 | `src/lib/shiftApi/adapter.ts` | レスポンス型未検証で `slice` | Zod or 形式チェック → 不正アイテムは skip |
| C-11 | `src/hooks/useShiftEvents.ts` | `NEXT_PUBLIC_SHIFT_API_BASE` 未設定の throw を `error` に立ててしまう | `Error('NEXT_PUBLIC_SHIFT_API_BASE is not set')` を専用 sentinel または catch 内で `error` に立てず無視 |
| C-12 | `src/types/index.ts` 等 | 旧型 (`Course`, `Shift` 等) が残存していないか確認 | あれば削除 |
| C-13 | `src/lib/auth-server.ts` | `AuthError` 以外の例外が素 throw され 500 詳細露出の懸念（**本番デプロイ前 must**） | catch して `{error:'InternalError', message:'内部エラー'}` 500 に正規化 |
| C-14 | `firestore.rules` | `match /{collection}/{docId}` ワイルドカードが過剰 | `match /events/{eventId}` に明示限定（§4 改訂反映） |
| C-15 | `src/app/api/free-slots/route.ts` | 期間上限が無く Firestore 読み取り DoS 可能 | `freeSlotsQuerySchema` で `endDate - startDate ≤ 366 日` を強制（§6.4 反映） |

---

## 14. ファイル構成

```
src/
├── app/
│   ├── (auth)/{login,register}/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                 認証ガード
│   │   ├── calendar/page.tsx          日/週/月ビュー + シフトマージ
│   │   └── free-time/page.tsx         空き時間検索 UI
│   ├── api/
│   │   ├── events/route.ts            GET / POST
│   │   ├── events/[id]/route.ts       PUT / DELETE
│   │   └── free-slots/route.ts        GET
│   ├── layout.tsx
│   └── page.tsx                       ルート → /calendar or /login
├── components/
│   ├── auth/{LoginForm,RegisterForm}.tsx
│   ├── calendar/{CalendarHeader,DayView,WeekView,MonthView,EventModal}.tsx
│   ├── layout/Header.tsx
│   └── ui/{Button,Input,Modal,Spinner}.tsx
├── hooks/useShiftEvents.ts
├── lib/
│   ├── env.ts            client env (Zod)
│   ├── env-server.ts     server env (Zod)
│   ├── firebase-client.ts
│   ├── firebase-admin.ts
│   ├── auth-server.ts    requireAuth / withAuth / AuthError
│   ├── api-client.ts     apiFetch
│   ├── validation.ts     Zod schemas
│   ├── time.ts
│   ├── date.ts
│   ├── dto.ts
│   ├── free-slots.ts
│   ├── utils.ts
│   └── shiftApi/{client,types,adapter}.ts (+ __tests__/)
├── providers/{AuthProvider,CalendarProvider}.tsx
├── types/{api,auth}.ts
└── middleware.ts

firestore.rules
firestore.indexes.json
firebase.json
vitest.config.ts
.env.local.example
```

---

## 15. テスト方針

### 15.1 ユニット (vitest)

| 対象 | テスト観点 |
|---|---|
| `src/lib/time.ts` | `toMinutes`/`fromMinutes` の境界値（00:00, 23:59, 24:00 不正, 負値）、`diffMinutes` 負値ケース |
| `src/lib/validation.ts` | `createEventSchema` の `end > start`、`updateEventSchema` の片方のみ更新ケース、`freeSlotsQuerySchema` の `minDuration=NaN/-1/abc` |
| `src/lib/free-slots.ts` | 空イベント、終日埋まり、隣接イベントマージ、`minDuration` フィルタ |
| `src/lib/dto.ts` | `note` が `undefined` → `null` 正規化 |
| `src/lib/shiftApi/adapter.ts` | 型不正 → skip、正常変換、`memo: ''` → `note: null` |

### 15.2 API ハンドラ統合テスト

`adminAuth.verifyIdToken` / `adminDb` をモックし、`/api/events` 系のステータスとボディを検証。最重要観点:

- 他人の `[id]` を指定しても自分のサブコレクションしか見ないこと（**§6.6 の固有検証**）。
- 401 / 400 / 404 / 201 / 204 の網羅。

### 15.3 手動確認

- TZ シミュレーション: `TZ=UTC` でサーバー起動し、JST 23:00 の予定が翌日扱いにならないことを確認。

---

## 16. セキュリティ前提

| 項目 | 扱い |
|---|---|
| 認証 | Firebase ID Token を `adminAuth.verifyIdToken` で検証 |
| 認可 | サーバー側 `users/{user.uid}/...` パスバインド（§6.6） + Firestore Rules による二重防御 |
| 入力検証 | 全 API の body / query を Zod。`as` キャストのみで通すコード禁止 |
| CSRF | API は `Authorization: Bearer` のみ。Cookie セッション無し → CSRF 不要 |
| 出力エスケープ | React の自動エスケープに依存。`dangerouslySetInnerHTML` は禁止 |
| シークレット | `FIREBASE_PRIVATE_KEY` 等 server only。`NEXT_PUBLIC_*` 以外は **絶対に** クライアントで参照しない（`env-server.ts` がガード） |
| Rate limit | 個人利用前提で非対応。将来 Vercel KV / Upstash で実装検討。ただし **入力値域制約**（例: `/api/free-slots` の期間 ≤ 366 日）は Rate limit とは別に必須とし、`freeSlotsQuerySchema` で強制する |
| 例外正規化 | `withAuth` で `AuthError` 以外の例外を catch し 500 `InternalError` に統一する（本番デプロイ前 must、§13 C-13） |
| ログ | 開発時 `console.error` のみ。本番ログ集約は将来課題 |
| 外部 API（シフト） | クライアント直接呼び出し。失敗で本体 UI を壊さないこと（§12.3） |

詳細な脅威モデル分析は security-auditor の領分とする。

---

## 17. 将来の拡張（非スコープ）

- Firestore `onSnapshot` を使ったリアルタイム同期
- Google Calendar / iCal 双方向同期
- 通知（FCM / Web Push）
- マルチプロジェクト ID Token 対応（シフト連携の異なる Firebase Project への対応）
- Rate limit / 監査ログ
- 旧仕様で削除した時間割・シフト管理・OCR の再導入（必要なら別仕様で再起票）
