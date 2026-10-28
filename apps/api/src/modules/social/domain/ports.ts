import type { FriendRequestView, FriendSummary, SearchUser } from '@cs-daily/contracts';

export const SOCIAL_REPO = Symbol('SOCIAL_REPO');

export interface PairRow {
  id: string;
  status: 'pending' | 'accepted';
  requesterId: string;
}

export interface SocialRepository {
  userExists(id: string): Promise<boolean>;
  isBlockedEitherWay(a: string, b: string): Promise<boolean>;
  findPair(a: string, b: string): Promise<PairRow | null>;
  countFriends(userId: string): Promise<number>;
  countPendingOut(userId: string): Promise<number>;
  /** 쌍이 동시에 만들어졌으면(유니크 충돌) false */
  createRequest(requesterId: string, addresseeId: string): Promise<boolean>;
  /** 대기 상태일 때만 수락한다. 갱신됐으면 true */
  markAccepted(id: string, at: Date): Promise<boolean>;
  /** 받은 사람이 me인 대기 요청 */
  findIncomingPending(id: string, me: string): Promise<{ requesterId: string } | null>;
  deleteIncomingPending(id: string, me: string): Promise<boolean>;
  deleteOutgoingPending(id: string, me: string): Promise<boolean>;
  /** 친구 관계만 삭제. 삭제했으면 true */
  deleteAccepted(a: string, b: string): Promise<boolean>;
  /** 쌍의 행을 상태와 무관하게 삭제하고 지워진 상태를 돌려준다 */
  deletePair(a: string, b: string): Promise<'pending' | 'accepted' | null>;
  upsertBlock(blockerId: string, blockedId: string): Promise<void>;
  deleteBlock(blockerId: string, blockedId: string): Promise<void>;

  listFriends(me: string, weekStart: Date, now: Date): Promise<FriendSummary[]>;
  listIncoming(me: string): Promise<FriendRequestView[]>;
  listOutgoing(me: string): Promise<FriendRequestView[]>;
  search(me: string, prefix: string, limit: number): Promise<SearchUser[]>;
}
