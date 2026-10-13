/**
 * 시드: packages/content의 curriculum.json과 questions/**.json을 DB에 업서트.
 * - 커리큘럼: slug 기준 업서트 (이름·순서 갱신, 삭제는 하지 않음). 트랙 단위 트랜잭션,
 *   유닛·레슨 순서가 바뀌어도 (track_id, sort_order)/(unit_id, sort_order) 유니크에 걸리지 않게 먼저 음수로 비켜 둔다
 * - 문제: content_id 기준 업서트, 상태는 SEED_QUESTION_STATUS(기본 published — 로컬·베타 편의)
 * 실행: pnpm --filter @cs-daily/api prisma:seed
 * 콘텐츠 경로는 SEED_CONTENT_ROOT로 덮어쓸 수 있다 (CI의 순서 변경 재시드 스모크용)
 */
import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CurriculumFile, LessonFile } from '@cs-daily/contracts';

const prisma = new PrismaClient();
const contentRoot = process.env.SEED_CONTENT_ROOT ?? resolve(__dirname, '../../../packages/content');
const status = (process.env.SEED_QUESTION_STATUS ?? 'published') as 'draft' | 'review' | 'published';

async function main() {
  const curriculum = CurriculumFile.parse(JSON.parse(readFileSync(join(contentRoot, 'curriculum.json'), 'utf8')));
  const lessonIdByKey = new Map<string, number>();

  for (const [ti, t] of curriculum.tracks.entries()) {
    // 트랙 하나를 한 트랜잭션으로 — 중간에 실패해도 순서가 반쯤 바뀐 상태로 남지 않는다
    const trackId = await prisma.$transaction(
      async (tx) => {
        const track = await tx.track.upsert({
          where: { slug: t.slug },
          create: { slug: t.slug, name: t.name, description: t.description, sortOrder: ti + 1, isActive: t.phase === 'mvp' },
          update: { name: t.name, description: t.description, sortOrder: ti + 1, isActive: t.phase === 'mvp' },
        });
        // units (track_id, sort_order)·lessons (unit_id, sort_order)는 유니크라, 콘텐츠에서 순서를 바꾸면
        // 첫 upsert가 아직 옛 자리에 있는 다른 행의 sort_order를 쓰려다 P2002가 난다.
        // 그래서 기존 행을 먼저 음수로 비켜 둔다(서로 다른 양수였으니 음수도 유니크). 이어지는 upsert가 1, 2, 3…을 다시 매긴다.
        // 콘텐츠에서 빠진 행(삭제하지 않음)은 음수로 남는다 — 아래 트랜잭션 뒤에서 경고한다.
        await tx.unit.updateMany({
          where: { trackId: track.id, sortOrder: { gt: 0 } },
          data: { sortOrder: { multiply: -1 } },
        });
        for (const [ui, u] of t.units.entries()) {
          const unit = await tx.unit.upsert({
            where: { trackId_slug: { trackId: track.id, slug: u.slug } },
            create: { trackId: track.id, slug: u.slug, name: u.name, sortOrder: ui + 1 },
            update: { name: u.name, sortOrder: ui + 1 },
          });
          await tx.lesson.updateMany({
            where: { unitId: unit.id, sortOrder: { gt: 0 } },
            data: { sortOrder: { multiply: -1 } },
          });
          for (const [li, l] of u.lessons.entries()) {
            const lesson = await tx.lesson.upsert({
              where: { unitId_slug: { unitId: unit.id, slug: l.slug } },
              create: { unitId: unit.id, slug: l.slug, name: l.name, objective: l.objective, keyPoints: l.keyPoints, sortOrder: li + 1 },
              update: { name: l.name, objective: l.objective, keyPoints: l.keyPoints, sortOrder: li + 1 },
            });
            lessonIdByKey.set(`${t.slug}/${u.slug}/${l.slug}`, lesson.id);
          }
        }
        return track.id;
      },
      { timeout: 60_000 },
    );

    // 콘텐츠에서 빠져 음수 순서로 남은 유닛·레슨은 지우지 않고 알리기만 한다 (기존 정책: 시드는 삭제하지 않음)
    const staleUnits = await prisma.unit.findMany({ where: { trackId, sortOrder: { lt: 0 } }, select: { slug: true } });
    const staleLessons = await prisma.lesson.findMany({
      where: { unit: { trackId }, sortOrder: { lt: 0 } },
      select: { slug: true, unit: { select: { slug: true } } },
    });
    if (staleUnits.length > 0 || staleLessons.length > 0) {
      const names = [
        ...staleUnits.map((s) => `${t.slug}/${s.slug}`),
        ...staleLessons.map((s) => `${t.slug}/${s.unit.slug}/${s.slug}`),
      ];
      console.warn(`콘텐츠에 없는 유닛/레슨이 남아 있음(순서 음수) — 경로 조회에 영향 줄 수 있음: ${names.join(', ')}`);
    }
  }
  console.log(`curriculum: ${curriculum.tracks.length} tracks, ${lessonIdByKey.size} lessons`);

  let created = 0;
  let updated = 0;
  const seen: string[] = [];
  for (const file of walk(join(contentRoot, 'questions'))) {
    const lf = LessonFile.parse(JSON.parse(readFileSync(file, 'utf8')));
    const lessonId = lessonIdByKey.get(`${lf.track}/${lf.unit}/${lf.lesson}`);
    if (!lessonId) throw new Error(`${file}: 커리큘럼에 없는 레슨`);
    // 레슨당 출제 수는 콘텐츠 파일의 문제 수를 따른다 (드릴 구조: 10문제)
    await prisma.lesson.update({ where: { id: lessonId }, data: { questionCount: lf.questions.length } });
    for (const [i, q] of lf.questions.entries()) {
      seen.push(q.id);
      const data = {
        lessonId,
        type: q.type,
        content: q.content as Prisma.InputJsonValue,
        answerKey: q.answer_key as Prisma.InputJsonValue,
        explanation: q.explanation,
        difficulty: q.difficulty,
        tags: q.tags,
        refs: q.refs,
        sortOrder: i + 1,
        status,
      };
      const existing = await prisma.question.findUnique({ where: { contentId: q.id }, select: { id: true, version: true } });
      if (existing) {
        await prisma.question.update({ where: { id: existing.id }, data: { ...data, version: existing.version + 1 } });
        updated += 1;
      } else {
        await prisma.question.create({ data: { ...data, contentId: q.id } });
        created += 1;
      }
    }
  }
  // 콘텐츠 파일에서 빠진 문제는 지우지 않고 retired로 내린다 (기존 답안·복습 기록의 FK 보존, 출제·복습에서는 제외됨)
  const retired = await prisma.question.updateMany({
    where: { contentId: { notIn: seen }, status: { not: 'retired' } },
    data: { status: 'retired' },
  });
  console.log(`questions: created=${created} updated=${updated} retired=${retired.count} (status=${status})`);
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : name.endsWith('.json') ? [p] : [];
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
