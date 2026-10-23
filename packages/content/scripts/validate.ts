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
import { CODING_LANGUAGES, CurriculumFile, LessonFile } from '@cs-daily/contracts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors: string[] = [];

/** 코드 문제는 정보처리기사(eip)·코딩 테스트(ct)·AI·ML(ai) 트랙에서만, 짧은 코드의 빈칸 형태로만 허용한다. */
const CODE_TRACKS: readonly string[] = ['eip', 'ct', 'ai'];
/** 언어별 variants(Python·Java·JavaScript·C++)로만 코드 문제를 내는 트랙 */
const VARIANT_TRACK = 'ct';
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

// 도입 설명(intro): 길이 규칙은 스키마가 검사한다. 여기서는 keyPoints를 그대로 옮긴 문단만 막는다.
for (const t of curriculum.data.tracks) {
  for (const u of t.units) {
    for (const l of u.lessons) {
      for (const para of l.intro ?? []) {
        const dup = l.keyPoints.find((kp) => para.includes(kp));
        if (dup) errors.push(`${t.slug}/${u.slug}/${l.slug}: intro가 keyPoints 문장을 그대로 반복합니다 ("${dup}")`);
      }
    }
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

/** 코드 한 덩어리(content.code 또는 variants[lang].code)의 줄 수·폭·빈칸 개수 */
function checkCode(where: string, source: string, type: string) {
  const lines = source.replace(/\n+$/, '').split('\n');
  if (lines.length > CODE_MAX_LINES) errors.push(`${where}: 코드 ${lines.length}줄 — ${CODE_MAX_LINES}줄 이하여야 합니다`);
  const longIdx = lines.findIndex((l) => [...l.replace(/\t/g, '    ')].length > CODE_MAX_COLS);
  if (longIdx >= 0) errors.push(`${where}: 코드 ${longIdx + 1}번째 줄이 ${CODE_MAX_COLS}자를 넘습니다`);
  const blanks = source.split('___').length - 1;
  if (type === 'fill' && blanks > 1) errors.push(`${where}: fill 코드의 빈칸(___)은 1개여야 합니다 (${blanks}개)`);
  if (type === 'single' && blanks > 1) errors.push(`${where}: single 코드의 빈칸(___)은 0~1개여야 합니다 (${blanks}개)`);
  if (type === 'fill' && blanks === 0) errors.push(`${where}: fill 코드 문제는 코드 안에 빈칸(___) 1개가 있어야 합니다`);
}

function checkDupOptions(where: string, opts: string[] | undefined) {
  const dup = opts?.find((o, j) => opts.indexOf(o) !== j);
  if (dup) errors.push(`${where}: 중복 보기 "${dup}"`);
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
    const content = q.content as { code?: { source: string } | null; options?: string[]; variants?: Record<string, { code: { source: string }; options?: string[] }> };
    if (content.variants) {
      // 언어별 variants는 ct 트랙에서만 허용되고, 4개 언어를 모두 제공해야 한다
      if (track !== VARIANT_TRACK) {
        errors.push(`${rel}#${i}: variants(언어별 코드)는 '${VARIANT_TRACK}' 트랙에서만 허용됩니다 (${q.id})`);
      } else {
        const missing = CODING_LANGUAGES.filter((l) => !content.variants![l]);
        if (missing.length) errors.push(`${rel}#${i}: variants에 언어가 빠졌습니다: ${missing.join(', ')} — ${CODING_LANGUAGES.join('·')} 모두 필요합니다 (${q.id})`);
      }
      for (const [lang, v] of Object.entries(content.variants)) {
        checkCode(`${rel}#${i} variants.${lang}`, v.code.source, q.type);
        checkDupOptions(`${rel}#${i} variants.${lang}`, v.options);
      }
    } else if (content.code) {
      if (!CODE_TRACKS.includes(track)) {
        errors.push(`${rel}#${i}: 코드(content.code)는 ${CODE_TRACKS.map((t) => `'${t}'`).join('·')} 트랙에서만 허용됩니다 (${q.id})`);
      } else if (track === VARIANT_TRACK) {
        errors.push(`${rel}#${i}: '${VARIANT_TRACK}' 트랙의 코드 문제는 content.code가 아니라 variants로 4개 언어를 모두 제공해야 합니다 (${q.id})`);
      } else {
        checkCode(`${rel}#${i}`, content.code.source, q.type);
      }
    }
    checkDupOptions(`${rel}#${i}`, content.options);
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
