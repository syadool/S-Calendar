import { z } from 'zod';

const serverSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// サーバー側 (Node ランタイムでのみ評価)
export const serverEnv = (() => {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv must not be imported on the client');
  }
  const r = serverSchema.safeParse(process.env);
  if (!r.success) throw new Error('Invalid server env: ' + JSON.stringify(r.error.format()));
  return r.data;
})();
