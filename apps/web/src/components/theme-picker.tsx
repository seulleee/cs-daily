'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { applyThemePref, readThemePref, type ThemePref } from '@/lib/theme';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';
import { SelectMark } from './select-mark';

const OPTIONS: { value: ThemePref; label: string; icon: ReactNode; desc: string }[] = [
  { value: 'system', label: '시스템', icon: <MonitorIcon size={20} />, desc: '기기 설정 따름' },
  { value: 'light', label: '라이트', icon: <SunIcon size={20} />, desc: '항상 밝게' },
  { value: 'dark', label: '다크', icon: <MoonIcon size={20} />, desc: '항상 어둡게' },
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
          className="option flex flex-col items-center gap-1 px-2 pt-9 text-center"
        >
          <SelectMark corner />
          {o.icon}
          <span className="bit">{o.label}</span>
          <div className="text-cap text-ink-2">{o.desc}</div>
        </button>
      ))}
    </div>
  );
}
