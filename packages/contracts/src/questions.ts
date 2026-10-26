import { z } from 'zod';

/**
 * 문제 유형별 content / answer_key / user answer 스키마.
 * - content   : 클라이언트에 내려가는 부분 (정답 없음)
 * - answerKey : 서버 전용. API 응답에 절대 포함하지 않는다.
 * - userAnswer: 클라이언트가 제출하는 형식
 * MVP 유형: single, multi, ox, fill. 나머지는 2·3단계에 추가.
 */

export const QuestionType = z.enum(['single', 'multi', 'ox', 'fill']);
export type QuestionType = z.infer<typeof QuestionType>;

/** 코드 문제는 정보처리기사(eip)·코딩 테스트(ct)·AI·ML(ai)·AWS(aws, bash·json·hcl) 트랙에서만 허용된다(validate가 강제). */
export const CodeLanguage = z.enum(['c', 'java', 'python', 'sql', 'pseudo', 'javascript', 'cpp', 'bash', 'json', 'hcl']);
export type CodeLanguage = z.infer<typeof CodeLanguage>;

/**
 * 코딩 테스트(ct) 트랙에서 사용자가 고르는 풀이 언어. CodeLanguage의 부분집합이며
 * 문제의 content.variants / answer_key.variants 키와 User.codeLanguage가 이 값을 쓴다.
 */
export const CodingLanguage = z.enum(['python', 'java', 'javascript', 'cpp']);
export type CodingLanguage = z.infer<typeof CodingLanguage>;
export const CODING_LANGUAGES = CodingLanguage.options;
export const DEFAULT_CODING_LANGUAGE: CodingLanguage = 'python';
/** 화면 표시용 이름 */
export const CODING_LANGUAGE_LABEL: Record<CodingLanguage, string> = {
  python: 'Python',
  java: 'Java',
  javascript: 'JavaScript',
  cpp: 'C++',
};

const CodeBlock = z
  .object({
    language: CodeLanguage,
    source: z.string().min(1).max(4000),
  })
  .nullable()
  .optional();

// ---------- content ----------
export const SingleContent = z.object({
  prompt: z.string().min(1).max(300),
  code: CodeBlock,
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
});
export const MultiContent = SingleContent;
export const OxContent = z.object({
  prompt: z.string().min(1).max(300),
  code: CodeBlock,
});
export const FillContent = z
  .object({
    /** 빈칸은 ___ (언더스코어 3개)로 표시. 코드 안에 빈칸이 있으면 prompt에는 없어도 된다 */
    prompt: z.string().min(1).max(300),
    code: CodeBlock,
    hint: z.string().max(120).optional(),
  })
  .refine((c) => c.prompt.includes('___') || !!c.code?.source.includes('___'), {
    path: ['prompt'],
    message: '빈칸(___)이 prompt 또는 code에 있어야 합니다',
  });

export const QuestionContent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('single'), content: SingleContent }),
  z.object({ type: z.literal('multi'), content: MultiContent }),
  z.object({ type: z.literal('ox'), content: OxContent }),
  z.object({ type: z.literal('fill'), content: FillContent }),
]);

// ---------- answer key (server only) ----------
export const SingleAnswerKey = z.object({ index: z.number().int().min(0) });
export const MultiAnswerKey = z.object({
  indices: z.array(z.number().int().min(0)).min(1),
  /** true면 부분 점수 대신 "부분 정답은 오답" 규칙 유지. MVP는 완전 일치만 정답 */
  partial: z.boolean().optional(),
});
export const OxAnswerKey = z.object({ value: z.boolean() });
/** 주관식 대표 정답에 허용되는 문자: 한글·영문·숫자·공백 */
export const FILL_PLAIN_ANSWER = /^[가-힣A-Za-z0-9 ]+$/;

/** 코드 빈칸(언어별 variants) 대표 정답에는 식별자에 쓰이는 밑줄(push_back)도 허용 */
export const FILL_CODE_ANSWER = /^[가-힣A-Za-z0-9_ ]+$/;

export const FillAnswerKey = z.object({
  /** 허용 답안 목록. 비교 전 trim/lowercase/공백 정규화 */
  accepted: z.array(z.string().min(1).max(100)).min(1),
});

export const AnswerKeyByType = {
  single: SingleAnswerKey,
  multi: MultiAnswerKey,
  ox: OxAnswerKey,
  fill: FillAnswerKey,
} as const;

// ---------- user answer ----------
export const SingleUserAnswer = z.object({ index: z.number().int().min(0) });
export const MultiUserAnswer = z.object({ indices: z.array(z.number().int().min(0)) });
export const OxUserAnswer = z.object({ value: z.boolean() });
export const FillUserAnswer = z.object({ text: z.string().max(200) });

export const UserAnswer = z.union([SingleUserAnswer, MultiUserAnswer, OxUserAnswer, FillUserAnswer]);
export type UserAnswer = z.infer<typeof UserAnswer>;

export const UserAnswerByType = {
  single: SingleUserAnswer,
  multi: MultiUserAnswer,
  ox: OxUserAnswer,
  fill: FillUserAnswer,
} as const;

// ---------- 콘텐츠 파일(JSON) 한 문제의 전체 스키마 ----------
export const QuestionFile = z
  .object({
    id: z.string().regex(/^[a-z]+-[a-z0-9-]+-\d{3}$/, 'id 형식: {track}-{slug}-{3자리}'),
    type: QuestionType,
    difficulty: z.number().int().min(1).max(5),
    tags: z.array(z.string().min(1).max(30)).max(8).default([]),
    content: z.unknown(),
    answer_key: z.unknown(),
    explanation: z.string().min(20).max(400),
    refs: z.array(z.string().url()).max(5).default([]),
  })
  .superRefine((q, ctx) => {
    // ct 트랙의 언어별 코드 문제는 별도 형식(content.variants + answer_key.variants)이다
    if (hasVariants(q.content) || hasVariants(q.answer_key)) {
      checkVariantQuestion(q, ctx);
      return;
    }
    const parsed = QuestionContent.safeParse({ type: q.type, content: q.content });
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', path: ['content'], message: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    const key = AnswerKeyByType[q.type].safeParse(q.answer_key);
    if (!key.success) {
      ctx.addIssue({ code: 'custom', path: ['answer_key'], message: key.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    // 주관식은 대표 정답(accepted[0])이 한글·영문·숫자·공백만으로 입력 가능해야 한다.
    // Θ, ², ^ 같은 기호가 필요한 답은 모바일 키보드로 입력하기 어려우므로 객관식으로 낸다.
    if (q.type === 'fill') {
      const primary = (key.data as z.infer<typeof FillAnswerKey>).accepted[0]!;
      if (!FILL_PLAIN_ANSWER.test(primary)) {
        ctx.addIssue({
          code: 'custom',
          path: ['answer_key', 'accepted', 0],
          message: `주관식 대표 정답 "${primary}"에 한글·영문·숫자 외 문자가 있습니다 — 객관식으로 바꾸세요`,
        });
      }
    }
    // 보기 인덱스 범위 검증
    if (q.type === 'single' || q.type === 'multi') {
      const n = (parsed.data.content as z.infer<typeof SingleContent>).options.length;
      const idx = q.type === 'single' ? [(key.data as z.infer<typeof SingleAnswerKey>).index] : (key.data as z.infer<typeof MultiAnswerKey>).indices;
      for (const i of idx) {
        if (i >= n) ctx.addIssue({ code: 'custom', path: ['answer_key'], message: `index ${i}는 보기 개수 ${n}를 넘습니다` });
      }
    }
  });
export type QuestionFile = z.infer<typeof QuestionFile>;

// ---------- 언어별 코드 variants (ct 트랙) ----------
// 한 문제를 Python·Java·JavaScript·C++ 코드로 각각 낸다. prompt·hint·explanation은 공통이고
// 코드(와 보기)는 content.variants[lang], 정답은 answer_key.variants[lang](+선택 explanation)에 둔다.
// 서버는 사용자의 언어 variant만 내려보내고 채점도 제출된 lang의 variant로 한다.

const VariantCode = z.object({ language: CodingLanguage, source: z.string().min(1).max(4000) });
const VariantContent = z.object({
  code: VariantCode,
  /** single: 이 언어에서만 다른 보기. 없으면 content.options를 쓴다 */
  options: z.array(z.string().min(1).max(200)).min(2).max(6).optional(),
});
export type VariantContent = z.infer<typeof VariantContent>;

const VariantsOf = <T extends z.ZodTypeAny>(v: T) => z.record(CodingLanguage, v).superRefine((rec, ctx) => {
  if (Object.keys(rec).length === 0) ctx.addIssue({ code: 'custom', message: 'variants가 비어 있습니다' });
});

const VariantQuestionContent = z.object({
  prompt: z.string().min(1).max(300),
  hint: z.string().max(120).optional(),
  /** single·공통 보기 (variant가 options를 따로 주지 않을 때) */
  options: z.array(z.string().min(1).max(200)).min(2).max(6).optional(),
  variants: VariantsOf(VariantContent),
});
export type VariantQuestionContent = z.infer<typeof VariantQuestionContent>;

const variantExplanation = z.string().min(20).max(400).optional();
const VariantAnswerKeyByType = {
  single: SingleAnswerKey.extend({ explanation: variantExplanation }),
  ox: OxAnswerKey.extend({ explanation: variantExplanation }),
  fill: FillAnswerKey.extend({ explanation: variantExplanation }),
} as const;

/** 서버 전용. answer_key.variants[lang] = 유형별 정답 + (선택) 이 언어에서만 다른 해설 */
export const VariantAnswerKey = z.object({ variants: VariantsOf(z.record(z.string(), z.unknown())) });

export function hasVariants(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'variants' in value;
}

function checkVariantQuestion(q: { type: z.infer<typeof QuestionType>; content?: unknown; answer_key?: unknown }, ctx: z.RefinementCtx) {
  const bad = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  if (q.type === 'multi') return bad(['type'], 'variants 문제는 single·ox·fill만 가능합니다');
  const content = VariantQuestionContent.safeParse(q.content);
  if (!content.success) return bad(['content'], content.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const key = VariantAnswerKey.safeParse(q.answer_key);
  if (!key.success) return bad(['answer_key'], key.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  if ('code' in (q.content as object)) bad(['content', 'code'], 'variants 문제는 content.code를 쓰지 않습니다(언어별 variants[lang].code만)');

  const c = content.data;
  const contentLangs = Object.keys(c.variants).sort();
  const keyLangs = Object.keys(key.data.variants).sort();
  if (contentLangs.join() !== keyLangs.join()) {
    return bad(['answer_key', 'variants'], `content.variants(${contentLangs.join(',')})와 answer_key.variants(${keyLangs.join(',')})의 언어가 같아야 합니다`);
  }
  for (const lang of contentLangs as CodingLanguage[]) {
    const v = c.variants[lang]!;
    if (v.code.language !== lang) bad(['content', 'variants', lang, 'code', 'language'], `variants.${lang}.code.language는 ${lang}이어야 합니다 (${v.code.language})`);
    const ak = VariantAnswerKeyByType[q.type].safeParse(key.data.variants[lang]);
    if (!ak.success) {
      bad(['answer_key', 'variants', lang], ak.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      continue;
    }
    if (q.type === 'fill') {
      if (!c.prompt.includes('___') && !v.code.source.includes('___')) bad(['content', 'variants', lang], `fill: 빈칸(___)이 prompt 또는 ${lang} 코드에 있어야 합니다`);
      const primary = (ak.data as z.infer<typeof FillAnswerKey>).accepted[0]!;
      if (!FILL_CODE_ANSWER.test(primary)) bad(['answer_key', 'variants', lang, 'accepted', 0], `주관식 대표 정답 "${primary}"에 한글·영문·숫자·밑줄 외 문자가 있습니다 — 객관식으로 바꾸세요`);
    }
    if (q.type === 'single') {
      const options = v.options ?? c.options;
      if (!options) bad(['content', 'variants', lang, 'options'], `single: ${lang} 보기가 없습니다(variants.${lang}.options 또는 content.options)`);
      else if ((ak.data as z.infer<typeof SingleAnswerKey>).index >= options.length) bad(['answer_key', 'variants', lang, 'index'], `index는 보기 개수 ${options.length}를 넘습니다`);
    }
  }
}

export const LessonFile = z.object({
  track: z.string(),
  unit: z.string(),
  lesson: z.string(),
  questions: z.array(QuestionFile).min(1).max(12),
});
export type LessonFile = z.infer<typeof LessonFile>;

// ---------- API에 노출되는 문제 (정답 없음) ----------
export const PublicQuestion = z.object({
  id: z.string().uuid(),
  type: QuestionType,
  content: z.unknown(),
  difficulty: z.number().int(),
  /** 언어별 variants 문제에서 이 content가 펼쳐진 언어. 답을 제출할 때 그대로 lang으로 보낸다. 일반 문제는 없음 */
  lang: CodingLanguage.optional(),
});
export type PublicQuestion = z.infer<typeof PublicQuestion>;
