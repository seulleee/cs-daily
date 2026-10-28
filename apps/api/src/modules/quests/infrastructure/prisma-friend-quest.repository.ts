import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { FRIEND_QUEST_GOAL } from '../domain/friend-quests';
import type { ActiveFriendQuest, FriendQuestRepository } from '../domain/ports';

const asDate = (weekStart: string) => new Date(`${weekStart}T00:00:00Z`);

/** createPair가 멤버 충돌을 만났을 때 트랜잭션을 되돌리려고 던지는 표식 */
class PairConflict extends Error {}

@Injectable()
export class PrismaFriendQuestRepository implements FriendQuestRepository {
  constructor(private readonly uow: UnitOfWork) {}

  async activeUserIds(from: Date, to: Date): Promise<string[]> {
    const rows = await this.uow.client.lessonSession.findMany({
      where: { kind: 'lesson', finishedAt: { gte: from, lt: to } },
      distinct: ['userId'],
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async memberIdsOfWeek(weekStart: string): Promise<Set<string>> {
    const rows = await this.uow.client.friendQuestMember.findMany({ where: { weekStart: asDate(weekStart) }, select: { userId: true } });
    return new Set(rows.map((r) => r.userId));
  }

  async pairsOfWeek(weekStart: string): Promise<[string, string][]> {
    const quests = await this.uow.client.friendQuest.findMany({
      where: { weekStart: asDate(weekStart) },
      select: { members: { select: { userId: true } } },
    });
    return quests.filter((q) => q.members.length === 2).map((q) => [q.members[0]!.userId, q.members[1]!.userId]);
  }

  /**
   * 퀘스트와 멤버 2행을 한 트랜잭션으로 넣는다. 멤버는 createMany(skipDuplicates)라 (weekStart,userId) 충돌이
   * 오류 없이 건너뛰어지고, 들어간 행이 2개가 아니면 PairConflict로 트랜잭션 전체(퀘스트 행 포함)를 되돌린다.
   * 주의: 바깥 트랜잭션(uow.run 안)에서 부르면 PairConflict 롤백 보장이 깨진다 — 반드시 최상위에서 호출한다.
   * 그래서 한 명이라도 이미 그 주 멤버면 반쪽짜리 퀘스트가 남지 않고, 동시 실행에서도 한쪽만 이긴다.
   */
  async createPair(weekStart: string, a: string, b: string): Promise<boolean> {
    const week = asDate(weekStart);
    try {
      await this.uow.run(async () => {
        const db = this.uow.client;
        const quest = await db.friendQuest.create({ data: { weekStart: week, goal: FRIEND_QUEST_GOAL }, select: { id: true } });
        const res = await db.friendQuestMember.createMany({
          // id 순으로 넣어, 배치와 수락 이벤트가 같은 사람들을 동시에 잡아도 락 순서가 같다(교착 방지)
          data: [a, b].sort().map((userId) => ({ questId: quest.id, userId, weekStart: week })),
          skipDuplicates: true,
        });
        if (res.count !== 2) throw new PairConflict();
      });
      return true;
    } catch (err) {
      if (err instanceof PairConflict) return false;
      throw err;
    }
  }

  async activeQuestOf(userId: string, weekStart: string): Promise<ActiveFriendQuest | null> {
    // (weekStart, userId) 유니크 인덱스로 멤버를 먼저 찾고, 그 퀘스트가 아직 끝나지 않았을 때만 읽는다
    const member = await this.uow.client.friendQuestMember.findUnique({
      where: { weekStart_userId: { weekStart: asDate(weekStart), userId } },
      select: { questId: true },
    });
    if (!member) return null;
    const row = await this.uow.client.friendQuest.findFirst({
      where: { id: member.questId, endedAt: null },
      select: { goal: true, members: { select: { user: { select: { id: true, nickname: true, avatarUrl: true } } } } },
    });
    if (!row) return null;
    return { goal: row.goal, members: row.members.map((m) => ({ userId: m.user.id, nickname: m.user.nickname, avatarUrl: m.user.avatarUrl })) };
  }

  async lessonCounts(userIds: string[], from: Date, to: Date): Promise<Map<string, number>> {
    const rows = await this.uow.client.lessonSession.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, kind: 'lesson', finishedAt: { gte: from, lt: to } },
      _count: { _all: true },
    });
    const out = new Map<string, number>(userIds.map((id) => [id, 0]));
    for (const r of rows) out.set(r.userId, r._count._all);
    return out;
  }

  async endSharedQuest(weekStart: string, a: string, b: string, at: Date): Promise<void> {
    const week = asDate(weekStart);
    await this.uow.client.friendQuest.updateMany({
      where: {
        weekStart: week,
        endedAt: null,
        AND: [{ members: { some: { userId: a } } }, { members: { some: { userId: b } } }],
      },
      data: { endedAt: at },
    });
  }
}
