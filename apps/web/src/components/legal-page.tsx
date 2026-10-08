import Link from 'next/link';
import clsx from 'clsx';
import type { ReactNode } from 'react';

/** 약관·방침 페이지 공통 링크 목록. 푸터에서 두 페이지가 서로 연결된다 */
const LEGAL_LINKS = [
  { href: '/privacy', label: '개인정보처리방침' },
  { href: '/terms', label: '서비스 약관' },
] as const;

type LegalPageProps = {
  /** 현재 페이지 경로. 푸터에서 현재 문서를 표시한다 */
  current: (typeof LEGAL_LINKS)[number]['href'];
  title: string;
  effectiveDate: string;
  children: ReactNode;
};

/**
 * 로그인 없이 열리는 공개 문서 레이아웃 (서버 컴포넌트).
 * 색은 전부 CSS 변수라 라이트/다크 테마를 그대로 따른다.
 */
export function LegalPage({ current, title, effectiveDate, children }: LegalPageProps) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto max-w-[680px] px-4 pt-6">
        <Link href="/" className="text-xl font-black text-(--color-brand)">
          CS 데일리
        </Link>
      </header>
      <main className="mx-auto max-w-[680px] px-4 pb-10 pt-6">
        <article className="card p-6 sm:p-8">
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="mt-2 text-sm text-(--color-ink-2)">시행일 {effectiveDate}</p>
          {children}
        </article>
        <nav aria-label="약관 및 방침" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.href === current ? 'page' : undefined}
              className={clsx(
                'underline underline-offset-4',
                l.href === current ? 'font-bold text-(--color-ink)' : 'text-(--color-ink-2)',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{heading}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}
