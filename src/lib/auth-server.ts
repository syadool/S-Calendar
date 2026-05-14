import { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export interface AuthUser {
  uid: string;
  email: string | null;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
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
  handler: (req: NextRequest, ctx: { user: AuthUser; params?: Record<string, string> }) => Promise<T>
) {
  return async (req: NextRequest, ctx: { params?: Record<string, string> }) => {
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
