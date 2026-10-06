import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ErrorCode, type PathResponse, type TrackSummary } from '@cs-daily/contracts';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';

export class GetPathQuery {
  constructor(
    readonly userId: string,
    readonly trackSlug: string,
  ) {}
}

export class ListTracksQuery {}

/** 홈 경로 화면 읽기 모델. CQRS-lite: Prisma로 직접 조회, 쓰기 없음 */
@QueryHandler(GetPathQuery)
export class GetPathHandler implements IQueryHandler<GetPathQuery, PathResponse> {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(q: GetPathQuery): Promise<PathResponse> {
    const db = this.uow.client;
    const track = await db.track.findUnique({
      where: { slug: q.trackSlug },
      include: {
        units: {
          orderBy: { sortOrder: 'asc' },
          include: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, sortOrder: true, questionCount: true } } },
        },
      },
    });
    if (!track || !track.isActive) throw new NotFoundError(ErrorCode.TRACK_NOT_FOUND, `트랙이 없습니다: ${q.trackSlug}`);

    const lessonIds = track.units.flatMap((u) => u.lessons.map((l) => l.id));
    const progress = await db.userLessonProgress.findMany({
      where: { userId: q.userId, lessonId: { in: lessonIds } },
      select: { lessonId: true, bestScore: true, completedAt: true },
    });
    const byLesson = new Map(progress.map((p) => [p.lessonId, p]));

    // 경로 규칙: 앞 레슨이 완료되면 다음 레슨이 열린다. 첫 미완료 레슨이 "다음 레슨"
    let unlocked = true;
    let nextLessonId: number | null = null;
    const units = track.units.map((u) => ({
      id: u.id,
      name: u.name,
      sortOrder: u.sortOrder,
      lessons: u.lessons.map((l) => {
        const p = byLesson.get(l.id);
        const completed = !!p?.completedAt;
        const status = completed ? 'completed' : unlocked ? 'available' : 'locked';
        if (status === 'available' && nextLessonId === null) nextLessonId = l.id;
        if (!completed) unlocked = false;
        return { id: l.id, name: l.name, sortOrder: l.sortOrder, status, bestScore: p?.bestScore ?? 0, questionCount: l.questionCount } as const;
      }),
    }));

    const summary: TrackSummary = {
      id: track.id,
      slug: track.slug,
      name: track.name,
      description: track.description,
      unitCount: track.units.length,
      lessonCount: lessonIds.length,
    };
    return { track: summary, units, nextLessonId };
  }
}

@QueryHandler(ListTracksQuery)
export class ListTracksHandler implements IQueryHandler<ListTracksQuery, TrackSummary[]> {
  constructor(private readonly uow: UnitOfWork) {}
  async execute(): Promise<TrackSummary[]> {
    const tracks = await this.uow.client.track.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { units: { select: { _count: { select: { lessons: true } } } } },
    });
    return tracks.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      unitCount: t.units.length,
      lessonCount: t.units.reduce((n, u) => n + u._count.lessons, 0),
    }));
  }
}
