'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { MeResponse } from '@cs-daily/contracts';
import { api } from '@/lib/api';
import { BookOpenIcon, RepeatIcon, SettingsIcon, UserIcon, type IconProps } from './icons';

/**
 * 반응형 셸 (기획서 5절):
 *  <768px   하단 탭 바 4개(높이 64), 1컬럼
 *  768~1024 좌측 아이콘 사이드바 72px
 *  ≥1024    좌측 사이드바 240px + 콘텐츠 720px + 우측 보조 패널 320px
 */
const NAV: readonly { href: string; label: string; Icon: (p: IconProps) => ReactNode }[] = [
  { href: '/learn', label: '학습', Icon: BookOpenIcon },
  { href: '/review', label: '복습', Icon: RepeatIcon },
  { href: '/profile', label: '프로필', Icon: UserIcon },
  { href: '/settings', label: '설정', Icon: SettingsIcon },
];

export function AppShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const pathname = usePathname();
  // 각 화면이 쓰는 ['me'] 쿼리와 같은 키라 요청은 하나로 합쳐진다. 복습 탭 배지에만 쓴다
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/me') });
  const due = me.data?.dueReviewCount ?? 0;

  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="주 메뉴"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-ink bg-surface pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:h-dvh md:w-[72px] md:shrink-0 md:border-t-0 md:border-r md:px-2 md:py-6 md:pb-6 lg:w-60 lg:px-4"
      >
        <Link href="/learn" className="bit-2 mb-6 hidden px-3 text-ink lg:block">
          CS 데일리
        </Link>
        <ul className="grid h-16 grid-cols-4 md:h-auto md:grid-cols-1 md:gap-2">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            const badge = href === '/review' && due > 0 ? (due > 99 ? '99+' : String(due)) : null;
            return (
              <li key={href} className="min-w-0 p-1 md:p-0">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={badge ? `${label}, 복습할 문제 ${due}개` : label}
                  className={clsx(
                    // 선택 탭 = 아이콘+라벨 반전 상자(반경 6). 라벨은 비트맵 16px, 줄 높이 16
                    'bit flex h-full min-h-11 flex-col items-center justify-center gap-0.5 rounded-md leading-4! md:h-auto md:flex-row md:justify-center md:gap-3 md:px-3 md:py-2.5 lg:justify-start',
                    // 누르는 동안은 반대로 뒤집힌다(즉시, 손을 떼면 즉시 복귀). 선택 전환에도 전환 효과 없이 바로 바뀐다
                    active ? 'bg-brand-fill text-on-brand active:bg-surface active:text-ink' : 'text-ink-2 active:bg-brand-fill active:text-on-brand',
                  )}
                >
                  <span className="relative">
                    <Icon size={24} />
                    {badge && (
                      <span
                        aria-hidden
                        className="bit absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center border border-ink bg-surface px-1 leading-4! text-ink"
                      >
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="md:hidden lg:ml-2 lg:inline">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-[720px] px-4 pb-28 pt-4 md:px-6 md:pb-8 md:pt-8">{children}</main>

      {aside && (
        <aside className="hidden w-80 shrink-0 space-y-4 px-4 py-8 lg:block" aria-label="보조 패널">
          {aside}
        </aside>
      )}
    </div>
  );
}
