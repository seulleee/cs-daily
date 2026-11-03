import { describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@cs-daily/contracts';
import { InvariantViolation, NotFoundError } from '../src/shared/domain/domain-error';
import type { UnitOfWork } from '../src/shared/infrastructure/unit-of-work';
import { DeleteAccountCommand, DeleteAccountHandler } from '../src/modules/identity/application/delete-account.handler';
import { nicknameMatches } from '../src/modules/identity/domain/services/account-deletion';

describe('nicknameMatches', () => {
  it('정확히 같으면 통과', () => expect(nicknameMatches('미리보기', '미리보기')).toBe(true));
  it('앞뒤 공백은 무시', () => expect(nicknameMatches('  미리보기 \n', '미리보기')).toBe(true));
  it('다르면 거부', () => expect(nicknameMatches('미리', '미리보기')).toBe(false));
  it('대소문자는 구분', () => expect(nicknameMatches('Alice', 'alice')).toBe(false));
  it('가운데 공백은 그대로 비교', () => expect(nicknameMatches('a b', 'ab')).toBe(false));
  it('빈 입력은 거부', () => expect(nicknameMatches('   ', '미리보기')).toBe(false));
});

function setup(user: { nickname: string } | null) {
  const findUnique = vi.fn(async () => user);
  const del = vi.fn(async () => ({}));
  const uow = { run: <T>(fn: () => Promise<T>) => fn(), client: { user: { findUnique, delete: del } } } as unknown as UnitOfWork;
  return { handler: new DeleteAccountHandler(uow), del };
}

describe('DeleteAccountHandler', () => {
  it('닉네임이 다르면 422(NICKNAME_MISMATCH)이고 지우지 않는다', async () => {
    const s = setup({ nickname: '미리보기' });
    const err = await s.handler.execute(new DeleteAccountCommand('u1', '틀린값')).catch((e) => e);
    expect(err).toBeInstanceOf(InvariantViolation);
    expect(err.code).toBe(ErrorCode.NICKNAME_MISMATCH);
    expect(s.del).not.toHaveBeenCalled();
  });
  it('일치하면 사용자 행을 지운다', async () => {
    const s = setup({ nickname: '미리보기' });
    await s.handler.execute(new DeleteAccountCommand('u1', ' 미리보기 '));
    expect(s.del).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
  it('이미 없는 사용자면 404', async () => {
    const s = setup(null);
    await expect(s.handler.execute(new DeleteAccountCommand('u1', 'x'))).rejects.toBeInstanceOf(NotFoundError);
    expect(s.del).not.toHaveBeenCalled();
  });
});
