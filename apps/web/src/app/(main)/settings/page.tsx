'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { MeResponse, TrackSummary, UpdateMeRequest } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';

export default function SettingsPage() {
  const qc = useQueryClient();
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
  const logout = useMutation({
    mutationFn: () => fetch('/auth/logout', { method: 'POST', credentials: 'include' }).then(() => undefined),
    onSuccess: () => {
      qc.clear();
      window.location.href = '/login';
    },
  });

  if (!me.data) return <AppShell><p className="text-(--color-ink-2)">불러오는 중…</p></AppShell>;

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-black">설정</h1>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="닉네임">
          <input className="input" value={form.nickname ?? ''} onChange={(e) => setForm({ ...form, nickname: e.target.value })} minLength={2} maxLength={30} />
        </Field>

        <Field label="하루 목표 (레슨 수)">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" data-selected={form.dailyGoal === n} onClick={() => setForm({ ...form, dailyGoal: n })} className="option text-center font-bold">
                {n}개
                <div className="text-xs font-normal text-(--color-ink-2)">{['가볍게', '꾸준히', '진지하게'][n - 1]}</div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="리마인더 (이메일)">
          <div className="flex items-center gap-3">
            <input type="time" className="input w-36" value={form.reminderAt ?? ''} onChange={(e) => setForm({ ...form, reminderAt: e.target.value || null })} />
            <button type="button" className="text-sm text-(--color-ink-2) underline" onClick={() => setForm({ ...form, reminderAt: null })}>끄기</button>
          </div>
        </Field>

        <Field label="타임존">
          <input className="input" value={form.timezone ?? ''} onChange={(e) => setForm({ ...form, timezone: e.target.value })} list="tz" />
          <datalist id="tz">{['Asia/Seoul', 'Asia/Tokyo', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'UTC'].map((z) => <option key={z} value={z} />)}</datalist>
        </Field>

        <Field label="학습 트랙 (최소 1개)">
          <div className="grid gap-2 sm:grid-cols-2">
            {tracks.data?.map((t) => {
              const on = selected.includes(t.id);
              return (
                <button key={t.id} type="button" data-selected={on} onClick={() => setSelected(on ? selected.filter((id) => id !== t.id) : [...selected, t.id])} className="option">
                  <div className="font-bold">{t.name}</div>
                  <div className="text-xs text-(--color-ink-2)">{t.unitCount}유닛 · {t.lessonCount}레슨</div>
                </button>
              );
            })}
          </div>
        </Field>

        {save.isError && <p className="text-sm text-(--color-wrong)">{(save.error as ApiError).message}</p>}
        {save.isSuccess && <p className="text-sm text-(--color-correct)">저장했습니다.</p>}
        <button type="submit" disabled={save.isPending || selected.length === 0} className="btn-3d w-full">저장</button>
      </form>

      <button type="button" onClick={() => logout.mutate()} className="mt-10 w-full text-sm text-(--color-ink-2) underline">로그아웃</button>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
