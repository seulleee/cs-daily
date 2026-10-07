'use client';

import { useEffect, useState } from 'react';
import { applyThemePref, readThemePref, type ThemePref } from '@/lib/theme';

const OPTIONS: { value: ThemePref; label: string; icon: string; desc: string }[] = [
  { value: 'system', label: '시스템', icon: '🖥️', desc: '기기 설정 따름' },
  { value: 'light', label: '라이트', icon: '☀️', desc: '항상 밝게' },
  { value: 'dark', label: '다크', icon: '🌙', desc: '항상 어둡게' },
];

/** 고르는 즉시 적용·저장된다(이 기기 기준). 프로필 저장 버튼과 무관 */
export function ThemePicker() {
  const [pref, setPref] = useState<ThemePref>('system');
  useEffect(() => setPref(readThemePref()), []);

  return (
    <div role="radiogroup" aria-label="테마" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          data-selected={pref === o.value}
          onClick={() => {
            applyThemePref(o.value);
            setPref(o.value);
          }}
          className="option text-center font-bold"
        >
          <span aria-hidden>{o.icon}</span> {o.label}
          <div className="text-xs font-normal text-(--color-ink-2)">{o.desc}</div>
        </button>
      ))}
    </div>
  );
}
