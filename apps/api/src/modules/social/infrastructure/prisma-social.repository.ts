import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FriendRequestView, FriendSummary, SearchUser } from '@cs-daily/contracts';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { escapeLike, pairKey } from '../domain/friendship-rules';
import type { PairRow, SocialRepository } from '../domain/ports';

const userSelect = { id: true, nickname: true, avatarUrl: true, stats: { select: { currentStreak: true } } } satisfies Prisma.UserSelect;
type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;
const toFriendUser = (u: UserRow) => ({ userId: u.id, nickname: u.nickname, avatarUrl: u.avatarUrl, streak: u.stats?.currentStreak ?? 0 });

@Injectable()
export class PrismaSocialRepository implements SocialRepository {
  constructor(private readonly uow: UnitOfWork) {}

  private get db() {
    return this.uow.client;
  }

  async userExists(id: string) {
    return (await this.db.user.count({ where: { id } })) > 0;
  }

  async isBlockedEitherWay(a: string, b: string) {
    const n = await this.db.userBlock.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } });
    return n > 0;
  }

  async findPair(a: string, b: string): Promise<PairRow | null> {
    const { low, high } = pairKey(a, b);
    return this.db.friendship.findUnique({
      where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
      select: { id: true, status: true, requesterId: true },
    });
  }

  countFriends(userId: string) {
    return this.db.friendship.count({ where: { status: 'accepted', OR: [{ requesterId: userId }, { addresseeId: userId }] } });
  }

  countPendingOut(userId: string) {
    return this.db.friendship.count({ where: { status: 'pending', requesterId: userId } });
  }

  async createRequest(requesterId: string, addresseeId: string) {
    const { low, high } = pairKey(requesterId, addresseeId);
    // ON CONFLICT DO NOTHING — 동시 요청의 유니크 충돌이 바깥 트랜잭션을 망치지 않는다
    const res = await this.db.friendship.createMany({
      data: [{ requesterId, addresseeId, userLowId: low, userHighId: high }],
      skipDuplicates: true,
    });
    return res.count === 1;
  }

  async markAccepted(id: string, at: Date) {
    await this.db.friendship.update({ where: { id }, data: { status: 'accepted', acceptedAt: at } });
  }

  findIncomingPending(id: string, me: string) {
    return this.db.friendship.findFirst({ where: { id, addresseeId: me, status: 'pending' }, select: { requesterId: true } });
  }

  async deleteIncomingPending(id: string, me: string) {
    return (await this.db.friendship.deleteMany({ where: { id, addresseeId: me, status: 'pending' } })).count > 0;
  }

  async deleteOutgoingPending(id: string, me: string) {
    return (await this.db.friendship.deleteMany({ where: { id, requesterId: me, status: 'pending' } })).count > 0;
  }

  async deleteAccepted(a: string, b: string) {
    const { low, high } = pairKey(a, b);
    return (await this.db.friendship.deleteMany({ where: { userLowId: low, userHighId: high, status: 'accepted' } })).count > 0;
  }

  async deletePair(a: string, b: string) {
    const row = await this.findPair(a, b);
    if (!row) return null;
    await this.db.friendship.deleteMany({ where: { id: row.id } });
    return row.status;
  }

  async upsertBlock(blockerId: string, blockedId: string) {
    await this.db.userBlock.upsert({ where: { blockerId_blockedId: { blockerId, blockedId } }, create: { blockerId, blockedId }, update: {} });
  }

  async deleteBlock(blockerId: string, blockedId: string) {
    await this.db.userBlock.deleteMany({ where: { blockerId, blockedId } });
  }

  async listFriends(me: string, weekStart: Date, now: Date): Promise<FriendSummary[]> {
    const rows = await this.db.friendship.findMany({
      where: { status: 'accepted', OR: [{ requesterId: me }, { addresseeId: me }] },
      select: { requester: { select: userSelect }, addressee: { select: userSelect } },
    });
    const friends = rows.map((r) => (r.requester.id === me ? r.addressee : r.requester));
    // 친구 전체의 이번 주 레슨 수를 집계 쿼리 한 번으로
    const counts = friends.length
      ? await this.db.lessonSession.groupBy({
          by: ['userId'],
          where: { userId: { in: friends.map((f) => f.id) }, kind: 'lesson', finishedAt: { gte: weekStart, lte: now } },
          _count: { _all: true },
        })
      : [];
    const byUser = new Map(counts.map((c) => [c.userId, c._count._all]));
    return friends
      .map((f) => ({ ...toFriendUser(f), weekLessons: byUser.get(f.id) ?? 0 }))
      .sort((a, b) => b.weekLessons - a.weekLessons || a.nickname.localeCompare(b.nickname));
  }

  async listIncoming(me: string): Promise<FriendRequestView[]> {
    const rows = await this.db.friendship.findMany({
      where: { status: 'pending', addresseeId: me },
      select: { id: true, createdAt: true, requester: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ id: r.id, user: toFriendUser(r.requester), createdAt: r.createdAt.toISOString() }));
  }

  async listOutgoing(me: string): Promise<FriendRequestView[]> {
    const rows = await this.db.friendship.findMany({
      where: { status: 'pending', requesterId: me },
      select: { id: true, createdAt: true, addressee: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ id: r.id, user: toFriendUser(r.addressee), createdAt: r.createdAt.toISOString() }));
  }

  async search(me: string, prefix: string, limit: number): Promise<SearchUser[]> {
    const pattern = `${escapeLike(prefix)}%`;
    const found = await this.db.$queryRaw<{ id: string }[]>`
      SELECT u.id FROM users u
      WHERE u.nickname ILIKE ${pattern}
        AND u.id <> ${me}::uuid
        AND u.discoverable
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE (b.blocker_id = u.id AND b.blocked_id = ${me}::uuid) OR (b.blocker_id = ${me}::uuid AND b.blocked_id = u.id)
        )
      ORDER BY u.nickname ASC
      LIMIT ${limit}`;
    if (found.length === 0) return [];
    const ids = found.map((f) => f.id);
    const [users, links] = await Promise.all([
      this.db.user.findMany({ where: { id: { in: ids } }, select: userSelect }),
      this.db.friendship.findMany({
        where: { OR: [{ requesterId: me, addresseeId: { in: ids } }, { addresseeId: me, requesterId: { in: ids } }] },
        select: { status: true, requesterId: true, addresseeId: true },
      }),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));
    const relationOf = (id: string): SearchUser['relation'] => {
      const l = links.find((x) => x.requesterId === id || x.addresseeId === id);
      if (!l) return 'none';
      if (l.status === 'accepted') return 'friend';
      return l.requesterId === me ? 'outgoing' : 'incoming';
    };
    return ids.flatMap((id) => {
      const u = byId.get(id);
      return u ? [{ ...toFriendUser(u), relation: relationOf(id) }] : [];
    });
  }
}
