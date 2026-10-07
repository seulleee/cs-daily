import { Injectable } from '@nestjs/common';
import { ErrorCode, type QuestionType } from '@cs-daily/contracts';
import { NotFoundError } from '../../../shared/domain/domain-error';
import { LessonId, QuestionId, UserId } from '../../../shared/domain/ids';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import type { CurriculumQueryPort, LessonOutline, QuestionForGrading, QuestionGradingPort, QuestionPublic, UnitOutline } from '../../learning/domain/ports';

const MVP_TYPES: ReadonlySet<string> = new Set(['single', 'multi', 'ox', 'fill']);

/**
 * Learning이 요구하는 포트의 Curriculum 측 구현 (ACL).
 * answer_key를 읽는 유일한 경로가 forGrading()이다. 다른 어떤 쿼리도 answerKey를 select하지 않는다.
 */
@Injectable()
export class CurriculumAdapter implements QuestionGradingPort, CurriculumQueryPort {
  constructor(private readonly uow: UnitOfWork) {}
  private get db() {
    return this.uow.client;
  }

  async forGrading(id: QuestionId): Promise<QuestionForGrading> {
    const q = await this.db.question.findUnique({
      where: { id: id.value },
      select: { id: true, type: true, version: true, answerKey: true, explanation: true },
    });
    if (!q || !MVP_TYPES.has(q.type)) throw new NotFoundError(ErrorCode.QUESTION_NOT_FOUND, `문제가 없습니다: ${id.value}`);
    return { id: QuestionId.of(q.id), type: q.type as QuestionType, version: q.version, answerKey: q.answerKey, explanation: q.explanation };
  }

  async lessonOutline(lessonId: LessonId): Promise<LessonOutline | null> {
    const l = await this.db.lesson.findUnique({
      where: { id: lessonId.value },
      select: { id: true, name: true, sortOrder: true, questionCount: true, unit: { select: { trackId: true, sortOrder: true } } },
    });
    if (!l) return null;
    return { id: l.id, name: l.name, trackId: l.unit.trackId, unitSortOrder: l.unit.sortOrder, lessonSortOrder: l.sortOrder, questionCount: l.questionCount };
  }

  async unitOutline(unitId: number): Promise<UnitOutline | null> {
    const u = await this.db.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, trackId: true, sortOrder: true, lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true } } },
    });
    if (!u) return null;
    const through = await this.db.lesson.findMany({
      where: { unit: { trackId: u.trackId, sortOrder: { lte: u.sortOrder } } },
      orderBy: [{ unit: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: { id: true },
    });
    return { id: u.id, name: u.name, trackId: u.trackId, sortOrder: u.sortOrder, lessonIds: u.lessons.map((l) => l.id), lessonIdsThroughUnit: through.map((l) => l.id) };
  }

  async unitOfLesson(lessonId: LessonId): Promise<UnitOutline | null> {
    const l = await this.db.lesson.findUnique({ where: { id: lessonId.value }, select: { unitId: true } });
    return l ? this.unitOutline(l.unitId) : null;
  }

  async publishedQuestionIds(lessonId: LessonId): Promise<string[]> {
    const rows = await this.db.question.findMany({
      where: { lessonId: lessonId.value, status: 'published', type: { in: ['single', 'multi', 'ox', 'fill'] } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** 잠금 규칙: 트랙 안에서 (unit.sortOrder, lesson.sortOrder) 순으로 바로 앞 레슨이 완료되어 있으면 열림. 첫 레슨은 항상 열림 */
  async isLessonUnlocked(userId: UserId, lessonId: LessonId): Promise<boolean> {
    const outline = await this.lessonOutline(lessonId);
    if (!outline) return false;
    const previous = await this.db.lesson.findFirst({
      where: {
        unit: { trackId: outline.trackId },
        OR: [{ unit: { sortOrder: outline.unitSortOrder }, sortOrder: { lt: outline.lessonSortOrder } }, { unit: { sortOrder: { lt: outline.unitSortOrder } } }],
      },
      orderBy: [{ unit: { sortOrder: 'desc' } }, { sortOrder: 'desc' }],
      select: { id: true },
    });
    if (!previous) return true;
    const done = await this.db.userLessonProgress.findUnique({ where: { userId_lessonId: { userId: userId.value, lessonId: previous.id } }, select: { completedAt: true } });
    return !!done?.completedAt;
  }

  async publicQuestions(ids: string[]): Promise<QuestionPublic[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.question.findMany({
      where: { id: { in: ids } },
      select: { id: true, type: true, content: true, difficulty: true }, // answerKey 제외
    });
    return rows.map((r) => ({ id: r.id, type: r.type as QuestionType, content: r.content, difficulty: r.difficulty }));
  }
}
