# 学生向けカレンダーアプリ 設計書

## 1. 概要 / 技術スタック

時間割とバイトシフトを管理し、空き時間を自動提案する学生向け Web カレンダー。

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 14+ (App Router) + TypeScript + Tailwind CSS |
| サーバー (API Routes) | Next.js Route Handlers + Firebase Admin SDK |
| 認証 | Firebase Authentication (Email/Password + Google OAuth) |
| データベース | Cloud Firestore |
| クライアント Firebase | Firebase JS SDK v10+ |
| OCR | Tesseract.js (クライアントサイド) |
| 日付処理 | date-fns + date-fns-tz |
| バリデーション | Zod |
| デプロイ | Vercel + Firebase プロジェクト |

---

## 2. アーキテクチャ概要

```
+--------------------------------------------------------------+
|                       Browser (Client)                       |
|                                                              |
|  Next.js App Router (React Components)                       |
|    AuthProvider (Context)                                    |
|      |- useAuth() : { user: AuthUser | null, loading }       |
|                                                              |
|  Firebase JS SDK                                             |
|    |- signInWithEmailAndPassword / createUserWithEmail...    |
|    |- signInWithPopup(GoogleAuthProvider)                    |
|    |- onIdTokenChanged -> ID Token を取得                     |
|                                                              |
|  fetch('/api/...', {                                         |
|     headers: { Authorization: 'Bearer <ID_TOKEN>' }          |
|  })                                                          |
+-------------------------|------------------------------------+
                          |
                          v
+--------------------------------------------------------------+
|                Next.js API Route (Server)                    |
|                                                              |
|  requireAuth(req)                                            |
|    |- Authorization ヘッダから ID Token を取得                |
|    |- Firebase Admin SDK で verifyIdToken                    |
|    |- 失敗 -> 401                                             |
|    |- 成功 -> { uid, email } を返却                           |
|                                                              |
|  Firestore Admin SDK でデータアクセス                         |
|    |- users/{uid}/courses/{courseId}                         |
|    |- users/{uid}/shifts/{shiftId}                           |
|    |- users/{uid}/settings/periods                           |
+-------------------------|------------------------------------+
                          |
                          v
+--------------------------------------------------------------+
|                  Firebase Project                            |
|                                                              |
|  Firebase Auth (ユーザー管理)                                 |
|  Cloud Firestore (データ保存)                                 |
|    + Security Rules (uid ベースのデータ分離)                  |
+--------------------------------------------------------------+
```

- 認証は Firebase が一元管理。API Route は state-less (JWT 検証のみ)。
- Firestore へのアクセスは原則 **サーバー経由** (Admin SDK)。ただし Security Rules によりクライアント直接アクセスも安全に許可可能 (本設計では API 経由を基本とする)。

---

## 3. Firestore データモデル

### 3.1 コレクション構造

すべてユーザー配下のサブコレクションで管理し、Security Rules でのデータ分離を単純化する。

```
users/{uid}                                  (ユーザープロファイル)
  |- displayName: string | null
  |- email: string
  |- photoURL: string | null
  |- createdAt: Timestamp
  |- updatedAt: Timestamp

users/{uid}/courses/{courseId}               (授業)
  |- name: string                "線形代数I"
  |- dayOfWeek: string           "MONDAY" | ... | "SUNDAY"
  |- period: number              1..10
  |- startTime: string           "09:00"
  |- endTime: string             "10:30"
  |- room: string | null
  |- color: string               "#3B82F6"
  |- termStart: string | null    "2026-04-01"  (YYYY-MM-DD 文字列)
  |- termEnd: string | null
  |- createdAt: Timestamp
  |- updatedAt: Timestamp

users/{uid}/shifts/{shiftId}                 (バイトシフト)
  |- title: string               "バイト"
  |- date: string                "2026-05-12"  (YYYY-MM-DD 文字列, UTC ずれ防止)
  |- startTime: string           "17:00"
  |- endTime: string             "22:00"
  |- color: string               "#10B981"
  |- note: string | null
  |- createdAt: Timestamp
  |- updatedAt: Timestamp

users/{uid}/settings/periods                 (時限設定 - 単一ドキュメント)
  |- periods: map                {
                                   "1": { start: "09:00", end: "10:30" },
                                   "2": { start: "10:40", end: "12:10" },
                                   ...
                                 }
  |- updatedAt: Timestamp
```

### 3.2 ドキュメント例

```jsonc
// users/abc123/courses/xyz789
{
  "name": "線形代数I",
  "dayOfWeek": "MONDAY",
  "period": 2,
  "startTime": "10:40",
  "endTime": "12:10",
  "room": "A101",
  "color": "#3B82F6",
  "termStart": "2026-04-01",
  "termEnd": "2026-08-05",
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}

// users/abc123/shifts/sh001
{
  "title": "カフェバイト",
  "date": "2026-05-12",
  "startTime": "17:00",
  "endTime": "22:00",
  "color": "#10B981",
  "note": null,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

### 3.3 複合インデックス要件

Firestore は単一フィールドのインデックスは自動だが、複合クエリは明示が必要。

| コレクション | フィールド | 用途 |
|-------------|------------|------|
| `users/{uid}/courses` | `dayOfWeek` ASC, `period` ASC | 曜日フィルタ + 並び順 |
| `users/{uid}/shifts` | `date` ASC | 期間検索 (`where date >= start && date <= end`) |
| `users/{uid}/shifts` | `date` ASC, `startTime` ASC | 同日内ソート |

`firestore.indexes.json` に記載しデプロイする。

### 3.4 設計判断

| 項目 | 採用 | 理由 |
|------|------|------|
| Shift.date 型 | **文字列 `"YYYY-MM-DD"`** | Timestamp の UTC/JST ずれを根本回避 (M-1, M-7) |
| termStart/termEnd | 文字列 `"YYYY-MM-DD"` | 同上 |
| サブコレクション | 採用 | Security Rules がシンプル、ユーザーごとのデータ分離が自然 |
| createdAt / updatedAt | Timestamp | サーバー時刻として `FieldValue.serverTimestamp()` を使用 |

---

## 4. Firestore Security Rules

`firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 自分のユーザードキュメントのみ読み書き可
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // すべてのサブコレクション (courses, shifts, settings) を自分のみ
      match /{collection}/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

ポイント:
- 認証必須 (`request.auth != null`)。
- `userId` が `auth.uid` と一致するときのみ許可。
- API 経由でも Admin SDK は Rules をバイパスするが、`requireAuth` で uid を取り出し、必ず `users/{uid}/...` パスにアクセスすることで同等の保護をサーバー側でも担保。

---

## 5. 環境変数定義 (`src/lib/env.ts`)

### 5.1 変数一覧

```bash
# .env.example

# --- Firebase Client (NEXT_PUBLIC_*) ---
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef

# --- Firebase Admin (Server-only) ---
FIREBASE_PROJECT_ID=your-app
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-app.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# --- Node ---
NODE_ENV=development
```

### 5.2 バリデーション実装

```typescript
// src/lib/env.ts
import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
});

const serverSchema = clientSchema.extend({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// クライアント側 (NEXT_PUBLIC_* のみ)
export const clientEnv = (() => {
  const r = clientSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  if (!r.success) throw new Error('Invalid client env: ' + JSON.stringify(r.error.format()));
  return r.data;
})();

// サーバー側 (Node ランタイムでのみ評価)
export const serverEnv = (() => {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv must not be imported on the client');
  }
  const r = serverSchema.safeParse(process.env);
  if (!r.success) throw new Error('Invalid server env: ' + JSON.stringify(r.error.format()));
  return r.data;
})();
```

**禁止事項 (H-3)**: コード内で `process.env.X || ''` のようなフォールバックは禁止。常に `clientEnv` / `serverEnv` 経由で参照する。

---

## 6. API Route 設計

### 6.1 共通: 認証ヘルパー (`src/lib/auth-server.ts`) — H-1 対応

```typescript
import { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export interface AuthUser {
  uid: string;
  email: string | null;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw new AuthError(401, 'Missing Bearer token');

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    throw new AuthError(401, 'Invalid or expired token');
  }
}

// すべての API ハンドラを包むラッパ
export function withAuth<T>(
  handler: (req: NextRequest, ctx: { user: AuthUser; params?: any }) => Promise<T>
) {
  return async (req: NextRequest, ctx: any) => {
    try {
      const user = await requireAuth(req);
      return await handler(req, { user, params: ctx?.params });
    } catch (e) {
      if (e instanceof AuthError) {
        return Response.json({ error: 'Unauthorized', message: e.message }, { status: e.status });
      }
      throw e;
    }
  };
}
```

### 6.2 ルートマップ

すべてのエンドポイントは `Authorization: Bearer <Firebase ID Token>` を要求する (auth ルート以外)。

| メソッド | パス | 概要 | リクエスト | レスポンス |
|---------|------|------|----------|-----------|
| POST | `/api/auth/session` | 任意: サーバーセッション cookie 発行 (将来用) | `{ idToken }` | `204` |
| GET | `/api/courses` | 授業一覧 | (なし) | `{ courses: CourseDTO[] }` |
| POST | `/api/courses` | 授業作成 | `CreateCourseRequest` | `{ course: CourseDTO }` |
| POST | `/api/courses/bulk` | 一括作成 (OCR 経由) | `{ courses: BulkCourseInput[] }` | `{ courses: CourseDTO[], createdCount }` |
| PUT | `/api/courses/[id]` | 更新 | `UpdateCourseRequest` | `{ course: CourseDTO }` |
| DELETE | `/api/courses/[id]` | 削除 | (なし) | `204` |
| GET | `/api/shifts?startDate&endDate` | シフト一覧 (文字列日付で範囲) | (query) | `{ shifts: ShiftDTO[] }` |
| POST | `/api/shifts` | 作成 | `CreateShiftRequest` | `{ shift: ShiftDTO }` |
| POST | `/api/shifts/bulk` | 一括作成 | `{ shifts: CreateShiftRequest[] }` | `{ shifts, createdCount }` |
| PUT | `/api/shifts/[id]` | 更新 | `UpdateShiftRequest` | `{ shift: ShiftDTO }` |
| DELETE | `/api/shifts/[id]` | 削除 | (なし) | `204` |
| GET | `/api/free-slots?startDate&endDate&dayStart&dayEnd&minDuration` | 空き時間 | (query) | `{ freeSlots: FreeSlot[] }` |
| GET | `/api/settings/periods` | 時限設定取得 | (なし) | `{ periods: PeriodConfig }` |
| PUT | `/api/settings/periods` | 時限設定更新 | `{ periods: PeriodConfig }` | `{ periods }` |

注意:
- **`/api/auth/register` は廃止**。ユーザー登録は Firebase Client SDK の `createUserWithEmailAndPassword` で完結する。サーバー側で初期化が必要な場合 (`users/{uid}` ドキュメント作成) は、初回 API アクセス時に lazy 作成する。
- すべてのハンドラは `withAuth` でラップ。`middleware.ts` でも API 配下の Authorization ヘッダ存在チェックを行い多層化する (H-1)。

### 6.3 各ハンドラ実装パターン

```typescript
// src/app/api/courses/route.ts
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { createCourseSchema } from '@/lib/validation';
import { toCourseDTO } from '@/lib/dto';

export const GET = withAuth(async (_req, { user }) => {
  const snap = await adminDb
    .collection('users').doc(user.uid)
    .collection('courses')
    .orderBy('dayOfWeek').orderBy('period')
    .get();
  const courses = snap.docs.map(d => toCourseDTO(d.id, d.data()));
  return Response.json({ courses });
});

export const POST = withAuth(async (req, { user }) => {
  const parsed = createCourseSchema.parse(await req.json());
  const ref = await adminDb
    .collection('users').doc(user.uid)
    .collection('courses')
    .add({ ...parsed, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  const doc = await ref.get();
  return Response.json({ course: toCourseDTO(doc.id, doc.data()!) }, { status: 201 });
});
```

### 6.4 middleware.ts (H-1 多層化)

```typescript
// middleware.ts (プロジェクトルート)
import { NextResponse, NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // /api/* (auth/session 以外) は Authorization ヘッダ必須
  if (req.nextUrl.pathname.startsWith('/api/') &&
      !req.nextUrl.pathname.startsWith('/api/auth/')) {
    const hasBearer = (req.headers.get('authorization') ?? '').startsWith('Bearer ');
    if (!hasBearer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
```

ID Token の検証は API Route 側の `requireAuth` で行う (Edge ランタイムでは Admin SDK が動かないため)。

---

## 7. クライアント認証フロー

### 7.1 Firebase 初期化 (`src/lib/firebase-client.ts`)

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { clientEnv } from './env';

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

### 7.2 AuthProvider (`src/providers/AuthProvider.tsx`)

```typescript
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import type { AuthUser } from '@/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onIdTokenChanged(auth, (u) => {
      setFbUser(u);
      setUser(u ? { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL } : null);
      setLoading(false);
    });
  }, []);

  const getIdToken = async () => (fbUser ? fbUser.getIdToken() : null);

  return <AuthContext.Provider value={{ user, loading, getIdToken }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

### 7.3 API 呼び出しヘルパ (`src/lib/api-client.ts`)

```typescript
import { auth } from './firebase-client';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}
```

### 7.4 フロー

| アクション | 実装 |
|----------|------|
| サインアップ | `createUserWithEmailAndPassword(auth, email, password)` (パスワード 8 文字以上 — L-2) |
| メールログイン | `signInWithEmailAndPassword(auth, email, password)` |
| Google OAuth | `signInWithPopup(auth, googleProvider)` |
| ログアウト | `signOut(auth)` |
| 認証ガード | サーバーコンポーネントでは Cookie ベース or リダイレクト、クライアントでは `useAuth()` で loading/未認証なら `/login` へ |

---

## 8. DTO 型定義

### 8.1 `src/types/auth.ts`

```typescript
// L-3: next-auth.d.ts は不要。AuthUser を定義
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
```

### 8.2 `src/types/api.ts` (フロント/サーバー境界の DTO — H-6)

Firestore の `Timestamp` や `DocumentReference` を**含まない**素のオブジェクトのみ。

```typescript
export type DayOfWeek =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface CourseDTO {
  id: string;
  name: string;
  dayOfWeek: DayOfWeek;
  period: number;
  startTime: string;     // "HH:mm"
  endTime: string;       // "HH:mm"
  room: string | null;
  color: string;
  termStart: string | null;  // "YYYY-MM-DD"
  termEnd: string | null;
}

export interface ShiftDTO {
  id: string;
  title: string;
  date: string;          // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  color: string;
  note: string | null;
}

export interface PeriodConfig {
  [period: string]: { start: string; end: string };
}

export interface FreeSlot {
  date: string;          // "YYYY-MM-DD"
  dayOfWeek: string;     // 表示用 "月曜" など
  startTime: string;
  endTime: string;
  duration: number;      // 分
  displayText: string;
}

// カレンダー表示統合型 (any 全廃 — M-4)
export type CalendarEvent =
  | { type: 'course'; data: CourseDTO }
  | { type: 'shift'; data: ShiftDTO };

export function isCourseEvent(e: CalendarEvent): e is { type: 'course'; data: CourseDTO } {
  return e.type === 'course';
}
export function isShiftEvent(e: CalendarEvent): e is { type: 'shift'; data: ShiftDTO } {
  return e.type === 'shift';
}
```

### 8.3 DTO 変換 (`src/lib/dto.ts`)

```typescript
import type { DocumentData } from 'firebase-admin/firestore';
import type { CourseDTO, ShiftDTO } from '@/types/api';

export function toCourseDTO(id: string, d: DocumentData): CourseDTO {
  return {
    id,
    name: d.name,
    dayOfWeek: d.dayOfWeek,
    period: d.period,
    startTime: d.startTime,
    endTime: d.endTime,
    room: d.room ?? null,
    color: d.color,
    termStart: d.termStart ?? null,
    termEnd: d.termEnd ?? null,
  };
}

export function toShiftDTO(id: string, d: DocumentData): ShiftDTO {
  return {
    id,
    title: d.title,
    date: d.date,           // すでに "YYYY-MM-DD" 文字列で保存されている
    startTime: d.startTime,
    endTime: d.endTime,
    color: d.color,
    note: d.note ?? null,
  };
}
```

**規約 (H-6)**: フロント (components/, hooks/) からは Firestore SDK の型を import しない。常に `*DTO` 経由。

---

## 9. ファイル構成 (新規/削除/維持)

### 9.1 新規追加

```
src/
├── lib/
│   ├── env.ts                  [新規] 環境変数バリデーション
│   ├── time.ts                 [新規] toMinutes / fromMinutes など
│   ├── firebase-client.ts      [新規] Firebase JS SDK 初期化
│   ├── firebase-admin.ts       [新規] Firebase Admin SDK 初期化
│   ├── auth-server.ts          [新規] requireAuth / withAuth
│   ├── api-client.ts           [新規] apiFetch (ID Token 付与)
│   ├── dto.ts                  [新規] Firestore -> DTO 変換
│   ├── validation.ts           [新規] Zod スキーマ
│   ├── free-slots.ts           [新規/維持] 空き時間計算 (区間マージ)
│   ├── date.ts                 [維持] date-fns ラッパ (isBefore/isAfter/isSameDay)
│   └── ocr/
│       ├── tesseract.ts        [維持] confidence は実 Tesseract 値を返す (M-2)
│       ├── parser.ts           [維持]
│       └── timetable-parser.ts [維持] MM/DD パース修正 (L-4)
│
├── providers/
│   └── AuthProvider.tsx        [新規] Firebase Auth Context
│
├── types/
│   ├── auth.ts                 [新規] AuthUser
│   ├── api.ts                  [新規/置換] DTO 型
│   ├── calendar.ts             [維持]
│   └── ocr.ts                  [維持]
│
├── components/
│   └── ocr/
│       ├── TimetableOcrEditor.tsx  [新規] OCR 結果編集 UI (M-8)
│       └── ShiftOcrEditor.tsx      [新規] 同上 (M-8)
│
└── app/
    └── api/
        ├── courses/...         [改修] Firestore 化
        ├── shifts/...          [改修] Firestore 化
        ├── free-slots/...      [改修]
        ├── settings/periods/.. [改修]
        └── auth/session/       [新規・任意] Cookie session 用 (将来)

firestore.rules                 [新規]
firestore.indexes.json          [新規]
middleware.ts                   [新規] Authorization ヘッダ必須化
```

### 9.2 削除

```
prisma/
├── schema.prisma                       [削除]
└── migrations/                         [削除]

src/lib/prisma.ts                       [削除]
src/lib/auth.ts                         [削除] (NextAuth authOptions)
src/app/api/auth/[...nextauth]/         [削除]
src/app/api/auth/register/              [削除] (Firebase Client で代替)
src/types/next-auth.d.ts                [削除] (L-3)

# NextAuth 由来の SessionProvider 参照箇所も全削除
```

### 9.3 維持 (内部実装のみ修正)

- `src/app/(dashboard)/...` 各ページ: データ取得層を `apiFetch` 経由に置換。
- `src/components/calendar/...`: DTO 型ベースに修正。
- `src/lib/free-slots.ts`: 区間マージは維持。`toMinutes`/`fromMinutes` を使用。

---

## 10. 依存パッケージ変更

### 10.1 削除

```
@prisma/client
prisma
next-auth
@next-auth/prisma-adapter
bcryptjs
@types/bcryptjs
```

### 10.2 追加

```
firebase            (Client SDK)
firebase-admin      (Server SDK)
```

### 10.3 維持

```
zod
date-fns
date-fns-tz
tesseract.js
tailwindcss
```

`package.json` の `scripts` から `prisma generate`, `prisma migrate ...` を削除。代わりに任意で:

```
"firebase:rules": "firebase deploy --only firestore:rules",
"firebase:indexes": "firebase deploy --only firestore:indexes"
```

---

## 11. 時刻処理仕様 (`src/lib/time.ts`) — H-2, H-4

### 11.1 関数シグネチャ

```typescript
/**
 * "HH:mm" -> 0時からの分数。書式不正なら throw。
 */
export function toMinutes(hhmm: string): number;

/**
 * 0..1439 の分数 -> "HH:mm"。範囲外なら throw。
 */
export function fromMinutes(minutes: number): string;

/**
 * 2 つの "HH:mm" の差分 (分)。end が start より前なら負値。
 */
export function diffMinutes(start: string, end: string): number;

/**
 * "HH:mm" 形式かつ 00:00..23:59 であることを検証。
 * Zod refinement や parser から使う。
 */
export function isValidHHmm(s: string): boolean;

/**
 * Zod 互換: 文字列バリデータ。
 * 不正なら ZodIssue を発行できるよう boolean を返す。
 */
export const timeStringSchema: z.ZodString;
```

### 11.2 規約 (H-2)

- `parseInt(startTime, 10)` のように "HH:mm" を直接 `parseInt` するのは **禁止**。
- 必ず `toMinutes` を経由して比較・演算する。
- `endTime - startTime` の演算は `diffMinutes(startTime, endTime)` を使う。
- `periodConfigSchema` には `.refine(p => toMinutes(p.end) > toMinutes(p.start), 'end must be after start')` を追加 (M-3)。
- 日付比較 (`Date` 同士) は `isBefore` / `isAfter` / `isSameDay` を使用し、`<` `>` 演算子の使用は禁止 (M-6)。

### 11.3 Zod スキーマ例

```typescript
// src/lib/validation.ts
import { z } from 'zod';
import { isValidHHmm, toMinutes } from './time';

export const hhmmSchema = z.string().refine(isValidHHmm, 'Must be HH:mm');

export const periodConfigSchema = z.record(
  z.string().regex(/^\d+$/),
  z.object({ start: hhmmSchema, end: hhmmSchema })
    .refine(p => toMinutes(p.end) > toMinutes(p.start), { message: 'end > start required' })
);

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createCourseSchema = z.object({
  name: z.string().min(1).max(100),
  dayOfWeek: z.enum(['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']),
  period: z.number().int().min(1).max(10),
  startTime: hhmmSchema,
  endTime: hhmmSchema,
  room: z.string().max(50).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  termStart: dateStringSchema.optional().nullable(),
  termEnd: dateStringSchema.optional().nullable(),
}).refine(d => toMinutes(d.endTime) > toMinutes(d.startTime), {
  message: 'endTime must be after startTime', path: ['endTime'],
});

export const createShiftSchema = z.object({
  title: z.string().max(50).optional(),
  date: dateStringSchema,
  startTime: hhmmSchema,
  endTime: hhmmSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  note: z.string().max(500).optional().nullable(),
}).refine(d => toMinutes(d.endTime) > toMinutes(d.startTime), {
  message: 'endTime must be after startTime', path: ['endTime'],
});
```

---

## 12. OCR 編集 UI 仕様 (M-8)

### 12.1 `TimetableOcrEditor`

OCR 結果をテーブル形式で表示し、ユーザーが確認・編集してから一括登録する。

```typescript
// src/components/ocr/TimetableOcrEditor.tsx
'use client';

export interface OcrCourseDraft {
  // OCR 結果由来
  id: string;                 // ローカル ID (uuid)
  name: string;
  dayOfWeek: DayOfWeek | null;
  period: number | null;
  room: string | null;
  confidence: number;         // 実 Tesseract 値 (M-2)
  // ユーザー編集フラグ
  isEdited: boolean;
}

export interface TimetableOcrEditorProps {
  initialDrafts: OcrCourseDraft[];
  onSubmit: (drafts: OcrCourseDraft[]) => Promise<void>;  // bulk API 呼び出し
  onCancel: () => void;
}

// 内部 state
// - drafts: OcrCourseDraft[]
// - errorMap: Record<string, string[]>  (ローカル ID -> エラーメッセージ)
// - submitting: boolean
//
// 主要操作
// - updateDraft(id, patch): 行を更新 (isEdited=true)
// - removeDraft(id): 行削除
// - validateAll(): name 必須, dayOfWeek 必須, period 必須 (null は登録不可)
// - submit(): validate -> onSubmit(drafts)
//
// 表示
// - 低 confidence (< 0.6) の行は黄色背景で警告
// - dayOfWeek / period は select、name / room は input
```

### 12.2 `ShiftOcrEditor`

```typescript
export interface OcrShiftDraft {
  id: string;
  date: string | null;        // "YYYY-MM-DD"
  startTime: string | null;   // "HH:mm"
  endTime: string | null;
  title: string;
  confidence: number;
  isEdited: boolean;
}

export interface ShiftOcrEditorProps {
  initialDrafts: OcrShiftDraft[];
  onSubmit: (drafts: OcrShiftDraft[]) => Promise<void>;
  onCancel: () => void;
}

// バリデーション:
// - date / startTime / endTime いずれか null は登録不可 (赤バッジ表示)
// - endTime > startTime (toMinutes ベース)
// - date は dateStringSchema
//
// 低 confidence 行はハイライト。
```

### 12.3 OCR パーサ修正点

- `tesseract.ts`: `recognize()` の結果から `data.confidence` を 0-100 で取得し、0-1 に正規化して返す (M-2)。
- `timetable-parser.ts`: MM/DD パターンは時刻 `HH:mm` と曖昧。`(?<!\d):` を含む文字列は時刻として優先、その後単独 `MM/DD` のみ日付として扱う (L-4)。年またぎは「現在月 > 取得月 + 6」のとき翌年と判定。

---

## 13. 移行時の対応表 (Prisma -> Firestore)

| Prisma モデル / フィールド | 移行先 | 備考 |
|---------------------------|--------|------|
| `User` | `users/{uid}` ドキュメント + Firebase Auth | password / accounts / sessions / verificationToken は Firebase が管理。**移行不要**で削除。 |
| `User.email`, `name`, `image` | Firebase Auth プロファイル + `users/{uid}` ミラー | `users/{uid}.email`, `.displayName`, `.photoURL` |
| `Account` (NextAuth) | **廃止** | Firebase Auth が OAuth プロバイダを管理 |
| `Session` (NextAuth) | **廃止** | Firebase ID Token (JWT) で代替 |
| `VerificationToken` | **廃止** | Firebase の email verification 機能を使用 |
| `Course` | `users/{uid}/courses/{courseId}` | `id` は Firestore 自動 ID。`termStart`/`termEnd` は文字列 |
| `Course.dayOfWeek` enum | 文字列 (`"MONDAY"` 等) | Firestore に enum 型はないため |
| `Shift` | `users/{uid}/shifts/{shiftId}` | `date` を `DateTime` -> 文字列 `"YYYY-MM-DD"` に変更 (M-1) |
| `PeriodSetting` (1 ユーザー 1 行) | `users/{uid}/settings/periods` (単一ドキュメント) | `periods` フィールドは map |
| `createdAt`/`updatedAt` | Firestore Timestamp + `FieldValue.serverTimestamp()` | 維持 |

### 13.1 既存データのエクスポート/インポート (運用)

開発環境であれば再投入で問題ない。本番データがある場合:
1. `prisma db pull` で既存データを JSON エクスポート
2. 変換スクリプトで Firestore 形式へ整形 (特に `date` を `Date -> "YYYY-MM-DD"` に変換)
3. Firebase Admin SDK の `batch.set` で投入

---

## 14. 実装の優先順位リスト

### Phase 0: Firebase 基盤構築 (1〜2 日)

| # | タスク | 詳細 |
|---|--------|------|
| 0.1 | Prisma / NextAuth 撤去 | 関連ファイル削除、`package.json` 整理 |
| 0.2 | Firebase プロジェクト作成 | Auth (Email/Google) 有効化、Firestore 作成 |
| 0.3 | `src/lib/env.ts` 作成 | 起動時バリデーション (H-3, H-4) |
| 0.4 | `src/lib/firebase-client.ts` / `firebase-admin.ts` | 初期化 |
| 0.5 | `firestore.rules` / `firestore.indexes.json` | デプロイ |
| 0.6 | `middleware.ts` | Authorization 必須化 (H-1 多層化の 1 層目) |

### Phase 1: 認証 (1〜2 日)

| # | タスク |
|---|--------|
| 1.1 | `AuthProvider`, `useAuth` 実装 |
| 1.2 | ログイン / 新規登録 / Google OAuth 画面 (パスワード 8 文字 — L-2) |
| 1.3 | `src/types/auth.ts` (`AuthUser`) と DTO 基盤 (`src/types/api.ts`) — H-6, L-3 |
| 1.4 | `apiFetch` (ID Token ヘッダ付与) |
| 1.5 | `requireAuth` / `withAuth` ヘルパ — H-1 |

### Phase 2: 時刻/日付ユーティリティと既存リファクタ (1 日)

| # | タスク |
|---|--------|
| 2.1 | `src/lib/time.ts` (toMinutes/fromMinutes/diffMinutes/isValidHHmm) — H-2, H-4 |
| 2.2 | `src/lib/date.ts` ラッパ (isBefore/isAfter/isSameDay) — M-6 |
| 2.3 | 既存コードの `parseInt(startTime, 10)` 系を一掃 |
| 2.4 | `src/lib/validation.ts` 整備 (Zod, periodConfig.end>start — M-3) |
| 2.5 | `any` 全廃, `CalendarEvent` ユニオン導入 — M-4 |

### Phase 3: Firestore CRUD API (2〜3 日)

| # | タスク |
|---|--------|
| 3.1 | `/api/courses` (GET/POST/PUT/DELETE) Firestore 化 |
| 3.2 | `/api/courses/bulk` (PeriodSetting 参照) |
| 3.3 | `/api/shifts` (GET の `date` 文字列範囲検索 — M-7) |
| 3.4 | `/api/shifts/bulk` |
| 3.5 | `/api/settings/periods` |
| 3.6 | `/api/free-slots` |
| 3.7 | `dto.ts` 変換層整備 |

### Phase 4: カレンダー UI (3〜4 日)

| # | タスク |
|---|--------|
| 4.1 | 日/週/月ビュー (既存) を DTO 型ベースに移行 |
| 4.2 | カレンダー上の授業/シフト表示、イベント詳細モーダル |
| 4.3 | 時間割管理ページ、シフト管理ページの CRUD |

### Phase 5: OCR (3 日)

| # | タスク |
|---|--------|
| 5.1 | Tesseract.js confidence を実値で取得 — M-2 |
| 5.2 | 時間割パーサ MM/DD と HH:mm の競合解消、年またぎ — L-4 |
| 5.3 | `TimetableOcrEditor` 実装 — M-8 |
| 5.4 | `ShiftOcrEditor` 実装 — M-8 |
| 5.5 | OCR -> bulk API 連携 |

### Phase 6: 空き時間 (1〜2 日)

| # | タスク |
|---|--------|
| 6.1 | `calculateFreeSlots` (区間マージ) を `toMinutes`/`fromMinutes` ベースで実装 |
| 6.2 | `/free-time` ページ。`minDuration` デフォルト 30 分 — M-5 |
| 6.3 | フィルタ UI (期間, 最小時間) |

### Phase 7: 仕上げ (2 日)

| # | タスク |
|---|--------|
| 7.1 | エラーハンドリング (catch を `unknown`、`AuthError`) |
| 7.2 | Firestore クエリログを開発環境のみに — L-1 |
| 7.3 | レスポンシブ、トースト、ローディング |
| 7.4 | デプロイ (Vercel + Firebase rules/indexes) |

---

## 15. 補足: レビュー指摘のトレーサビリティ

| 指摘 ID | 対応箇所 |
|---------|---------|
| H-1 | §6.1 `withAuth`, §6.4 middleware |
| H-2 | §11 `toMinutes` 規約 |
| H-3 | §5 `env.ts` 検証, `|| ''` 禁止 |
| H-4 | §5 env.ts / §11 time.ts 新規 |
| H-6 | §8 DTO 型, §9 ファイル構成 |
| M-1 | §3 Shift.date 文字列 |
| M-2 | §12.3 confidence 実値 |
| M-3 | §11.3 periodConfigSchema refine |
| M-4 | §8 CalendarEvent, Phase 2.5 |
| M-5 | Phase 6.2 minDuration=30 |
| M-6 | §11.2 isBefore/isAfter/isSameDay |
| M-7 | §3 date 文字列, §6.2 shifts クエリ |
| M-8 | §12 OCR エディタ |
| L-1 | Phase 7.2 |
| L-2 | §7.4 パスワード 8 文字 |
| L-3 | §8.1 AuthUser, §9.2 next-auth.d.ts 削除 |
| L-4 | §12.3 MM/DD 競合解消 |

---

## 16. 将来の拡張 (スコープ外)

- Firestore からのリアルタイム同期 (`onSnapshot`) によるマルチデバイス同期
- Google Calendar / Apple Calendar 連携
- プッシュ通知 (Firebase Cloud Messaging)
- 複数学期、友人との予定共有
