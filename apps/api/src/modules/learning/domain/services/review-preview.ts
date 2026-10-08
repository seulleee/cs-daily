import { addDaysToLocalDate, zonedMidnightToUtc } from '../../../../shared/domain/local-date';

/**
 * 레슨 결과 화면의 "내일 복습 예정 N문제" 정책.
 *
 * - 집계 기준(cutoff): 사용자 로컬 "내일"의 마지막 순간. dueAt <= cutoff 인 복습 항목을 센다.
 *   SM-2는 방금 푼 문제(오답, 처음 푼 정답)를 `답한 시각 + 24시간`으로 예약한다. 오늘 어느 시각에 풀었든
 *   그 시각은 내일 안에 들어오지만, "내일 00:00"까지로 끊으면 내일 낮의 due를 모두 놓쳐 0이 된다.
 * - 하한(count): 복습 예약은 AnswerGraded 이벤트가 비동기로 처리해 완료 시점에 아직 저장 전일 수 있다.
 *   이번 세션에서 틀린 문제는 SM-2 품질 0이라 반드시 내일 due가 되므로 그 수를 하한으로 둔다.
 */
export const ReviewPreview = {
  /** @param localDate 사용자 로컬 "오늘"(YYYY-MM-DD) */
  cutoff(localDate: string, timeZone: string): Date {
    const dayAfterTomorrowStart = zonedMidnightToUtc(addDaysToLocalDate(localDate, 2), timeZone);
    return new Date(dayAfterTomorrowStart.getTime() - 1);
  },

  /**
   * @param dueByCutoff DB에 저장된, cutoff까지 due인 복습 항목 수
   * @param wrongInSession 이번 세션에서 첫 답이 오답인 문제 수 (저장 여부와 무관하게 확정된 내일 due)
   */
  count(dueByCutoff: number, wrongInSession: number): number {
    return Math.max(dueByCutoff, wrongInSession);
  },
};
