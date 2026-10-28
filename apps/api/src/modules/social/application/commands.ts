export class SendFriendRequestCommand {
  constructor(readonly me: string, readonly targetId: string) {}
}
export class AcceptFriendRequestCommand {
  constructor(readonly me: string, readonly requestId: string) {}
}
export class DeclineFriendRequestCommand {
  constructor(readonly me: string, readonly requestId: string) {}
}
export class CancelFriendRequestCommand {
  constructor(readonly me: string, readonly requestId: string) {}
}
export class RemoveFriendCommand {
  constructor(readonly me: string, readonly friendId: string) {}
}
export class BlockUserCommand {
  constructor(readonly me: string, readonly targetId: string) {}
}
export class UnblockUserCommand {
  constructor(readonly me: string, readonly targetId: string) {}
}
export class ListFriendsQuery {
  constructor(readonly me: string, readonly at: Date) {}
}
export class SearchFriendsQuery {
  constructor(readonly me: string, readonly q: string) {}
}
