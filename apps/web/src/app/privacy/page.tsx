import type { Metadata } from 'next';
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page';

export const metadata: Metadata = { title: '개인정보처리방침' };

const CONTACT = 'gkstmvdl@gmail.com';

export default function PrivacyPage() {
  return (
    <LegalPage current="/privacy" title="개인정보처리방침" effectiveDate="2026-10-08">
      <p className="mt-6 text-[15px] leading-7">
        CS 데일리(https://cs-daily-iota.vercel.app, 이하 &ldquo;서비스&rdquo;)는 어떤 정보를 왜 모으고 어떻게 보관하는지 아래와 같이 안내합니다.
        운영자 연락처는 <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">{CONTACT}</a>입니다.
      </p>

      <LegalSection heading="1. 수집하는 정보">
        <p>GitHub 또는 Google 계정으로 로그인할 때 다음 정보를 제공받습니다.</p>
        <LegalList>
          <li>이메일</li>
          <li>닉네임(또는 사용자명)</li>
          <li>프로필 이미지 URL</li>
          <li>로그인 제공자 식별자</li>
        </LegalList>
        <p>서비스를 이용하는 동안 다음 정보가 생성되어 저장됩니다.</p>
        <LegalList>
          <li>학습 기록: 푼 문제, 정오답, 소요 시간, XP, 스트릭, 복습 일정</li>
          <li>설정값: 하루 목표, 리마인더 시각, 타임존, 학습 트랙</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="2. 이용 목적">
        <LegalList>
          <li>로그인과 계정 식별</li>
          <li>학습 진도와 복습 일정 제공</li>
          <li>이용자가 설정한 경우 이메일 리마인더 발송</li>
          <li>서비스 개선을 위한 통계 (개인을 식별하지 않는 형태)</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="3. 보관과 삭제">
        <p>
          회원 탈퇴 또는 삭제 요청 시 개인정보를 지체 없이 삭제합니다. 장애 복구를 위한 백업 사본은 최대 90일이 지나면 자동으로 삭제됩니다.
        </p>
      </LegalSection>

      <LegalSection heading="4. 제3자 제공과 처리 위탁">
        <p>이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 서비스 제공을 위해 아래 업체에 처리를 위탁하며, 서비스 제공 목적 범위에서만 이용됩니다.</p>
        <LegalList>
          <li>호스팅: Vercel, Google Cloud</li>
          <li>데이터베이스: Supabase</li>
          <li>이메일 발송: Resend</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="5. 쿠키와 기기 저장소">
        <LegalList>
          <li>로그인 유지를 위해 HttpOnly 쿠키(<code>cs_access</code>, <code>cs_refresh</code>)를 사용합니다.</li>
          <li>광고·추적 쿠키는 사용하지 않습니다.</li>
          <li>기기 설정(테마, 마지막으로 본 트랙)은 브라우저 localStorage에만 저장되며 서버로 전송되지 않습니다.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="6. 이용자의 권리">
        <p>
          개인정보의 열람·정정·삭제는 <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">{CONTACT}</a>로 요청할 수 있습니다. 설정 화면에서 언제든 로그아웃할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="7. 개인정보 보호책임자">
        <p>
          서비스 운영자가 개인정보 보호책임자를 맡습니다. 문의: <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">{CONTACT}</a>
        </p>
      </LegalSection>

      <LegalSection heading="8. 방침의 변경">
        <p>이 방침이 바뀌면 이 페이지에 공지합니다. 위 시행일은 현재 방침이 적용되기 시작한 날짜입니다.</p>
      </LegalSection>
    </LegalPage>
  );
}
