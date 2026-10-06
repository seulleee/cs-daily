import { Injectable } from '@nestjs/common';
import type { UserId } from '../../../shared/domain/ids';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import type { ReviewQueuePort } from '../../learning/domain/ports';

/** Learning이 쓰는 ReviewQueuePort의 Review 측 구현. due_at 오름차순, 트랙 섞임은 자연스럽게 */
@Injectable()
export class ReviewQueueAdapter implements ReviewQueuePort {
  constructor(private readonly uow: UnitOfWork) {}

  async dueQuestionIds(userId: UserId, limit: number, now: Date): Promise<string[]> {
    const rows = await this.uow.client.reviewItem.findMany({
      where: { userId: userId.value, dueAt: { lte: now }, question: { status: 'published' } },
      orderBy: { dueAt: 'asc' },
      take: limit,
      select: { questionId: true },
    });
    return rows.map((r) => r.questionId);
  }
}
