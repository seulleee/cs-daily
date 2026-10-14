// CI 전용: 시드가 "바뀐 것만 쓰는지"를 DB와 시드 로그로 단언한다.
//   snapshot                 문제별 version·트랙 구조를 /tmp에 저장
//   noop <seed.log>          같은 콘텐츠로 다시 시드한 뒤: 문제 생성·수정 0, 트랙 갱신 0, 모든 version 불변
//   tamper                   문제 3개의 해설을 바꾸고 1개를 지우고, 레슨 하나의 이름·다른 레슨 하나의 questionCount를 망가뜨린다
//   tampered <seed.log>      재시드 뒤: 문제 수정 3·생성 1·트랙 갱신 1·questionCount 갱신 1, 수정된 3개만 version+1, 나머지 불변, 값 복원
// 사용: DATABASE_URL=... node apps/api/test-e2e/assert-seed-diff.mjs <mode> [seed.log]
import { readFileSync, writeFileSync } from 'node:fs';
import pkg from '@prisma/client';

const { PrismaClient } = pkg;
const [mode, logPath] = process.argv.slice(2);
const SNAP = '/tmp/seed-diff-snapshot.json';
const prisma = new PrismaClient();
const failures = [];
const fail = (msg) => failures.push(msg);

function parseLog(path) {
  const log = readFileSync(path, 'utf8');
  const q = log.match(/questions: created=(\d+) updated=(\d+) unchanged=(\d+) retired=(\d+)/);
  const c = log.match(/curriculum: (\d+) tracks \(skipped=(\d+) updated=(\d+)\)/);
  const l = log.match(/lessons: questionCount updated=(\d+)/);
  if (!q || !c || !l) {
    fail(`시드 요약 로그를 찾지 못함 — ${path}`);
    return null;
  }
  return {
    created: +q[1], updated: +q[2], unchanged: +q[3], retired: +q[4],
    tracks: +c[1], tracksSkipped: +c[2], tracksUpdated: +c[3], countUpdated: +l[1],
  };
}

async function versions() {
  const rows = await prisma.question.findMany({ select: { contentId: true, version: true }, orderBy: { contentId: 'asc' } });
  return Object.fromEntries(rows.map((r) => [r.contentId, r.version]));
}

try {
  if (mode === 'snapshot') {
    const v = await versions();
    writeFileSync(SNAP, JSON.stringify(v));
    console.log(`snapshot: ${Object.keys(v).length} questions`);
  } else if (mode === 'noop') {
    const before = JSON.parse(readFileSync(SNAP, 'utf8'));
    const after = await versions();
    const s = parseLog(logPath);
    if (s) {
      if (s.created !== 0) fail(`변경 없는 재시드인데 문제 생성 ${s.created}개`);
      if (s.updated !== 0) fail(`변경 없는 재시드인데 문제 수정 ${s.updated}개`);
      if (s.unchanged !== Object.keys(before).length) fail(`변경없음 ${s.unchanged}개 != 기존 문제 ${Object.keys(before).length}개`);
      if (s.tracksUpdated !== 0 || s.tracksSkipped !== s.tracks) fail(`트랙 건너뜀=${s.tracksSkipped}/${s.tracks} 갱신=${s.tracksUpdated} (전부 건너뛰어야 함)`);
      if (s.countUpdated !== 0) fail(`questionCount 갱신 ${s.countUpdated}개`);
    }
    const diff = Object.keys(before).filter((k) => before[k] !== after[k]);
    if (diff.length > 0 || Object.keys(after).length !== Object.keys(before).length) fail(`version/문제 수가 바뀜: ${diff.slice(0, 5).join(', ')}`);
    console.log(`noop: ${JSON.stringify(s)} versionChanged=${diff.length}`);
  } else if (mode === 'tamper') {
    const rows = await prisma.question.findMany({ select: { id: true, contentId: true }, orderBy: { contentId: 'asc' }, take: 4 });
    const [a, b, c, gone] = rows;
    for (const r of [a, b, c]) {
      await prisma.question.update({ where: { id: r.id }, data: { explanation: `변조 ${r.contentId}` } });
    }
    await prisma.question.delete({ where: { id: gone.id } });
    // 마지막 정렬 레슨 둘: 하나는 이름, 다른 하나는 questionCount를 망가뜨린다
    const lessons = await prisma.lesson.findMany({ where: { sortOrder: { gt: 0 } }, orderBy: { id: 'asc' }, take: 2, select: { id: true } });
    await prisma.lesson.update({ where: { id: lessons[0].id }, data: { name: '변조된 레슨 이름' } });
    await prisma.lesson.update({ where: { id: lessons[1].id }, data: { questionCount: 99 } });
    writeFileSync('/tmp/seed-diff-tamper.json', JSON.stringify({ changed: [a, b, c].map((r) => r.contentId), deleted: gone.contentId }));
    console.log(`tamper: changed=${[a, b, c].map((r) => r.contentId).join(',')} deleted=${gone.contentId}`);
  } else if (mode === 'tampered') {
    const before = JSON.parse(readFileSync(SNAP, 'utf8'));
    const { changed, deleted } = JSON.parse(readFileSync('/tmp/seed-diff-tamper.json', 'utf8'));
    const after = await versions();
    const s = parseLog(logPath);
    if (s) {
      if (s.updated !== 3) fail(`문제 수정 ${s.updated}개(3이어야 함)`);
      if (s.created !== 1) fail(`문제 생성 ${s.created}개(1이어야 함)`);
      if (s.tracksUpdated !== 1 || s.tracksSkipped !== s.tracks - 1) fail(`트랙 갱신=${s.tracksUpdated} 건너뜀=${s.tracksSkipped}/${s.tracks} (1 / 나머지여야 함)`);
      if (s.countUpdated !== 1) fail(`questionCount 갱신 ${s.countUpdated}개(1이어야 함)`);
    }
    for (const k of Object.keys(before)) {
      if (k === deleted) {
        if (after[k] !== 1) fail(`지워졌다 다시 생긴 ${k}의 version=${after[k]}(1이어야 함)`);
      } else if (changed.includes(k)) {
        if (after[k] !== before[k] + 1) fail(`수정된 ${k} version ${before[k]} -> ${after[k]}(+1이어야 함)`);
      } else if (after[k] !== before[k]) {
        fail(`변경 없는 ${k} version이 ${before[k]} -> ${after[k]}로 바뀜`);
      }
    }
    const restored = await prisma.question.count({ where: { contentId: { in: changed }, explanation: { startsWith: '변조 ' } } });
    if (restored !== 0) fail(`변조한 해설이 복원되지 않음 ${restored}개`);
    const badLessons = await prisma.lesson.count({ where: { OR: [{ name: '변조된 레슨 이름' }, { questionCount: 99 }] } });
    if (badLessons !== 0) fail(`변조한 레슨이 복원되지 않음 ${badLessons}개`);
    console.log(`tampered: ${JSON.stringify(s)}`);
  } else {
    console.error('사용: node assert-seed-diff.mjs snapshot|noop|tamper|tampered [seed.log]');
    process.exit(2);
  }
} finally {
  await prisma.$disconnect();
}

if (failures.length > 0) {
  for (const f of failures) console.error(`::error title=seed-diff::${f}`);
  process.exit(1);
}
console.log(`seed-diff ${mode}: OK`);
