import { Injectable } from '@nestjs/common';
import type { UserId } from '../../../shared/domain/ids';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import type { UserPrefs, UserPrefsPort } from '../../learning/domain/ports';

/** Learning·Notification이 쓰는 UserPrefsPort의 Identity 측 구현 */
@Injectable()
export class UserPrefsAdapter implements UserPrefsPort {
  constructor(private readonly uow: UnitOfWork) {}
  async prefsOf(userId: UserId): Promise<UserPrefs> {
    const u = await this.uow.client.user.findUniqueOrThrow({ where: { id: userId.value }, select: { timezone: true, dailyGoal: true } });
    return { timeZone: u.timezone, dailyGoal: u.dailyGoal };
  }
}
