// CI 전용: 콘텐츠에서 빠진 유닛·레슨(sortOrder 음수 = 퇴역)을 시드가 올바르게 다루는지 DB를 직접 보고 단언한다.
// rotate-units.mjs가 만든 콘텐츠(첫 유닛의 마지막 레슨을 뺀 것)로 재시드한 직후에 돌린다.
//   (기본)   참조 없는 퇴역 레슨은 지워졌고(음수이면서 문제 없는 레슨 0), 문제가 있는 빠진 레슨 1개는 남았고, 퇴역 유닛은 없다
//   restored  원래 콘텐츠로 되돌려 재시드한 뒤: 퇴역 레슨·유닛이 하나도 남지 않았다(뺐던 레슨이 양수로 복귀)
// 사용: DATABASE_URL=... node apps/api/test-e2e/assert-retired.mjs [restored]
import pkg from '@prisma/client';

const { PrismaClient } = pkg;
const mode = process.argv[2] ?? 'rotated';
if (mode !== 'rotated' && mode !== 'restored') {
  console.error('사용: node assert-retired.mjs [restored]');
  process.exit(2);
}

const prisma = new PrismaClient();
const failures = [];

try {
  const retiredLessonsWithoutQuestions = await prisma.lesson.count({ where: { sortOrder: { lt: 0 }, questions: { none: {} } } });
  const retiredLessons = await prisma.lesson.findMany({
    where: { sortOrder: { lt: 0 } },
    select: { slug: true, unit: { select: { slug: true, track: { select: { slug: true } } } }, _count: { select: { questions: true } } },
  });
  const retiredUnits = await prisma.unit.count({ where: { sortOrder: { lt: 0 } } });

  const names = retiredLessons.map((l) => `${l.unit.track.slug}/${l.unit.slug}/${l.slug}(문제 ${l._count.questions})`).join(', ') || '없음';
  console.log(`mode=${mode} retiredLessons=${retiredLessons.length} withoutQuestions=${retiredLessonsWithoutQuestions} retiredUnits=${retiredUnits} -> ${names}`);

  // (a) 문제 없는 퇴역 레슨은 시드가 지웠어야 한다
  if (retiredLessonsWithoutQuestions !== 0) failures.push(`문제 없는 퇴역 레슨이 ${retiredLessonsWithoutQuestions}개 남음(0이어야 함)`);
  // (b) 콘텐츠에서 뺀 레슨은 문제가 있어(retired 처리) 삭제되지 않고 퇴역으로 남는다. 복구 후에는 없어야 한다
  const expectedRetiredLessons = mode === 'rotated' ? 1 : 0;
  if (retiredLessons.length !== expectedRetiredLessons) failures.push(`퇴역 레슨 ${retiredLessons.length}개(${expectedRetiredLessons}개여야 함): ${names}`);
  // (c) 퇴역 유닛은 없어야 한다(유닛은 회전만 했고 빠진 유닛이 없음)
  if (retiredUnits !== 0) failures.push(`퇴역 유닛이 ${retiredUnits}개 남음(0이어야 함)`);
} catch (e) {
  failures.push(`DB 조회 실패: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await prisma.$disconnect();
}

if (failures.length > 0) {
  // ::error 명령은 한 줄이어야 해서 줄바꿈(Prisma 오류 메시지 등)을 공백으로 접고 길이를 제한한다
  const message = failures.join(' / ').replace(/\s+/g, ' ').slice(0, 1200);
  console.log(`::error title=retired::퇴역 행 단언 실패(${mode}) — ${message}`);
  process.exit(1);
}
console.log(`OK: 퇴역 행 단언 통과(${mode})`);
