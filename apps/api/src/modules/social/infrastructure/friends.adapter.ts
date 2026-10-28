import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import type { FriendsPort } from '../../quests/domain/ports';
import { pairKey } from '../domain/friendship-rules';

/** Quests가 쓰는 FRIENDS_PORT 구현: 수락된 Friendship만 본다. */
@Injectable()
export class FriendsAdapter implements FriendsPort {
  constructor(private readonly uow: UnitOfWork) {}

  async friendIdsOf(userIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>(userIds.map((id) => [id, []]));
    if (userIds.length === 0) return out;
    const rows = await this.uow.client.friendship.findMany({
      where: { status: 'accepted', OR: [{ requesterId: { in: userIds } }, { addresseeId: { in: userIds } }] },
      select: { requesterId: true, addresseeId: true },
    });
    for (const r of rows) {
      out.get(r.requesterId)?.push(r.addresseeId);
      out.get(r.addresseeId)?.push(r.requesterId);
    }
    return out;
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    const { low, high } = pairKey(a, b);
    const n = await this.uow.client.friendship.count({ where: { userLowId: low, userHighId: high, status: 'accepted' } });
    return n > 0;
  }
}
