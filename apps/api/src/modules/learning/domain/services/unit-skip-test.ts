/**
 * 유닛 건너뛰기 테스트 정책 (듀오링고 "여기로 점프").
 * - 출제: 유닛의 각 레슨에서 뒤쪽(난이도가 높은) 문제부터 번갈아 뽑아 최대 SIZE개
 * - 통과: 정답률 PASS_PERCENT 이상 → 트랙 처음부터 이 유닛까지의 레슨을 모두 완료 처리
 * - XP·데일리 목표에는 반영하지 않는다 (반복 응시로 XP를 쌓는 것을 막기 위해)
 */
const SIZE = 8;
const PASS_PERCENT = 80;

export const UnitSkipTest = {
  SIZE,
  PASS_PERCENT,

  /** @param perLesson 레슨 순서대로, 각 레슨의 published 문제 id (sort_order 오름차순) */
  pickQuestions(perLesson: readonly (readonly string[])[], size: number = SIZE): string[] {
    const queues = perLesson.map((ids) => [...ids].reverse());
    const picked: string[] = [];
    while (picked.length < size && queues.some((q) => q.length > 0)) {
      for (const q of queues) {
        const id = q.shift();
        if (id !== undefined && !picked.includes(id)) picked.push(id);
        if (picked.length >= size) break;
      }
    }
    return picked;
  },

  passed(correct: number, total: number): boolean {
    return total > 0 && correct * 100 >= total * PASS_PERCENT;
  },
};
