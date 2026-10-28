'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { FriendsResponse, MeResponse } from '@cs-daily/contracts';
import { api } from '@/lib/api';
import { BookOpenIcon, RepeatIcon, SettingsIcon, UserIcon, UsersIcon, type IconProps } from './icons';

/**
 * 반응형 셸 (기획서 5절):
 *  <768px   하단 탭 바 5개(높이 64), 1컬럼
 *  768~1024 좌측 아이콘 사이드바 72px
 *  ≥1024    좌측 사이드바 240px + 콘텐츠 720px + 우측 보조 패널 320px
 */
const NAV: readonly { href: string; label: string; Icon: (p: IconProps) => ReactNode }[] = [
  { href: '/learn', label: '학습', Icon: BookOpenIcon },
  { href: '/review', label: '복습', Icon: RepeatIcon },
  { href: '/friends', label: '친구', Icon: UsersIcon },
  { href: '/profile', label: '프로필', Icon: UserIcon },
  { href: '/settings', label: '설정', Icon: SettingsIcon },
];

export function AppShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const pathname = usePathname();
  // 각 화면이 쓰는 ['me'] 쿼리와 같은 키라 요청은 하나로 합쳐진다. 복습 탭 배지에만 쓴다
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/me') });
  const due = me.data?.dueReviewCount ?? 0;
  // 친구 탭 배지: 받은 요청 수. /friends 페이지와 같은 키라 요청은 하나로 합쳐진다
  const friends = useQuery({ queryKey: ['friends'], queryFn: () => api<FriendsResponse>('/friends') });
  const incoming = friends.data?.incoming.length ?? 0;

  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="주 메뉴"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-ink bg-surface pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:h-dvh md:w-[72px] md:shrink-0 md:border-t-0 md:border-r md:px-2 md:py-6 md:pb-6 lg:w-60 lg:px-4"
      >
        <Link href="/learn" className="bit-2 mb-6 hidden px-3 text-ink lg:block">
          CS 데일리
        </Link>
        <ul className="grid grid-cols-5 md:grid-cols-1 md:gap-2">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            const count = href === '/review' ? due : href === '/friends' ? incoming : 0;
            const badge = count > 0 ? (count > 99 ? '99+' : String(count)) : null;
            const badgeLabel = href === '/review' ? `복습할 문제 ${count}개` : `받은 친구 요청 ${count}개`;
            return (
              <li key={href} className="min-w-0">
                {/*
                  탭 한 칸(모바일): 아이콘 타일(28) → 라벨(16), 간격 2, 위 6·아래 4 = 높이 56. 가운데 정렬.
                  선택은 칸 전체가 아니라 아이콘 타일만 반전한다(ink 배경 + on-brand 아이콘). 라벨은 선택 여부와 상관없이 ink.
                  누르는 동안(:active)도 타일만 뒤집힌다(선택 안 된 탭은 반전, 선택된 탭은 반전이 풀림). 전환 효과 없음.
                  사이드바(md 이상)는 같은 규칙으로 타일 + 가로 라벨.
                */}
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={badge ? `${label}, ${badgeLabel}` : label}
                  className="group flex h-14 flex-col items-center justify-start gap-0.5 pb-1 pt-1.5 md:h-auto md:flex-row md:justify-center md:gap-3 md:px-3 md:py-2 lg:justify-start"
                >
                  <span
                    className={clsx(
                      'relative flex h-7 w-7 shrink-0 items-center justify-center',
                      active
                        ? 'bg-brand-fill text-on-brand group-active:bg-surface group-active:text-ink'
                        : 'text-ink group-active:bg-brand-fill group-active:text-on-brand',
                    )}
                  >
                    <Icon size={22} />
                    {/* 배지: 타일의 오른쪽 위 모서리에 걸친다. 바깥 1px 바탕색 테두리로 아이콘과 갈라 놓는다. 11px Plex Mono는 비트맵 16px 아래라 번지므로 쓰지 않는 크기지만, 이 작은 칩만 예외 */}
                    {badge && (
                      <span
                        aria-hidden
                        className="absolute -right-2.5 -top-1.5 flex h-4 items-center justify-center border border-surface bg-brand-fill px-[3px] font-mono text-[11px] font-semibold leading-none text-on-brand"
                      >
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="bit text-center leading-4! text-ink md:hidden lg:ml-2 lg:inline">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-[720px] px-4 pb-[calc(env(safe-area-inset-bottom)+81px)] pt-4 md:px-6 md:pb-8 md:pt-8">{children}</main>

      {aside && (
        <aside className="hidden w-80 shrink-0 space-y-4 px-4 py-8 lg:block" aria-label="보조 패널">
          {aside}
        </aside>
      )}
    </div>
  );
}
