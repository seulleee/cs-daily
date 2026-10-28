import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { afterAll, describe, expect, it } from 'vitest';
import { FriendsController } from '../src/modules/social/presentation/friends.controller';
import { IpThrottlerGuard, USER_SEARCH_THROTTLER, UserThrottlerGuard } from '../src/shared/presentation/user-throttler.guard';

// app.module.ts의 ThrottlerModule.forRoot와 같은 설정
const options: ThrottlerModuleOptions = [
  { name: 'default', ttl: 60_000, limit: 120 },
  { name: USER_SEARCH_THROTTLER, ttl: 60_000, limit: 30 },
];

const ctxFor = (handler: (...a: any[]) => unknown, cls: new (...a: any[]) => unknown, req: Record<string, unknown>) => {
  const res = { header: () => undefined };
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as never;
};
const search = (userId: string) => ctxFor(FriendsController.prototype.search, FriendsController, { ip: '10.0.0.1', headers: {}, user: { id: userId } });
const list = (userId: string) => ctxFor(FriendsController.prototype.list, FriendsController, { ip: '10.0.0.1', headers: {}, user: { id: userId } });

async function build<T extends IpThrottlerGuard | UserThrottlerGuard>(G: new (...a: any[]) => T, storage: ThrottlerStorageService): Promise<T> {
  const g = new G(options, storage, new Reflector());
  await g.onModuleInit();
  return g;
}

describe('검색 레이트 리밋', () => {
  const storage = new ThrottlerStorageService();
  afterAll(() => storage.onApplicationShutdown());

  it('(a) 전역 IP 가드는 같은 IP의 서로 다른 사용자 31번째 요청도 막지 않는다', async () => {
    const ipGuard = await build(IpThrottlerGuard, storage);
    for (let i = 0; i < 40; i++) expect(await ipGuard.canActivate(search(`user-${i}`))).toBe(true);
  });

  it('(b) UserThrottlerGuard는 같은 사용자의 31번째 요청을 막고 다른 사용자는 허용한다', async () => {
    const userGuard = await build(UserThrottlerGuard, storage);
    for (let i = 0; i < 30; i++) expect(await userGuard.canActivate(search('same-user'))).toBe(true);
    await expect(userGuard.canActivate(search('same-user'))).rejects.toMatchObject({ status: 429 });
    expect(await userGuard.canActivate(search('other-user'))).toBe(true);
  });

  it('다른 라우트에는 전역 가드의 default(120)만 적용된다', async () => {
    const ipGuard = await build(IpThrottlerGuard, storage);
    for (let i = 0; i < 120; i++) expect(await ipGuard.canActivate(list('u'))).toBe(true);
    await expect(ipGuard.canActivate(list('u'))).rejects.toMatchObject({ status: 429 });
  });

  it('getTracker는 req.user.id, 없으면 ip', async () => {
    const t = (req: Record<string, unknown>) => (UserThrottlerGuard.prototype as unknown as { getTracker(r: unknown): Promise<string> }).getTracker(req);
    expect(await t({ user: { id: 'u1' }, ip: '1.1.1.1' })).toBe('u1');
    expect(await t({ ip: '1.1.1.1' })).toBe('1.1.1.1');
  });
});
