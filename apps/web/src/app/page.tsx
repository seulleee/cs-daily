import { redirect } from 'next/navigation';

/** 루트는 학습 홈으로. 미로그인은 middleware가 /login으로 보낸다 */
export default function Home() {
  redirect('/learn');
}
