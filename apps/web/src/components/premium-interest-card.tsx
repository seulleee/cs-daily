'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  PREMIUM_INTERESTS,
  PREMIUM_INTEREST_LABEL,
  PREMIUM_PRICE_BANDS,
  PREMIUM_PRICE_BAND_LABEL,
  type MeResponse,
  type PremiumInterestKey,
  type PremiumInterestRequest,
  type PremiumInterestState,
  type PremiumPriceBand,
} from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { SelectMark } from './select-mark';
import { useToast } from './toast';
import { Window } from './window';

/**
 * 설정 화면의 "프리미엄(준비 중)" 창 — 수요 검증용 사전 신청. 결제·가격 부과·유료 잠금은 없다.
 * 신청 전 → 선택 중(폼) → 신청 후(요약 + 수정/신청 취소). 알림 동의는 기본 꺼짐이고 사용자가 직접 켜야 저장된다.
 */
export function PremiumInterestCard({ email, current }: { email: string; current: PremiumInterestState | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [interests, setInterests] = useState<PremiumInterestKey[]>([]);
  const [priceBand, setPriceBand] = useState<PremiumPriceBand | null>(null);
  const [notifyConsent, setNotifyConsent] = useState(false);

  // 신청 상태가 바뀌면(저장·취소·다른 기기) 폼을 저장된 값으로 맞춘다
  useEffect(() => {
    setInterests(current?.interests ?? []);
    setPriceBand(current?.priceBand ?? null);
    setNotifyConsent(current?.notifyConsent ?? false);
  }, [current]);

  const setMe = (premiumInterest: PremiumInterestState | null) => qc.setQueryData<MeResponse>(['me'], (me) => (me ? { ...me, premiumInterest } : me));
  const onError = (err: unknown) => toast.show(err instanceof ApiError ? err.message : '처리하지 못했어요', { kind: 'error' });

  const submit = useMutation({
    mutationFn: (body: PremiumInterestRequest) => api<PremiumInterestState>('/me/premium-interest', { method: 'PUT', json: body }),
    onSuccess: (state) => {
      const wasApplied = current !== null;
      setMe(state);
      setEditing(false);
      toast.show(wasApplied ? '신청 내용을 수정했어요' : state.notifyConsent ? '신청했어요. 공개되면 이메일로 알려 드릴게요' : '신청했어요');
    },
    onError,
  });
  const cancel = useMutation({
    mutationFn: () => api<void>('/me/premium-interest', { method: 'DELETE' }),
    onSuccess: () => {
      setMe(null);
      setEditing(false);
      toast.show('신청을 취소했어요');
    },
    onError,
  });

  const showForm = current === null || editing;
  const ready = interests.length > 0 && priceBand !== null;

  return (
    <Window title="프리미엄(준비 중)" className="mt-6" bodyClassName="space-y-5 p-5">
      <p className="text-body">
        실무 트랙(AWS·보안 예정)과 오답 노트 같은 기능을 묶은 유료 구독을 준비하고 있어요. 지금은 결제가 없으며, 신청하면 공개될 때 이메일로 알려 드려요.
      </p>

      {showForm ? (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            submit.mutate({ interests, priceBand, notifyConsent });
          }}
        >
          <div>
            <span id="premium-interests-label" className="bit mb-2 block">관심 있는 것 (여러 개 선택)</span>
            <div role="group" aria-labelledby="premium-interests-label" className="flex flex-wrap gap-2">
              {PREMIUM_INTERESTS.map((key) => {
                const on = interests.includes(key);
                return (
                  <button key={key} type="button" aria-pressed={on} data-selected={on} className="chip" onClick={() => setInterests(on ? interests.filter((k) => k !== key) : [...interests, key])}>
                    {PREMIUM_INTEREST_LABEL[key]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span id="premium-price-label" className="bit mb-2 block">월 가격 의향</span>
            <div role="radiogroup" aria-labelledby="premium-price-label" className="grid gap-2">
              {PREMIUM_PRICE_BANDS.map((band) => (
                <button key={band} type="button" role="radio" aria-checked={priceBand === band} data-selected={priceBand === band} className="option flex items-center gap-3" onClick={() => setPriceBand(band)}>
                  <SelectMark />
                  <span className="block min-w-0 flex-1 font-semibold">{PREMIUM_PRICE_BAND_LABEL[band]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <button type="button" role="checkbox" aria-checked={notifyConsent} data-selected={notifyConsent} className="option flex items-center gap-3" onClick={() => setNotifyConsent(!notifyConsent)}>
              <SelectMark kind="box" />
              <span className="block min-w-0 flex-1">
                <span className="block font-semibold">출시 알림 받기</span>
                <span className="block text-cap text-ink-2">체크하면 공개될 때 가입 이메일({email})로 알려 드려요. 체크하지 않으면 보내지 않아요.</span>
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <button type="submit" disabled={!ready || submit.isPending} className="btn-3d w-full">{current ? '수정 저장' : '신청하기'}</button>
            {!ready && <p className="text-cap text-ink-2">관심 있는 것을 하나 이상, 가격 의향을 하나 골라 주세요.</p>}
            {current && (
              <button type="button" className="btn-outline w-full" onClick={() => setEditing(false)}>
                돌아가기
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div role="status">
            <p className="bit">신청했어요</p>
            <dl className="mt-3 space-y-2 text-body">
              <div>
                <dt className="text-cap text-ink-2">관심 있는 것</dt>
                <dd>{current.interests.map((k) => PREMIUM_INTEREST_LABEL[k]).join(' · ')}</dd>
              </div>
              <div>
                <dt className="text-cap text-ink-2">월 가격 의향</dt>
                <dd>{PREMIUM_PRICE_BAND_LABEL[current.priceBand]}</dd>
              </div>
              <div>
                <dt className="text-cap text-ink-2">출시 알림</dt>
                <dd>{current.notifyConsent ? `받기 (${email})` : '받지 않기'}</dd>
              </div>
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-outline" onClick={() => setEditing(true)}>수정</button>
            <button type="button" className="btn-outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>신청 취소</button>
          </div>
        </div>
      )}
    </Window>
  );
}
