import { z } from 'zod';

export const FriendUser = z.object({
  userId: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  streak: z.number().int(),
});
export type FriendUser = z.infer<typeof FriendUser>;

export const FriendSummary = FriendUser.extend({
  /** 이번 주(Asia/Seoul 월~일) 완료한 레슨 수 */
  weekLessons: z.number().int(),
});
export type FriendSummary = z.infer<typeof FriendSummary>;

export const FriendRequestView = z.object({
  id: z.string(),
  user: FriendUser,
  createdAt: z.string(),
});
export type FriendRequestView = z.infer<typeof FriendRequestView>;

/** GET /friends */
export const FriendsResponse = z.object({
  friends: z.array(FriendSummary),
  incoming: z.array(FriendRequestView),
  outgoing: z.array(FriendRequestView),
});
export type FriendsResponse = z.infer<typeof FriendsResponse>;

export const SearchUser = FriendUser.extend({
  relation: z.enum(['none', 'friend', 'outgoing', 'incoming']),
});
export type SearchUser = z.infer<typeof SearchUser>;

/** GET /friends/search?q= */
export const FriendSearchResponse = z.object({ users: z.array(SearchUser) });
export type FriendSearchResponse = z.infer<typeof FriendSearchResponse>;

/** POST /friends/requests */
export const SendFriendRequest = z.object({ userId: z.string().uuid() });
export type SendFriendRequest = z.infer<typeof SendFriendRequest>;

export const BlockedUser = z.object({
  userId: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  blockedAt: z.string(),
});
export type BlockedUser = z.infer<typeof BlockedUser>;

/** GET /blocks — 내가 차단한 사용자(최근 차단 순) */
export const BlocksResponse = z.object({ users: z.array(BlockedUser) });
export type BlocksResponse = z.infer<typeof BlocksResponse>;

/** POST /blocks */
export const BlockRequest = z.object({ userId: z.string().uuid() });
export type BlockRequest = z.infer<typeof BlockRequest>;
