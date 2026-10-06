import { AnswerKeyByType, UserAnswerByType, type QuestionType } from '@cs-daily/contracts';

/**
 * 유형별 채점 — 순수 함수 도메인 서비스. 정답 키는 이 서비스와 채점 리포지토리만 본다.
 * 새 유형을 추가하면 contracts의 스키마와 여기 switch를 함께 확장한다.
 */
export const normalizeText = (s: string): string =>
  s
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"`]/g, '');

export class Grader {
  /** 잘못된 형식의 답안은 예외 대신 오답(false)으로 처리한다 — 치팅 시도를 멈추지 않고 기록 */
  grade(type: QuestionType, answerKey: unknown, userAnswer: unknown): boolean {
    const key = AnswerKeyByType[type].safeParse(answerKey);
    if (!key.success) throw new Error(`정답 키가 ${type} 스키마와 맞지 않습니다`);
    const ans = UserAnswerByType[type].safeParse(userAnswer);
    if (!ans.success) return false;

    switch (type) {
      case 'single':
        return (ans.data as { index: number }).index === (key.data as { index: number }).index;
      case 'ox':
        return (ans.data as { value: boolean }).value === (key.data as { value: boolean }).value;
      case 'multi': {
        const a = new Set((ans.data as { indices: number[] }).indices);
        const k = new Set((key.data as { indices: number[] }).indices);
        return a.size === k.size && [...k].every((i) => a.has(i));
      }
      case 'fill': {
        const text = normalizeText((ans.data as { text: string }).text);
        if (!text) return false;
        return (key.data as { accepted: string[] }).accepted.some((acc) => normalizeText(acc) === text);
      }
    }
  }
}
