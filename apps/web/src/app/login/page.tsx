import Link from 'next/link';
import { TraceMark } from '@/components/icons';

export const metadata = { title: '로그인' };

/** OAuth 시작 링크. /auth/*는 next.config 리라이트로 NestJS에 전달된다 */
export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center p-6 text-center">
      <TraceMark size={56} className="text-brand" />
      <h1 className="mt-4 text-h2 font-semibold">CS 데일리</h1>
      <p className="mt-2 text-body text-ink-2">하루 5분, 매일 푸는 컴퓨터 사이언스</p>
      <div className="mt-10 w-full space-y-3">
        <a href="/auth/github" className="btn-3d w-full">GitHub로 계속하기</a>
        <a href="/auth/google" className="btn-outline w-full">Google로 계속하기</a>
      </div>
      <p className="mt-8 text-cap text-ink-2">로그인하면 이메일과 닉네임만 저장됩니다. 언제든 설정에서 탈퇴할 수 있어요.</p>
      <p className="mt-2 text-cap text-ink-2">
        <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link>
        {' · '}
        <Link href="/terms" className="underline underline-offset-2">서비스 약관</Link>
      </p>
    </div>
  );
}
