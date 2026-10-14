/**
 * 콘텐츠 검증 스크립트 (CI에서 실행).
 * - curriculum.json 스키마
 * - questions/<track>/<unit>/<lesson>.json 스키마 + 커리큘럼과의 정합성
 * - 문제 id 전역 유일성
 *
 * 실행: pnpm --filter @cs-daily/content validate
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CurriculumFile, LessonFile } from '@cs-daily/contracts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors: string[] = [];

/** 코드 문제는 정보처리기사(eip)·코딩 테스트(ct) 트랙에서만, 짧은 코드의 빈칸 형태로만 허용한다. */
const CODE_TRACKS: readonly string[] = ['eip', 'ct'];
const CODE_MAX_LINES = 12;
const CODE_MAX_COLS = 48;

const curriculum = CurriculumFile.safeParse(JSON.parse(readFileSync(join(root, 'curriculum.json'), 'utf8')));
if (!curriculum.success) {
  console.error('curriculum.json 스키마 오류:\n' + curriculum.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

const lessonKeys = new Set<string>();
for (const t of curriculum.data.tracks) {
  for (const u of t.units) {
    for (const l of u.lessons) lessonKeys.add(`${t.slug}/${u.slug}/${l.slug}`);
  }
}

const seenIds = new Map<string, string>();
let fileCount = 0;
let questionCount = 0;

function walk(dir: string) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.json')) checkLessonFile(p);
  }
}

function checkLessonFile(path: string) {
  fileCount += 1;
  const rel = path.slice(root.length + 1);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${rel}: JSON 파싱 실패 — ${(e as Error).message}`);
    return;
  }
  const parsed = LessonFile.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) errors.push(`${rel}: ${i.path.join('.')} — ${i.message}`);
    return;
  }
  const { track, unit, lesson, questions } = parsed.data;
  const key = `${track}/${unit}/${lesson}`;
  if (!lessonKeys.has(key)) errors.push(`${rel}: 커리큘럼에 없는 레슨 ${key}`);
  const expectedPath = `questions/${track}/${unit}/${lesson}.json`;
  if (rel !== expectedPath) errors.push(`${rel}: 파일 경로가 ${expectedPath} 이어야 합니다`);

  questions.forEach((q, i) => {
    questionCount += 1;
    if (seenIds.has(q.id)) errors.push(`${rel}#${i}: 중복 id ${q.id} (이미 ${seenIds.get(q.id)})`);
    seenIds.set(q.id, rel);
    if (!q.id.startsWith(`${track}-`)) errors.push(`${rel}#${i}: id는 '${track}-'로 시작해야 합니다 (${q.id})`);
    const code = (q.content as { code?: { source: string } | null }).code;
    if (code) {
      if (!CODE_TRACKS.includes(track)) {
        errors.push(`${rel}#${i}: 코드(content.code)는 ${CODE_TRACKS.map((t) => `'${t}'`).join('·')} 트랙에서만 허용됩니다 (${q.id})`);
      } else {
        const lines = code.source.replace(/\n+$/, '').split('\n');
        if (lines.length > CODE_MAX_LINES) errors.push(`${rel}#${i}: 코드 ${lines.length}줄 — ${CODE_MAX_LINES}줄 이하여야 합니다`);
        const longIdx = lines.findIndex((l) => [...l.replace(/\t/g, '    ')].length > CODE_MAX_COLS);
        if (longIdx >= 0) errors.push(`${rel}#${i}: 코드 ${longIdx + 1}번째 줄이 ${CODE_MAX_COLS}자를 넘습니다`);
        const blanks = code.source.split('___').length - 1;
        if (q.type === 'fill' && blanks > 1) errors.push(`${rel}#${i}: fill 코드의 빈칸(___)은 1개여야 합니다 (${blanks}개)`);
        if (q.type === 'single' && blanks > 1) errors.push(`${rel}#${i}: single 코드의 빈칸(___)은 0~1개여야 합니다 (${blanks}개)`);
        if (q.type === 'fill' && blanks === 0) errors.push(`${rel}#${i}: fill 코드 문제는 코드 안에 빈칸(___) 1개가 있어야 합니다`);
      }
    }
    if (q.type === 'single' || q.type === 'multi') {
      const opts = (q.content as { options: string[] }).options;
      const dup = opts.find((o, j) => opts.indexOf(o) !== j);
      if (dup) errors.push(`${rel}#${i}: 중복 보기 "${dup}"`);
    }
  });
  // 난이도가 레슨 안에서 내려가지 않는지(1→3 상승 규칙) 경고
  for (let i = 1; i < questions.length; i += 1) {
    if (questions[i]!.difficulty < questions[i - 1]!.difficulty) {
      console.warn(`경고 ${rel}#${i}: 난이도가 앞 문제보다 낮습니다 (${questions[i - 1]!.difficulty} → ${questions[i]!.difficulty})`);
      break;
    }
  }
}

walk(join(root, 'questions'));

if (errors.length) {
  console.error(`검증 실패 (${errors.length}건):\n` + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`OK: 트랙 ${curriculum.data.tracks.length}, 레슨 ${lessonKeys.size}, 문제 파일 ${fileCount}, 문제 ${questionCount}`);
