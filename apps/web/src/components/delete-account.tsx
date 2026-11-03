'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MeResponse } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Window } from '@/components/window';

type Step = 'idle' | 'warn' | 'confirm';

/** 설정 "계정 삭제" 창. 같은 자리에서 1단계(무엇을 잃는지) → 2단계(닉네임 입력) 확인 뒤 DELETE /me */
export function DeleteAccount({ className }: { className?: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/me') });
  const [step, setStep] = useState<Step>('idle');
  const [typed, setTyped] = useState('');

  const nickname = me.data?.user.nickname ?? '';
  const streak = me.data?.stats.currentStreak ?? 0;
  const xp = (me.data?.stats.totalXp ?? 0).toLocaleString('ko-KR');
  const matches = nickname !== '' && typed.trim() === nickname;

  const close = () => {
    setStep('idle');
    setTyped('');
  };

  const remove = useMutation({
    mutationFn: () => api('/me', { method: 'DELETE', json: { nickname: typed.trim() } }),
    onSuccess: () => {
      qc.clear();
      router.replace('/login?deleted=1');
    },
    onError: (err) => toast.show(err instanceof ApiError && err.status === 422 ? '닉네임이 맞지 않아요' : err instanceof ApiError ? err.message : '삭제하지 못했어요', { kind: 'error' }),
  });

  return (
    <Window title="계정 삭제" className={className} bodyClassName="p-5">
      {step === 'idle' && (
        <>
          <p className="text-cap text-ink-2">계정을 삭제하면 모든 기록이 지워져요.</p>
          <button type="button" className="btn-outline mt-4" disabled={!me.data} onClick={() => setStep('warn')}>계정 삭제</button>
        </>
      )}
      {step === 'warn' && (
        <div role="group" aria-label="계정 삭제 확인" className="border border-line p-3">
          <p className="font-semibold">지금까지의 기록이 모두 삭제돼요! 정말 삭제하시겠어요?</p>
          <p className="mt-2 text-body">{streak > 0 ? `${streak}일째 스트릭 · ${xp} XP가 사라져요` : `${xp} XP와 학습 기록이 사라져요`}</p>
          <p className="mt-1 text-cap text-ink-2">되돌릴 수 없고, 같은 계정으로 다시 로그인하면 처음부터 시작해요.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-3d" onClick={close}>계속 공부할래요</button>
            <button type="button" className="btn-outline" onClick={() => setStep('confirm')}>그래도 삭제할래요</button>
          </div>
        </div>
      )}
      {step === 'confirm' && (
        <form
          role="group"
          aria-label="계정 삭제 닉네임 확인"
          className="border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches && !remove.isPending) remove.mutate();
          }}
        >
          <label htmlFor="delete-account-nickname" className="block text-body">확인을 위해 닉네임 <span className="font-semibold">{nickname}</span>을 입력하세요</label>
          <input
            id="delete-account-nickname"
            className="input mt-3"
            aria-label="닉네임 확인"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className="btn-outline" disabled={!matches || remove.isPending}>계정 삭제</button>
            <button type="button" className="btn-outline" onClick={close}>취소</button>
          </div>
        </form>
      )}
    </Window>
  );
}
