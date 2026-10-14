import Link from 'next/link';
import { TraceMark } from '@/components/icons';
import { Window } from '@/components/window';

export const metadata = { title: '로그인' };

/** OAuth 시작 링크. /auth/*는 next.config 리라이트로 NestJS에 전달된다 */
export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center p-6 text-center">
      <Window title="CS 데일리" className="w-full" bodyClassName="flex flex-col items-center p-8">
        <TraceMark size={48} className="text-ink" />
        <h1 className="bit-2 mt-4">CS 데일리</h1>
        <p className="mt-2 text-body text-ink-2">하루 5분, 매일 푸는 컴퓨터 사이언스</p>
        <div className="mt-8 w-full space-y-4">
          <a href="/auth/google" className="btn-3d w-full">Google로 계속하기</a>
          <a href="/auth/github" className="btn-outline w-full">GitHub로 계속하기</a>
        </div>
      </Window>
      <p className="mt-8 text-cap text-ink-2">로그인하면 이메일과 닉네임만 저장됩니다. 언제든 설정에서 탈퇴할 수 있어요.</p>
      <p className="mt-2 text-cap text-ink-2">
        <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link>
        {' · '}
        <Link href="/terms" className="underline underline-offset-2">서비스 약관</Link>
      </p>
    </div>
  );
}
