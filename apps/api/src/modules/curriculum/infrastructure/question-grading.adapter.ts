import { Injectable } from '@nestjs/common';
import { ErrorCode, type CodingLanguage, type QuestionType } from '@cs-daily/contracts';
import { NotFoundError } from '../../../shared/domain/domain-error';
import { LessonId, QuestionId, UserId } from '../../../shared/domain/ids';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { publicContentFor } from '../../learning/domain/services/code-variants';
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

  /** sortOrder 음수 = 콘텐츠에서 빠진 퇴역 행(seed.ts 참고). 레슨이나 그 유닛이 퇴역이면 없는 레슨으로 취급한다 */
  async lessonOutline(lessonId: LessonId): Promise<LessonOutline | null> {
    const l = await this.db.lesson.findUnique({
      where: { id: lessonId.value },
      select: { id: true, name: true, objective: true, keyPoints: true, sortOrder: true, questionCount: true, unit: { select: { trackId: true, sortOrder: true } } },
    });
    if (!l || l.sortOrder <= 0 || l.unit.sortOrder <= 0) return null;
    return { id: l.id, name: l.name, objective: l.objective, keyPoints: l.keyPoints, trackId: l.unit.trackId, unitSortOrder: l.unit.sortOrder, lessonSortOrder: l.sortOrder, questionCount: l.questionCount };
  }

  /** sortOrder 음수 = 콘텐츠에서 빠진 퇴역 행(seed.ts 참고). 퇴역 유닛은 null, 퇴역 레슨은 레슨 목록에서 뺀다 */
  async unitOutline(unitId: number): Promise<UnitOutline | null> {
    const u = await this.db.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, trackId: true, sortOrder: true, lessons: { where: { sortOrder: { gt: 0 } }, orderBy: { sortOrder: 'asc' }, select: { id: true } } },
    });
    if (!u || u.sortOrder <= 0) return null;
    const through = await this.db.lesson.findMany({
      where: { sortOrder: { gt: 0 }, unit: { trackId: u.trackId, sortOrder: { gt: 0, lte: u.sortOrder } } },
      orderBy: [{ unit: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: { id: true },
    });
    return { id: u.id, name: u.name, trackId: u.trackId, sortOrder: u.sortOrder, lessonIds: u.lessons.map((l) => l.id), lessonIdsThroughUnit: through.map((l) => l.id) };
  }

  /** 레슨 자체의 퇴역 여부는 보지 않는다 — 퇴역 전에 만든 건너뛰기 세션(유닛의 마지막 레슨에 앵커)도 끝까지 마칠 수 있어야 한다 */
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

  /** 잠금 규칙: 트랙 안에서 (unit.sortOrder, lesson.sortOrder) 순으로 바로 앞 레슨이 완료되어 있으면 열림. 첫 레슨은 항상 열림.
   *  sortOrder 음수 = 콘텐츠에서 빠진 퇴역 행(seed.ts 참고)이라 "바로 앞 레슨"에서 제외한다 */
  async isLessonUnlocked(userId: UserId, lessonId: LessonId): Promise<boolean> {
    const outline = await this.lessonOutline(lessonId);
    if (!outline) return false;
    const previous = await this.db.lesson.findFirst({
      where: {
        sortOrder: { gt: 0 },
        unit: { trackId: outline.trackId, sortOrder: { gt: 0 } },
        OR: [{ unit: { sortOrder: outline.unitSortOrder }, sortOrder: { lt: outline.lessonSortOrder } }, { unit: { sortOrder: { lt: outline.unitSortOrder } } }],
      },
      orderBy: [{ unit: { sortOrder: 'desc' } }, { sortOrder: 'desc' }],
      select: { id: true },
    });
    if (!previous) return true;
    const done = await this.db.userLessonProgress.findUnique({ where: { userId_lessonId: { userId: userId.value, lessonId: previous.id } }, select: { completedAt: true } });
    return !!done?.completedAt;
  }

  async publicQuestions(ids: string[], codeLanguage: CodingLanguage): Promise<QuestionPublic[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.question.findMany({
      where: { id: { in: ids } },
      select: { id: true, type: true, content: true, difficulty: true }, // answerKey 제외
    });
    return rows.map((r) => {
      // 언어별 variants 문제는 사용자 언어의 variant만 content.code(+options)로 펼친다 — 다른 언어는 내려가지 않는다
      const { content, lang } = publicContentFor(r.content, codeLanguage);
      return { id: r.id, type: r.type as QuestionType, content, difficulty: r.difficulty, ...(lang ? { lang } : {}) };
    });
  }
}
