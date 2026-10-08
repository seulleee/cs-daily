/** `dueAt <= until`인 복습 항목 수. 지금 당장 due 수는 until=now, 결과 화면의 "내일 예정"은 내일 끝 시각을 넘긴다. */
export class CountDueReviewsQuery {
  constructor(
    readonly userId: string,
    readonly until: Date,
  ) {}
}

export class GetReviewDueQuery {
  constructor(
    readonly userId: string,
    readonly now: Date,
  ) {}
}
