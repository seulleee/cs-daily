import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ErrorCode } from '@cs-daily/contracts';
import { InvariantViolation, NotFoundError } from '../../../shared/domain/domain-error';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { nicknameMatches } from '../domain/services/account-deletion';

export class DeleteAccountCommand {
  constructor(readonly userId: string, readonly nickname: string) {}
}

/**
 * 계정 삭제. 사용자 관련 FK는 모두 onDelete: Cascade라 users 행 하나를 지우면
 * 로그인 연결·토큰·학습 기록·XP·복습·퀘스트·친구·차단·친구 퀘스트 멤버가 함께 지워진다.
 */
@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler implements ICommandHandler<DeleteAccountCommand, void> {
  constructor(private readonly uow: UnitOfWork) {}

  async execute({ userId, nickname }: DeleteAccountCommand): Promise<void> {
    await this.uow.run(async () => {
      const db = this.uow.client;
      const user = await db.user.findUnique({ where: { id: userId }, select: { nickname: true } });
      if (!user) throw new NotFoundError(ErrorCode.NOT_FOUND, '계정을 찾을 수 없어요');
      if (!nicknameMatches(nickname, user.nickname)) throw new InvariantViolation(ErrorCode.NICKNAME_MISMATCH, '닉네임이 맞지 않아요');
      await db.user.delete({ where: { id: userId } });
    });
  }
}
