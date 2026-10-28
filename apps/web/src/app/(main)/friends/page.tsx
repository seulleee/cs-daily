'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { FriendSearchResponse, FriendsResponse, FriendUser } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { useToast } from '@/components/toast';
import { Window } from '@/components/window';

const LIMIT_MESSAGE = '친구는 100명, 보낸 요청은 20개까지예요';

/** 확인 단계가 필요한 항목 메뉴 상태. `menu`는 고르는 중, `unfriend`·`block`은 확인 중 */
type MenuState = { userId: string; step: 'menu' | 'unfriend' | 'block' } | null;

export default function FriendsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const friends = useQuery({ queryKey: ['friends'], queryFn: () => api<FriendsResponse>('/friends') });

  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const searching = debounced.length >= 2;
  const search = useQuery({
    queryKey: ['friends-search', debounced],
    queryFn: () => api<FriendSearchResponse>(`/friends/search?q=${encodeURIComponent(debounced)}`),
    enabled: searching,
  });

  const [menu, setMenu] = useState<MenuState>(null);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['friends'] }), qc.invalidateQueries({ queryKey: ['friends-search'] }), qc.invalidateQueries({ queryKey: ['me', 'quests'] })]);
  const onError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'FRIEND_LIMIT') toast.show(LIMIT_MESSAGE, { kind: 'error' });
    else toast.show(err instanceof ApiError ? err.message : '처리하지 못했어요', { kind: 'error' });
  };
  const act = (fn: (arg: string) => Promise<unknown>, done?: string) => ({
    mutationFn: fn,
    onSuccess: () => {
      if (done) toast.show(done);
      setMenu(null);
      return refresh();
    },
    onError,
  });

  const send = useMutation({
    ...act((userId) => api('/friends/requests', { method: 'POST', json: { userId } })),
    onSuccess: (_data: unknown, userId: string) => {
      // 받은 요청이 있던 사람에게 보내는 요청은 맞요청이라 바로 친구가 된다
      const incoming = search.data?.users.some((u) => u.userId === userId && u.relation === 'incoming');
      toast.show(incoming ? '친구가 되었어요' : '친구 요청을 보냈어요');
      setMenu(null);
      return refresh();
    },
  });
  const accept = useMutation(act((id) => api(`/friends/requests/${id}/accept`, { method: 'POST' }), '친구가 되었어요'));
  const decline = useMutation(act((id) => api(`/friends/requests/${id}/decline`, { method: 'POST' }), '요청을 거절했어요'));
  const cancel = useMutation(act((id) => api(`/friends/requests/${id}`, { method: 'DELETE' }), '요청을 취소했어요'));
  const unfriend = useMutation(act((userId) => api(`/friends/${userId}`, { method: 'DELETE' }), '친구를 끊었어요'));
  const block = useMutation(act((userId) => api('/blocks', { method: 'POST', json: { userId } }), '차단했어요'));

  const data = friends.data;
  if (friends.isError && !data) {
    return (
      <AppShell>
        <h1 className="bit-2 mb-6">친구</h1>
        <div className="card p-6 text-center">
          <p>불러오지 못했어요.</p>
          <button type="button" className="btn-outline mt-4" onClick={() => friends.refetch()}>다시 시도</button>
        </div>
      </AppShell>
    );
  }
  if (!data) return <AppShell><h1 className="bit-2 mb-6">친구</h1><p className="text-ink-2">불러오는 중…</p></AppShell>;

  return (
    <AppShell>
      <h1 className="bit-2 mb-6">친구</h1>
      <div className="space-y-6">
        <Window title="친구 찾기" bodyClassName="p-4">
          <input
            className="input"
            type="search"
            aria-label="닉네임으로 친구 찾기"
            placeholder="닉네임 2글자 이상"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={30}
          />
          {searching && search.data && (
            <ul className="mt-4 divide-y divide-line">
              {search.data.users.length === 0 && <li className="py-3 text-ink-2">검색 결과가 없어요</li>}
              {search.data.users.map((u) => (
                <li key={u.userId} className="flex items-center gap-3 py-3">
                  <Person user={u} meta={`${u.streak}일째`} />
                  {u.relation === 'none' && (
                    <button type="button" className="btn-outline shrink-0" disabled={send.isPending} onClick={() => send.mutate(u.userId)}>요청 보내기</button>
                  )}
                  {u.relation === 'friend' && <span className="bit shrink-0 text-ink-2">친구</span>}
                  {u.relation === 'outgoing' && <span className="bit shrink-0 text-ink-2">요청함</span>}
                  {u.relation === 'incoming' && (
                    <button type="button" className="btn-outline shrink-0" disabled={send.isPending} onClick={() => send.mutate(u.userId)}>수락</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Window>

        {data.incoming.length > 0 && (
          <Window title={`받은 요청 ${data.incoming.length}`} bodyClassName="px-4">
            <ul className="divide-y divide-line">
              {data.incoming.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Person user={r.user} meta={`${r.user.streak}일째`} />
                  <span className="flex shrink-0 gap-2">
                    <button type="button" className="btn-outline" disabled={accept.isPending} onClick={() => accept.mutate(r.id)}>수락</button>
                    <button type="button" className="btn-outline" disabled={decline.isPending} onClick={() => decline.mutate(r.id)}>거절</button>
                  </span>
                </li>
              ))}
            </ul>
          </Window>
        )}

        {data.outgoing.length > 0 && (
          <Window title={`보낸 요청 ${data.outgoing.length}`} bodyClassName="px-4">
            <ul className="divide-y divide-line">
              {data.outgoing.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <Person user={r.user} meta="답을 기다리는 중" />
                  <button type="button" className="btn-outline shrink-0" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>취소</button>
                </li>
              ))}
            </ul>
          </Window>
        )}

        <Window title={`내 친구 ${data.friends.length}`} bodyClassName="px-4">
          {data.friends.length === 0 ? (
            <p className="py-4 text-ink-2">아직 친구가 없어요. 닉네임으로 찾아 요청을 보내 보세요.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.friends.map((f) => {
                const open = menu?.userId === f.userId ? menu.step : null;
                return (
                  <li key={f.userId} className="py-3">
                    <div className="flex items-center gap-3">
                      <Person user={f} meta={`${f.streak}일째 · 이번 주 ${f.weekLessons}개`} />
                      <button
                        type="button"
                        className="btn-outline shrink-0"
                        aria-expanded={open !== null}
                        aria-label={`${f.nickname} 관리`}
                        onClick={() => setMenu(open ? null : { userId: f.userId, step: 'menu' })}
                      >
                        {open ? '닫기' : '관리'}
                      </button>
                    </div>
                    {open === 'menu' && (
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="btn-outline" onClick={() => setMenu({ userId: f.userId, step: 'unfriend' })}>친구 끊기</button>
                        <button type="button" className="btn-outline" onClick={() => setMenu({ userId: f.userId, step: 'block' })}>차단</button>
                      </div>
                    )}
                    {(open === 'unfriend' || open === 'block') && (
                      <div role="group" aria-label="확인" className="mt-3 border border-line p-3">
                        <p className="text-body">
                          {open === 'unfriend'
                            ? `${f.nickname}님과 친구를 끊을까요?`
                            : `${f.nickname}님을 차단할까요? 친구가 끊기고 서로 검색되지 않아요.`}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="btn-outline"
                            disabled={unfriend.isPending || block.isPending}
                            onClick={() => (open === 'unfriend' ? unfriend : block).mutate(f.userId)}
                          >
                            {open === 'unfriend' ? '끊기' : '차단하기'}
                          </button>
                          <button type="button" className="btn-outline" onClick={() => setMenu({ userId: f.userId, step: 'menu' })}>취소</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Window>
      </div>
    </AppShell>
  );
}

function Person({ user, meta }: { user: FriendUser; meta: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-10 w-10 shrink-0 border border-ink" />
      ) : (
        <span aria-hidden className="bit flex h-10 w-10 shrink-0 items-center justify-center border border-ink">
          {user.nickname.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-semibold">{user.nickname}</span>
        <span className="block text-cap text-ink-2">{meta}</span>
      </span>
    </div>
  );
}
