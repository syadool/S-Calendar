import { NextResponse, NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // /api/* (auth/session 以外) は Authorization ヘッダ必須 (H-1 多層化)
  // /api/auth/* 除外: 将来 Cookie セッション用の予約。現状該当エンドポイントなし
  if (
    req.nextUrl.pathname.startsWith('/api/') &&
    !req.nextUrl.pathname.startsWith('/api/auth/')
  ) {
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
