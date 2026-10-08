import type { Metadata } from 'next';
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page';

export const metadata: Metadata = { title: '서비스 약관' };

const CONTACT = 'gkstmvdl@gmail.com';

export default function TermsPage() {
  return (
    <LegalPage current="/terms" title="서비스 약관" effectiveDate="2026-10-08">
      <LegalSection heading="제1조 목적과 정의">
        <p>
          이 약관은 CS 데일리(https://cs-daily-iota.vercel.app, 이하 &ldquo;서비스&rdquo;)의 이용 조건과 운영자·이용자의 권리와 의무를 안내합니다.
          &ldquo;운영자&rdquo;는 서비스를 만들고 운영하는 사람, &ldquo;이용자&rdquo;는 이 약관에 따라 서비스를 이용하는 사람을 말합니다.
        </p>
      </LegalSection>

      <LegalSection heading="제2조 계정">
        <LegalList>
          <li>이용자는 GitHub 또는 Google 계정으로 로그인해 서비스를 이용합니다.</li>
          <li>계정은 1인 1계정을 원칙으로 합니다.</li>
          <li>이용자는 자신의 계정을 안전하게 관리할 책임이 있습니다.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="제3조 서비스 내용">
        <p>서비스는 CS 학습 문제, 복습, 진도 기록을 제공하며 무료입니다. 서비스의 내용은 예고 없이 변경되거나 중단될 수 있습니다.</p>
      </LegalSection>

      <LegalSection heading="제4조 이용자의 의무">
        <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
        <LegalList>
          <li>부정한 방법으로 접근하거나 자동화 도구로 서비스를 방해하는 행위</li>
          <li>서비스의 콘텐츠를 무단으로 복제·배포하는 행위</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="제5조 콘텐츠의 저작권">
        <p>서비스의 문제와 해설에 대한 권리는 운영자에게 있습니다. 이용자는 개인 학습 목적으로 자유롭게 이용할 수 있습니다.</p>
      </LegalSection>

      <LegalSection heading="제6조 면책">
        <p>
          운영자는 학습 콘텐츠를 최대한 정확하게 유지하려 노력하지만 오류가 있을 수 있습니다. 서비스 중단으로 생긴 손해에 대한 운영자의 책임은 법이 허용하는 범위에서 제한됩니다.
        </p>
      </LegalSection>

      <LegalSection heading="제7조 계정 해지">
        <p>이용자가 요청하거나 이 약관을 위반한 경우 계정을 해지할 수 있습니다. 해지 후 개인정보는 개인정보처리방침에 따라 처리됩니다.</p>
      </LegalSection>

      <LegalSection heading="제8조 준거법">
        <p>이 약관은 대한민국 법에 따라 해석되고 적용됩니다.</p>
      </LegalSection>

      <LegalSection heading="제9조 문의">
        <p>
          서비스와 약관에 대한 문의는 <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">{CONTACT}</a>로 보내 주세요.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
