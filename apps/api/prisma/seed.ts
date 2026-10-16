/**
 * 시드: packages/content의 curriculum.json과 questions/**.json을 DB에 업서트.
 * - 커리큘럼: slug 기준 업서트 (이름·순서 갱신, 삭제는 하지 않음). 트랙 단위 트랜잭션,
 *   유닛·레슨 순서가 바뀌어도 (track_id, sort_order)/(unit_id, sort_order) 유니크에 걸리지 않게 먼저 음수로 비켜 둔다
 * - 퇴역: 콘텐츠에서 빠진 유닛·레슨은 sortOrder 음수로 남고(읽기 쪽은 양수만 본다), 문제·세션·진도 참조가 없으면 시드가 지우고 있으면 FK 보존을 위해 남긴다
 * - 문제: content_id 기준 업서트, 상태는 SEED_QUESTION_STATUS(기본 published — 로컬·베타 편의)
 * - 속도: 운영 DB는 왕복 지연이 커서(러너 미국 ↔ Supabase 서울) 기존 행을 한 번에 읽어 메모리에서 비교하고 바뀐 것만 쓴다.
 *   구조가 같은 트랙은 트랜잭션째 건너뛰고, 문제는 내용이 바뀐 것만 update(version+1)·새 것은 createMany·같은 것은 무시한다.
 *   비교 로직은 순수 함수(seed-diff.ts)로 빼 단위 테스트한다
 * 실행: pnpm --filter @cs-daily/api prisma:seed
 * 콘텐츠 경로는 SEED_CONTENT_ROOT로 덮어쓸 수 있다 (CI의 순서 변경 재시드 스모크용)
 */
import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CurriculumFile, LessonFile } from '@cs-daily/contracts';
import {
  chunk,
  classifyQuestion,
  desiredTrackShape,
  hasRetiredRows,
  trackStructureEqual,
  type QuestionData,
  type TrackShape,
} from './seed-diff';

const prisma = new PrismaClient();
const contentRoot = process.env.SEED_CONTENT_ROOT ?? resolve(__dirname, '../../../packages/content');
const status = (process.env.SEED_QUESTION_STATUS ?? 'published') as 'draft' | 'review' | 'published';

let deletedLessons = 0;
let deletedUnits = 0;
let keptRetired = 0;
const UPDATE_CHUNK = 200;
const CREATE_CHUNK = 500;

async function main() {
  const startedAt = Date.now();
  const curriculum = CurriculumFile.parse(JSON.parse(readFileSync(join(contentRoot, 'curriculum.json'), 'utf8')));
  const lessonIdByKey = new Map<string, number>();
  let tracksSkipped = 0;
  let tracksUpdated = 0;
  const lessonQuestionCount = new Map<number, number>();

  // 기존 트랙·유닛·레슨을 한 번에 읽는다 (쿼리 3회). 트랙마다 구조를 비교해 같으면 트랜잭션을 건너뛴다
  const existingTracks = await prisma.track.findMany({
    include: { units: { include: { lessons: true } } },
  });
  const existingBySlug = new Map(existingTracks.map((tr) => [tr.slug, tr]));

  for (const [ti, t] of curriculum.tracks.entries()) {
    const found = existingBySlug.get(t.slug);
    const existingShape: TrackShape | undefined = found && {
      name: found.name,
      description: found.description,
      sortOrder: found.sortOrder,
      isActive: found.isActive,
      units: found.units.map((u) => ({
        slug: u.slug,
        name: u.name,
        sortOrder: u.sortOrder,
        lessons: u.lessons.map((l) => ({ slug: l.slug, name: l.name, objective: l.objective, keyPoints: l.keyPoints, intro: l.intro ?? [], sortOrder: l.sortOrder })),
      })),
    };

    let trackId: number;
    if (found && existingShape && trackStructureEqual(existingShape, desiredTrackShape(t, ti))) {
      // 구조가 같다 — 쓸 것이 없다. 레슨 id·문제 수만 읽어 둔 값에서 채운다
      tracksSkipped += 1;
      trackId = found.id;
      for (const u of found.units) {
        if (u.sortOrder <= 0) continue;
        for (const l of u.lessons) {
          if (l.sortOrder <= 0) continue;
          lessonIdByKey.set(`${t.slug}/${u.slug}/${l.slug}`, l.id);
          lessonQuestionCount.set(l.id, l.questionCount);
        }
      }
      // 음수(퇴역) 행이 남아 있으면 정리 로직만 돌린다 (참조 없는 것은 지우고 나머지는 경고)
      if (!hasRetiredRows(existingShape.units)) continue;
    } else {
      tracksUpdated += 1;
      trackId = await syncTrack(t, ti, lessonIdByKey, lessonQuestionCount);
    }
    await cleanupRetired(t.slug, trackId);
  }
  console.log(`retired: deleted lessons=${deletedLessons} units=${deletedUnits}, kept=${keptRetired}`);
  console.log(`curriculum: ${curriculum.tracks.length} tracks (skipped=${tracksSkipped} updated=${tracksUpdated}), ${lessonIdByKey.size} lessons`);

  // 소스 파일 파싱·검증은 쓰기 전에 끝낸다
  const lessonFiles = walk(join(contentRoot, 'questions')).map((file) => ({ file, lf: LessonFile.parse(JSON.parse(readFileSync(file, 'utf8'))) }));
  for (const { file, lf } of lessonFiles) {
    if (!lessonIdByKey.has(`${lf.track}/${lf.unit}/${lf.lesson}`)) throw new Error(`${file}: 커리큘럼에 없는 레슨`);
  }

  // 기존 문제를 한 번에 읽는다 (쿼리 1회)
  const existingQuestions = new Map(
    (
      await prisma.question.findMany({
        select: {
          id: true, contentId: true, version: true, lessonId: true, type: true, content: true, answerKey: true,
          explanation: true, difficulty: true, tags: true, refs: true, sortOrder: true, status: true,
        },
      })
    ).map((q) => [q.contentId, q]),
  );

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let countUpdated = 0;
  const seen: string[] = [];
  const toCreate: Prisma.QuestionCreateManyInput[] = [];
  const toUpdate: { id: string; data: Prisma.QuestionUncheckedUpdateInput }[] = [];
  const countUpdates: { id: number; count: number }[] = [];
  for (const { lf } of lessonFiles) {
    const lessonId = lessonIdByKey.get(`${lf.track}/${lf.unit}/${lf.lesson}`)!;
    // 레슨당 출제 수는 콘텐츠 파일의 문제 수를 따른다 (드릴 구조: 10문제)
    if (lessonQuestionCount.get(lessonId) !== lf.questions.length) countUpdates.push({ id: lessonId, count: lf.questions.length });
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
      const ex = existingQuestions.get(q.id);
      const change = classifyQuestion(ex as QuestionData | undefined, data);
      if (change === 'create') {
        toCreate.push({ ...data, contentId: q.id });
        created += 1;
      } else if (change === 'same' || !ex) {
        unchanged += 1;
      } else {
        // version은 "어느 판의 문제를 풀었는지"(Answer.questionVersion)를 가리키므로 내용이 바뀔 때만 올린다.
        // 배치·상태만 바뀐 경우(레슨 이동·퇴역 복귀)는 같은 판이다
        toUpdate.push({ id: ex.id, data: change === 'content' ? { ...data, version: ex.version + 1 } : data });
        updated += 1;
      }
    }
  }

  for (const part of chunk(countUpdates, UPDATE_CHUNK)) {
    await prisma.$transaction(part.map((c) => prisma.lesson.update({ where: { id: c.id }, data: { questionCount: c.count } })));
    countUpdated += part.length;
  }
  for (const part of chunk(toCreate, CREATE_CHUNK)) {
    await prisma.question.createMany({ data: part });
  }
  for (const part of chunk(toUpdate, UPDATE_CHUNK)) {
    await prisma.$transaction(part.map((u) => prisma.question.update({ where: { id: u.id }, data: u.data })));
  }
  // 콘텐츠 파일에서 빠진 문제는 지우지 않고 retired로 내린다 (기존 답안·복습 기록의 FK 보존, 출제·복습에서는 제외됨)
  const retired = await prisma.question.updateMany({
    where: { contentId: { notIn: seen }, status: { not: 'retired' } },
    data: { status: 'retired' },
  });
  console.log(`questions: created=${created} updated=${updated} unchanged=${unchanged} retired=${retired.count} (status=${status})`);
  console.log(`lessons: questionCount updated=${countUpdated}`);
  console.log(`seed done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

/** 구조가 달라진 트랙 하나를 동기화한다 — 기존 로직 그대로(음수로 비켜 둔 뒤 순서 재부여) */
async function syncTrack(
  t: CurriculumFile['tracks'][number],
  ti: number,
  lessonIdByKey: Map<string, number>,
  lessonQuestionCount: Map<number, number>,
): Promise<number> {
  {
    // 트랙 하나를 한 트랜잭션으로 — 중간에 실패해도 순서가 반쯤 바뀐 상태로 남지 않는다
    return await prisma.$transaction(
      async (tx) => {
        const track = await tx.track.upsert({
          where: { slug: t.slug },
          create: { slug: t.slug, name: t.name, description: t.description, sortOrder: ti + 1, isActive: t.phase === 'mvp' },
          update: { name: t.name, description: t.description, sortOrder: ti + 1, isActive: t.phase === 'mvp' },
        });
        // units (track_id, sort_order)·lessons (unit_id, sort_order)는 유니크라, 콘텐츠에서 순서를 바꾸면
        // 첫 upsert가 아직 옛 자리에 있는 다른 행의 sort_order를 쓰려다 P2002가 난다.
        // 그래서 기존 행을 먼저 음수로 비켜 둔다(서로 다른 양수였으니 음수도 유니크). 이어지는 upsert가 1, 2, 3…을 다시 매긴다.
        // 콘텐츠에서 빠진 행은 음수(퇴역)로 남는다 — 아래 트랜잭션 뒤에서 참조 없는 행은 지우고 나머지는 경고한다.
        // 이미 음수인(콘텐츠에서 빠진) 행은 더 멀리 밀어 새로 비키는 음수 값과 겹치지 않게 한다
        await tx.unit.updateMany({
          where: { trackId: track.id, sortOrder: { lt: 0 } },
          data: { sortOrder: { decrement: 10000 } },
        });
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
          // 레슨도 같은 방식: 이미 음수인 행을 먼저 더 멀리 밀어 둔다
          await tx.lesson.updateMany({
            where: { unitId: unit.id, sortOrder: { lt: 0 } },
            data: { sortOrder: { decrement: 10000 } },
          });
          await tx.lesson.updateMany({
            where: { unitId: unit.id, sortOrder: { gt: 0 } },
            data: { sortOrder: { multiply: -1 } },
          });
          for (const [li, l] of u.lessons.entries()) {
            const lesson = await tx.lesson.upsert({
              where: { unitId_slug: { unitId: unit.id, slug: l.slug } },
              create: { unitId: unit.id, slug: l.slug, name: l.name, objective: l.objective, keyPoints: l.keyPoints, intro: l.intro ?? [], sortOrder: li + 1 },
              update: { name: l.name, objective: l.objective, keyPoints: l.keyPoints, intro: l.intro ?? [], sortOrder: li + 1 },
            });
            lessonIdByKey.set(`${t.slug}/${u.slug}/${l.slug}`, lesson.id);
            lessonQuestionCount.set(lesson.id, lesson.questionCount);
          }
        }
        return track.id;
      },
      { timeout: 60_000 },
    );
  }
}

/**
 * 콘텐츠에서 빠져 음수 순서로 남은 퇴역 유닛·레슨: 문제·세션·진도 참조가 없으면 지우고, 있으면 FK 보존을 위해 남긴다.
 * 읽기 쪽(경로·잠금·카운트)은 sortOrder > 0만 보므로 남아 있어도 사용자에게는 보이지 않는다.
 * 레슨은 자기 순서가 음수이거나 속한 유닛이 음수(유닛째 콘텐츠에서 빠짐 — 레슨 순서는 양수로 남는다)면 퇴역이다.
 */
async function cleanupRetired(trackSlug: string, trackId: number) {
  const retiredLesson: Prisma.LessonWhereInput = { unit: { trackId }, OR: [{ sortOrder: { lt: 0 } }, { unit: { sortOrder: { lt: 0 } } }] };
  const lessonsDeleted = await prisma.lesson.deleteMany({
    where: { ...retiredLesson, questions: { none: {} }, sessions: { none: {} }, progress: { none: {} } },
  });
  const unitsDeleted = await prisma.unit.deleteMany({ where: { trackId, sortOrder: { lt: 0 }, lessons: { none: {} } } });
  deletedLessons += lessonsDeleted.count;
  deletedUnits += unitsDeleted.count;

  const keptUnits = await prisma.unit.findMany({ where: { trackId, sortOrder: { lt: 0 } }, select: { slug: true } });
  const keptLessons = await prisma.lesson.findMany({ where: retiredLesson, select: { slug: true, unit: { select: { slug: true } } } });
  keptRetired += keptUnits.length + keptLessons.length;
  if (keptUnits.length > 0 || keptLessons.length > 0) {
    const names = [...keptUnits.map((s) => `${trackSlug}/${s.slug}`), ...keptLessons.map((s) => `${trackSlug}/${s.unit.slug}/${s.slug}`)];
    console.warn(`콘텐츠에 없는 유닛/레슨이 참조(문제·세션·진도) 때문에 남아 있음 — 읽기 쪽에서는 숨겨짐: ${names.join(', ')}`);
  }
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
