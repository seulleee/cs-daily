/**
 * 시드: packages/content의 curriculum.json과 questions/**.json을 DB에 업서트.
 * - 커리큘럼: slug 기준 업서트 (이름·순서 갱신, 삭제는 하지 않음)
 * - 문제: content_id 기준 업서트, 상태는 SEED_QUESTION_STATUS(기본 published — 로컬·베타 편의)
 * 실행: pnpm --filter @cs-daily/api prisma:seed
 */
import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CurriculumFile, LessonFile } from '@cs-daily/contracts';

const prisma = new PrismaClient();
const contentRoot = resolve(__dirname, '../../../packages/content');
const status = (process.env.SEED_QUESTION_STATUS ?? 'published') as 'draft' | 'review' | 'published';

async function main() {
  const curriculum = CurriculumFile.parse(JSON.parse(readFileSync(join(contentRoot, 'curriculum.json'), 'utf8')));
  const lessonIdByKey = new Map<string, number>();

  for (const [ti, t] of curriculum.tracks.entries()) {
    const track = await prisma.track.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, name: t.name, description: t.description, sortOrder: ti + 1, isActive: t.phase === 'mvp' },
      update: { name: t.name, description: t.description, sortOrder: ti + 1, isActive: t.phase === 'mvp' },
    });
    for (const [ui, u] of t.units.entries()) {
      const unit = await prisma.unit.upsert({
        where: { trackId_slug: { trackId: track.id, slug: u.slug } },
        create: { trackId: track.id, slug: u.slug, name: u.name, sortOrder: ui + 1 },
        update: { name: u.name, sortOrder: ui + 1 },
      });
      for (const [li, l] of u.lessons.entries()) {
        const lesson = await prisma.lesson.upsert({
          where: { unitId_slug: { unitId: unit.id, slug: l.slug } },
          create: { unitId: unit.id, slug: l.slug, name: l.name, objective: l.objective, sortOrder: li + 1 },
          update: { name: l.name, objective: l.objective, sortOrder: li + 1 },
        });
        lessonIdByKey.set(`${t.slug}/${u.slug}/${l.slug}`, lesson.id);
      }
    }
  }
  console.log(`curriculum: ${curriculum.tracks.length} tracks, ${lessonIdByKey.size} lessons`);

  let created = 0;
  let updated = 0;
  for (const file of walk(join(contentRoot, 'questions'))) {
    const lf = LessonFile.parse(JSON.parse(readFileSync(file, 'utf8')));
    const lessonId = lessonIdByKey.get(`${lf.track}/${lf.unit}/${lf.lesson}`);
    if (!lessonId) throw new Error(`${file}: 커리큘럼에 없는 레슨`);
    for (const [i, q] of lf.questions.entries()) {
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
  console.log(`questions: created=${created} updated=${updated} (status=${status})`);
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
