import { CODING_LANGUAGES, DEFAULT_CODING_LANGUAGE, ErrorCode, hasVariants, type CodingLanguage } from '@cs-daily/contracts';
import { InvariantViolation } from '../../../../shared/domain/domain-error';

/**
 * 언어별 코드 문제(ct 트랙)의 순수 로직.
 *  - 콘텐츠: content.variants[lang] = { code, options? } / answer_key.variants[lang] = { 정답, explanation? }
 *  - 사용자에게는 자기 언어 variant만 content.code(+options)로 펼쳐 내려보낸다. 다른 언어와 정답은 내려가지 않는다.
 *  - 채점은 제출된 lang의 variant 정답으로 한다. 세션 도중 설정이 바뀌어도 받은 언어로 채점된다.
 */

export class CodeLanguageUnavailable extends InvariantViolation {
  constructor(reason: string) {
    super(ErrorCode.CODE_LANGUAGE_UNAVAILABLE, reason);
  }
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** variants가 있는(= 언어별로 코드가 다른) 문제인가 */
export function isVariantQuestion(content: unknown): boolean {
  return isRec(content) && hasVariants(content);
}

/** 문제 content에 실제로 들어 있는 variant 언어들 */
export function variantLanguages(content: unknown): CodingLanguage[] {
  if (!isVariantQuestion(content)) return [];
  const variants = (content as Rec).variants;
  if (!isRec(variants)) return [];
  return CODING_LANGUAGES.filter((l) => isRec(variants[l]));
}

/**
 * 사용자에게 내려보낼 content. variants가 없으면 그대로(lang=null).
 * 있으면 선호 언어 variant를 content.code(+options)로 펼치고 variants는 지운다.
 * 선호 언어 variant가 없으면(콘텐츠 누락) 기본 언어 → 있는 첫 언어 순으로 대체한다 — 이때 lang은 실제로 보낸 언어다.
 */
export function publicContentFor(content: unknown, preferred: CodingLanguage): { content: unknown; lang: CodingLanguage | null } {
  if (!isVariantQuestion(content)) return { content, lang: null };
  const langs = variantLanguages(content);
  const lang = langs.includes(preferred) ? preferred : langs.includes(DEFAULT_CODING_LANGUAGE) ? DEFAULT_CODING_LANGUAGE : langs[0];
  if (!lang) throw new Error('variants 문제에 사용할 수 있는 언어 variant가 없습니다');
  const { variants, options: sharedOptions, ...rest } = content as Rec;
  const v = (variants as Rec)[lang] as { code: unknown; options?: string[] };
  const options = v.options ?? sharedOptions;
  return { content: { ...rest, code: v.code, ...(options ? { options } : {}) }, lang };
}

export interface GradingKey {
  answerKey: unknown;
  explanation: string;
  /** variants 문제에서 채점에 쓴 언어. 일반 문제는 null */
  lang: CodingLanguage | null;
}

/**
 * 채점에 쓸 (평평한) 정답 키와 해설. variants 문제면 lang의 variant 정답을 꺼낸다.
 * 일반 문제는 lang을 무시한다. variants 문제인데 lang이 없거나 그 언어 variant가 없으면 CodeLanguageUnavailable.
 */
export function resolveGradingKey(answerKey: unknown, explanation: string, lang: CodingLanguage | undefined | null): GradingKey {
  if (!isRec(answerKey) || !hasVariants(answerKey)) return { answerKey, explanation, lang: null };
  if (!lang) throw new CodeLanguageUnavailable('언어별 코드 문제는 lang(풀이 언어)을 함께 제출해야 합니다');
  const variants = answerKey.variants;
  const v = isRec(variants) ? variants[lang] : undefined;
  if (!isRec(v)) throw new CodeLanguageUnavailable(`이 문제에는 ${lang} 버전이 없습니다`);
  const { explanation: own, ...key } = v;
  return { answerKey: key, explanation: typeof own === 'string' ? own : explanation, lang };
}

/** 채점한 언어를 답안 기록(userAnswer JSON)에 함께 남긴다 — 이어 풀기 때 같은 언어의 정답·해설을 보여 주려고 */
export function withLanguage(raw: unknown, lang: CodingLanguage | null): unknown {
  return lang && isRec(raw) ? { ...raw, lang } : raw;
}

/** 답안 기록에서 채점한 언어를 읽는다. 없으면 null */
export function languageOfRecordedAnswer(raw: unknown): CodingLanguage | null {
  const lang = isRec(raw) ? raw.lang : undefined;
  return CODING_LANGUAGES.find((l) => l === lang) ?? null;
}
