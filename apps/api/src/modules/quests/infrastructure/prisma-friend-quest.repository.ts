import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { FRIEND_QUEST_GOAL } from '../domain/friend-quests';
import type { FriendQuestRepository } from '../domain/ports';

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
   * 그래서 한 명이라도 이미 그 주 멤버면 반쪽짜리 퀘스트가 남지 않고, 동시 실행에서도 한쪽만 이긴다.
   */
  async createPair(weekStart: string, a: string, b: string): Promise<boolean> {
    const week = asDate(weekStart);
    try {
      await this.uow.run(async () => {
        const db = this.uow.client;
        const quest = await db.friendQuest.create({ data: { weekStart: week, goal: FRIEND_QUEST_GOAL }, select: { id: true } });
        const res = await db.friendQuestMember.createMany({
          data: [a, b].map((userId) => ({ questId: quest.id, userId, weekStart: week })),
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
