import { describe, expect, it, vi } from 'vitest';
import { CountDueReviewsHandler } from '../src/modules/review/application/queries/review-due.handlers';
import { CountDueReviewsQuery } from '../src/modules/review/application/queries/queries';
import type { UnitOfWork } from '../src/shared/infrastructure/unit-of-work';

function fakeUow(count: number) {
  const countFn = vi.fn().mockResolvedValue(count);
  const uow = { client: { reviewItem: { count: countFn } } } as unknown as UnitOfWork;
  return { uow, countFn };
}

describe('CountDueReviewsHandler', () => {
  it('until 이하(dueAt <= until)로 사용자의 복습 항목만 센다', async () => {
    const { uow, countFn } = fakeUow(5);
    const until = new Date('2026-10-09T14:59:59.999Z');
    const result = await new CountDueReviewsHandler(uow).execute(new CountDueReviewsQuery('user-1', until));
    expect(result).toBe(5);
    expect(countFn).toHaveBeenCalledWith({ where: { userId: 'user-1', dueAt: { lte: until } } });
  });
});
