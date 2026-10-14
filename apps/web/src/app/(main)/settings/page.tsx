'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { MeResponse, TrackSummary, UpdateMeRequest } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { SelectMark } from '@/components/select-mark';
import { useToast } from '@/components/toast';
import { ThemePicker } from '@/components/theme-picker';
import { Window } from '@/components/window';

export default function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/me') });
  const tracks = useQuery({ queryKey: ['tracks'], queryFn: () => api<TrackSummary[]>('/tracks') });

  const [form, setForm] = useState<UpdateMeRequest>({});
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => {
    if (me.data) {
      setForm({ nickname: me.data.user.nickname, dailyGoal: me.data.user.dailyGoal, reminderAt: me.data.user.reminderAt, timezone: me.data.user.timezone });
      setSelected(me.data.tracks.map((t) => t.id));
    }
  }, [me.data]);

  const save = useMutation({
    mutationFn: async () => {
      await api('/me', { method: 'PATCH', json: form });
      await api('/me/tracks', { method: 'PUT', json: { trackIds: selected } });
    },
    onSuccess: () => {
      toast.show('저장했어요');
      return qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => toast.show(err instanceof ApiError ? err.message : '저장하지 못했어요', { kind: 'error' }),
  });
  const logout = useMutation({
    mutationFn: () => fetch('/auth/logout', { method: 'POST', credentials: 'include' }).then(() => undefined),
    onSuccess: () => {
      qc.clear();
      window.location.href = '/login';
    },
  });

  if (!me.data) return <AppShell><p className="text-ink-2">불러오는 중…</p></AppShell>;

  return (
    <AppShell>
      <h1 className="bit-2 mb-6">설정</h1>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Window title="계정" bodyClassName="space-y-6 p-5">
          <Field label="닉네임">
            <input className="input" value={form.nickname ?? ''} onChange={(e) => setForm({ ...form, nickname: e.target.value })} minLength={2} maxLength={30} />
          </Field>

          <Field label="리마인더 (이메일)">
            <div className="flex items-center gap-3">
              <input type="time" className="input bit w-36" value={form.reminderAt ?? ''} onChange={(e) => setForm({ ...form, reminderAt: e.target.value || null })} />
              <button type="button" className="min-h-11 px-2 text-body text-ink-2 underline underline-offset-4" onClick={() => setForm({ ...form, reminderAt: null })}>끄기</button>
            </div>
          </Field>

          <Field label="타임존">
            <input className="input" value={form.timezone ?? ''} onChange={(e) => setForm({ ...form, timezone: e.target.value })} list="tz" />
            <datalist id="tz">{['Asia/Seoul', 'Asia/Tokyo', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'UTC'].map((z) => <option key={z} value={z} />)}</datalist>
          </Field>
        </Window>

        <Window title="학습" bodyClassName="space-y-6 p-5">
          <Field label="하루 목표 (레슨 수)">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" data-selected={form.dailyGoal === n} onClick={() => setForm({ ...form, dailyGoal: n })} className="option pt-9 text-center">
                  <SelectMark corner />
                  <span className="bit">{n}개</span>
                  <div className="text-cap text-ink-2">{['가볍게', '꾸준히', '진지하게'][n - 1]}</div>
                </button>
              ))}
            </div>
          </Field>

          <Field label="학습 트랙 (최소 1개)">
            <div className="grid gap-2 sm:grid-cols-2">
              {tracks.data?.map((t) => {
                const on = selected.includes(t.id);
                return (
                  <button key={t.id} type="button" data-selected={on} onClick={() => setSelected(on ? selected.filter((id) => id !== t.id) : [...selected, t.id])} className="option flex items-center gap-3">
                    <SelectMark kind="box" />
                    <span className="block min-w-0 flex-1">
                      <span className="block font-semibold">{t.name}</span>
                      <span className="bit block text-ink-2">{t.unitCount}유닛 · {t.lessonCount}레슨</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <button type="submit" disabled={save.isPending || selected.length === 0} className="btn-3d w-full">저장</button>
        </Window>
      </form>

      <Window title="테마" className="mt-6" bodyClassName="p-5">
        <ThemePicker />
        <p className="mt-3 text-cap text-ink-2">고르는 즉시 적용되며 이 기기에 저장됩니다.</p>
      </Window>

      <button type="button" onClick={() => logout.mutate()} className="mt-8 min-h-11 w-full text-body text-ink-2 underline underline-offset-4">로그아웃</button>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="bit mb-2 block">{label}</span>
      {children}
    </label>
  );
}
