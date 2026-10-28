'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { BlocksResponse } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Window } from '@/components/window';

/** 설정 "차단한 사용자" 창. 해제는 같은 자리 인라인 확인 후 DELETE /blocks/:userId */
export function BlockedUsers({ className }: { className?: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const blocks = useQuery({ queryKey: ['blocks'], queryFn: () => api<BlocksResponse>('/blocks') });
  const [confirming, setConfirming] = useState<string | null>(null);

  const unblock = useMutation({
    mutationFn: (userId: string) => api(`/blocks/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.show('차단을 해제했어요');
      setConfirming(null);
      return Promise.all([qc.invalidateQueries({ queryKey: ['blocks'] }), qc.invalidateQueries({ queryKey: ['friends'] }), qc.invalidateQueries({ queryKey: ['friends-search'] })]);
    },
    onError: (err) => toast.show(err instanceof ApiError ? err.message : '처리하지 못했어요', { kind: 'error' }),
  });

  const users = blocks.data?.users;

  return (
    <Window title="차단한 사용자" className={className} bodyClassName="px-4">
      {blocks.isError && !users ? (
        <div className="py-4">
          <p>불러오지 못했어요.</p>
          <button type="button" className="btn-outline mt-4" onClick={() => blocks.refetch()}>다시 시도</button>
        </div>
      ) : !users ? (
        <p className="py-4 text-ink-2">불러오는 중…</p>
      ) : users.length === 0 ? (
        <p className="py-4 text-ink-2">차단한 사용자가 없어요</p>
      ) : (
        <ul className="divide-y divide-line">
          {users.map((u) => {
            const open = confirming === u.userId;
            return (
              <li key={u.userId} className="py-3">
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatarUrl} alt="" className="h-10 w-10 shrink-0 border border-ink" />
                    ) : (
                      <span aria-hidden className="bit flex h-10 w-10 shrink-0 items-center justify-center border border-ink">
                        {u.nickname.slice(0, 1)}
                      </span>
                    )}
                    <span className="block min-w-0 truncate font-semibold">{u.nickname}</span>
                  </div>
                  {!open && (
                    <button type="button" className="btn-outline shrink-0" aria-label={`${u.nickname} 차단 해제`} onClick={() => setConfirming(u.userId)}>
                      차단 해제
                    </button>
                  )}
                </div>
                {open && (
                  <div role="group" aria-label="확인" className="mt-3 border border-line p-3">
                    <p className="text-body">해제할까요?</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className="btn-outline" disabled={unblock.isPending} onClick={() => unblock.mutate(u.userId)}>해제</button>
                      <button type="button" className="btn-outline" onClick={() => setConfirming(null)}>취소</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-line py-3 text-cap text-ink-2">차단을 해제해도 친구 관계는 되돌아오지 않아요</p>
    </Window>
  );
}
