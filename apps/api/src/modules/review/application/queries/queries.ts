export class CountDueReviewsQuery {
  constructor(
    readonly userId: string,
    readonly now: Date,
  ) {}
}

export class GetReviewDueQuery {
  constructor(
    readonly userId: string,
    readonly now: Date,
  ) {}
}
