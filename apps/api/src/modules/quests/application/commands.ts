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
