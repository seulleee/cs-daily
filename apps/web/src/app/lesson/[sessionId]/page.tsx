import { LessonPlayer } from '@/components/lesson-player';

export const metadata = { title: '레슨' };

/** 레슨 플레이어는 네비게이션 없이 풀스크린 (기획서 5절) */
export default async function LessonPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <LessonPlayer sessionId={sessionId} />;
}
