/**
 * 선택 표시: 16px 라디오 원(단일 선택) 또는 체크 상자(복수 선택). 꾸밈일 뿐이라 aria-hidden.
 * 켜짐/꺼짐은 부모 `.option`의 data-selected / data-state를 CSS가 따라가므로 prop이 필요 없다 (globals.css .mark).
 * `corner`: 타일형 보기(OX·목표·테마)에서 왼쪽 위 모서리에 놓는다. `className`: 여러 줄 보기에서 첫 줄에 맞추는 mt-1 같은 위치 보정.
 */
export function SelectMark({ kind = 'radio', corner = false, className = '' }: { kind?: 'radio' | 'box'; corner?: boolean; className?: string }) {
  return <span aria-hidden className={`mark${kind === 'box' ? ' mark-box' : ''}${corner ? ' mark-corner' : ''}${className ? ` ${className}` : ''}`} />;
}
