/**
 * language가 json인 코드 빈칸 문제의 JSON 파싱 검사.
 * 빈칸(___)을 정답으로 채운 코드가 JSON.parse를 통과해야 한다.
 * - fill: answer_key.accepted[0]
 * - single: content.options[answer_key.index]
 * - 빈칸이 없으면 원문 그대로 검사한다.
 */
export function checkJsonCode(
  source: string,
  type: string,
  options: string[] | undefined,
  answerKey: unknown,
): string | null {
  let filled = source;
  if (source.includes('___')) {
    const key = (answerKey ?? {}) as { accepted?: string[]; index?: number };
    let answer: string | undefined;
    if (type === 'fill') answer = key.accepted?.[0];
    else if (type === 'single') answer = typeof key.index === 'number' ? options?.[key.index] : undefined;
    if (answer === undefined) return '정답을 찾을 수 없어 JSON 빈칸을 채울 수 없습니다';
    filled = source.split('___').join(answer);
  }
  try {
    JSON.parse(filled);
    return null;
  } catch (e) {
    return `정답을 채운 JSON 코드가 파싱되지 않습니다 — ${(e as Error).message}`;
  }
}
