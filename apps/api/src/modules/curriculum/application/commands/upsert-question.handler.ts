import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { Prisma } from '@prisma/client';
import { QuestionFile } from '@cs-daily/contracts';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';

/**
 * 어드민·시드 공용: 콘텐츠 파일 형식의 문제를 레슨에 업서트한다.
 * content_id가 같으면 version+1 하며 갱신. status는 명시된 값(기본 review).
 */
export class UpsertQuestionCommand {
  constructor(
    readonly lessonId: number,
    readonly question: unknown,
    readonly sortOrder: number,
    readonly status: 'draft' | 'review' | 'published' = 'review',
  ) {}
}

@CommandHandler(UpsertQuestionCommand)
export class UpsertQuestionHandler implements ICommandHandler<UpsertQuestionCommand, { id: string; created: boolean }> {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(cmd: UpsertQuestionCommand) {
    const q = QuestionFile.parse(cmd.question);
    const db = this.uow.client;
    const existing = await db.question.findUnique({ where: { contentId: q.id }, select: { id: true, version: true } });
    const data = {
      lessonId: cmd.lessonId,
      type: q.type,
      content: q.content as Prisma.InputJsonValue,
      answerKey: q.answer_key as Prisma.InputJsonValue,
      explanation: q.explanation,
      difficulty: q.difficulty,
      tags: q.tags,
      refs: q.refs,
      sortOrder: cmd.sortOrder,
      status: cmd.status,
    };
    if (existing) {
      await db.question.update({ where: { id: existing.id }, data: { ...data, version: existing.version + 1 } });
      return { id: existing.id, created: false };
    }
    const row = await db.question.create({ data: { ...data, contentId: q.id }, select: { id: true } });
    return { id: row.id, created: true };
  }
}
