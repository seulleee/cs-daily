import { describe, expect, it } from 'vitest';
import { UserThrottlerGuard } from '../src/shared/presentation/user-throttler.guard';

describe('UserThrottlerGuard', () => {
  const tracker = (req: Record<string, unknown>) =>
    (UserThrottlerGuard.prototype as unknown as { getTracker(r: unknown): Promise<string> }).getTracker(req);
  it('req.user.id를 키로 쓴다', async () => {
    expect(await tracker({ user: { id: 'u1' }, ip: '1.1.1.1' })).toBe('u1');
  });
  it('사용자가 없으면 ip로 폴백', async () => {
    expect(await tracker({ ip: '1.1.1.1' })).toBe('1.1.1.1');
  });
});
