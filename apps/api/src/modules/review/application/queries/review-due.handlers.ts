import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { CountDueReviewsQuery, GetReviewDueQuery } from './queries';

@QueryHandler(CountDueReviewsQuery)
export class CountDueReviewsHandler implements IQueryHandler<CountDueReviewsQuery, number> {
  constructor(private readonly uow: UnitOfWork) {}
  execute(q: CountDueReviewsQuery): Promise<number> {
    return this.uow.client.reviewItem.count({ where: { userId: q.userId, dueAt: { lte: q.until } } });
  }
}

/** 복습 탭: 전체 due 수와 트랙별 분포 */
@QueryHandler(GetReviewDueQuery)
export class GetReviewDueHandler implements IQueryHandler<GetReviewDueQuery> {
  constructor(private readonly uow: UnitOfWork) {}
  async execute(q: GetReviewDueQuery) {
    const rows = await this.uow.client.reviewItem.findMany({
      where: { userId: q.userId, dueAt: { lte: q.now } },
      select: { question: { select: { lesson: { select: { unit: { select: { track: { select: { slug: true, name: true } } } } } } } } },
    });
    const byTrack = new Map<string, { trackSlug: string; trackName: string; count: number }>();
    for (const r of rows) {
      const t = r.question.lesson.unit.track;
      const cur = byTrack.get(t.slug) ?? { trackSlug: t.slug, trackName: t.name, count: 0 };
      cur.count += 1;
      byTrack.set(t.slug, cur);
    }
    return { count: rows.length, byTrack: [...byTrack.values()] };
  }
}
