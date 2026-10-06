'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * 반응형 셸 (기획서 5절):
 *  <768px   하단 탭 바 4개, 1컬럼
 *  768~1024 좌측 아이콘 사이드바 72px
 *  ≥1024    좌측 사이드바 240px + 콘텐츠 720px + 우측 보조 패널 320px
 */
const NAV = [
  { href: '/learn', label: '학습', icon: '📚' },
  { href: '/review', label: '복습', icon: '🔁' },
  { href: '/profile', label: '프로필', icon: '👤' },
  { href: '/settings', label: '설정', icon: '⚙️' },
] as const;

export function AppShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="주 메뉴"
        className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t bg-(--color-surface) py-1 pb-[max(env(safe-area-inset-bottom),4px)] md:static md:w-[72px] md:flex-col md:justify-start md:gap-1 md:border-t-0 md:border-r md:px-2 md:py-6 lg:w-60 lg:px-4"
        style={{ borderColor: 'var(--color-line)' }}
      >
        <Link href="/learn" className="mb-6 hidden px-3 text-xl font-black text-(--color-brand) lg:block">
          CS 데일리
        </Link>
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-xs font-semibold md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2 md:text-sm',
                active ? 'bg-(--color-brand)/10 text-(--color-brand)' : 'text-(--color-ink-2) hover:bg-(--color-surface-2)',
              )}
            >
              <span aria-hidden className="text-xl md:text-lg">
                {n.icon}
              </span>
              <span className="md:hidden lg:inline">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <main className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-4 md:px-6 md:pb-8 md:pt-8">{children}</main>

      {aside && (
        <aside className="hidden w-80 shrink-0 space-y-4 px-4 py-8 lg:block" aria-label="보조 패널">
          {aside}
        </aside>
      )}
    </div>
  );
}
