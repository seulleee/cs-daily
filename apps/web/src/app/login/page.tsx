export const metadata = { title: '로그인' };

/** OAuth 시작 링크. /auth/*는 next.config 리라이트로 NestJS에 전달된다 */
export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl" aria-hidden>📚</div>
      <h1 className="mt-4 text-3xl font-black text-(--color-brand)">CS 데일리</h1>
      <p className="mt-2 text-(--color-ink-2)">하루 5분, 매일 푸는 컴퓨터 사이언스</p>
      <div className="mt-10 w-full space-y-3">
        <a href="/auth/github" className="btn-3d w-full" style={{ background: '#24292f', boxShadow: '0 4px 0 #000' }}>GitHub로 계속하기</a>
        <a href="/auth/google" className="btn-3d w-full">Google로 계속하기</a>
      </div>
      <p className="mt-8 text-xs text-(--color-ink-2)">로그인하면 이메일과 닉네임만 저장됩니다. 언제든 설정에서 탈퇴할 수 있어요.</p>
    </div>
  );
}
