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

const CodeBlock = z
  .object({
    language: z.string().min(1).max(32),
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
export const FillContent = z.object({
  /** 빈칸은 ___ (언더스코어 3개)로 표시 */
  prompt: z.string().min(1).max(300).refine((s) => s.includes('___'), '빈칸(___)이 있어야 합니다'),
  code: CodeBlock,
  hint: z.string().max(120).optional(),
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
});
export type PublicQuestion = z.infer<typeof PublicQuestion>;
