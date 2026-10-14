import clsx from 'clsx';
import { useId, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';

/**
 * 창(Window) 크롬 — 디자인 "Platinum"의 기억에 남는 요소.
 * 1px ink 테두리, 각진 모서리, 블러 없는 2px 그림자. 타이틀바(높이 24)는 가로 줄무늬 위에 제목 상자를 올려 줄무늬를 끊고 가운데 정렬한다.
 * `onClose`가 있을 때만 왼쪽에 12px 닫기 상자(<button aria-label="닫기">)를 그린다.
 * 모양은 전부 globals.css의 .win · .win-bar · .win-title · .win-close. 제목은 창의 접근 가능한 이름(aria-labelledby)이기도 하다.
 *
 * 쓰는 곳: 학습 홈 히어로, 정·오답 시트, 결과 카드, 복습 카드, 로그인 카드, 온보딩 단계, 설정 섹션.
 * 유닛 목록·학습 경로·프로필 통계는 창 없이 평평하게(.card) 둔다.
 */
export function Window({
  title,
  onClose,
  className,
  bodyClassName = 'p-4',
  bodyStyle,
  bodyProps,
  children,
}: {
  title: string;
  onClose?: () => void;
  className?: string;
  /** 본문 영역(타이틀바 아래)의 클래스. 기본 패딩 16px */
  bodyClassName?: string;
  bodyStyle?: CSSProperties;
  /** 본문 div에 그대로 넘기는 속성(ref·tabIndex·aria-label·role). 스크롤되는 본문을 키보드로 닿게 할 때 쓴다 */
  bodyProps?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={clsx('win', className)}>
      <div className="win-bar">
        {onClose && <button type="button" aria-label="닫기" onClick={onClose} className="win-close" />}
        <span id={titleId} className="win-title">
          {title}
        </span>
      </div>
      <div {...bodyProps} className={bodyClassName} style={bodyStyle}>
        {children}
      </div>
    </section>
  );
}
