'use client';

import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase-client';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/calendar', label: 'カレンダー' },
  { href: '/free-time', label: '空き時間' },
];

export function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/calendar" className="text-xl font-bold text-gray-900">
            学生カレンダー
          </Link>

          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-sm text-gray-700 hidden md:inline">
                  {user.displayName ?? user.email}
                </span>
                <Button variant="secondary" size="sm" onClick={handleSignOut}>
                  ログアウト
                </Button>
              </>
            )}
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto -mb-px" role="tablist">
          {TABS.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
