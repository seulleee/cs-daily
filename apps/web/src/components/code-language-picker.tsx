'use client';

import { CODING_LANGUAGES, CODING_LANGUAGE_LABEL, type CodingLanguage } from '@cs-daily/contracts';
import { SelectMark } from './select-mark';

/**
 * 코딩 테스트 트랙의 코드 문제를 풀 언어 선택. 설정 화면의 "하루 목표" 카드와 같은 라디오 타일(2×2).
 * 설정·온보딩이 함께 쓴다.
 */
export function CodeLanguagePicker({ value, onChange, labelledBy }: { value: CodingLanguage; onChange: (lang: CodingLanguage) => void; labelledBy?: string }) {
  return (
    <div role="radiogroup" {...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': '코딩 테스트 언어' })} className="grid grid-cols-2 gap-2">
      {CODING_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          role="radio"
          aria-checked={value === lang}
          data-selected={value === lang}
          onClick={() => onChange(lang)}
          className="option pt-9 text-center"
        >
          <SelectMark corner />
          <span className="bit">{CODING_LANGUAGE_LABEL[lang]}</span>
        </button>
      ))}
    </div>
  );
}
