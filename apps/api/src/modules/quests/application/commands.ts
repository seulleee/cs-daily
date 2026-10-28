export class EvaluateQuestsCommand {
  constructor(
    readonly userId: string,
    readonly at: Date,
  ) {}
}

export class GetMyQuestsQuery {
  constructor(
    readonly userId: string,
    readonly at: Date,
  ) {}
}

/** 월요일 배치: 최근 활동한 친구끼리 이번 주 짝을 짓는다 */
export class PairFriendQuestsCommand {
  constructor(readonly now: Date) {}
}
