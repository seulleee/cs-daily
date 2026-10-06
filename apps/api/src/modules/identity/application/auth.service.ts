import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';

import type { OAuthProfile } from '../domain/oauth-profile';
export type { OAuthProfile };

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/**
 * Identity 애플리케이션 서비스. OAuth 프로필 → 사용자 생성/연결 → JWT 발급.
 * 리프레시 토큰은 해시만 저장(유출 시 재사용 불가), 회전(rotation) 방식.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signInWithOAuth(profile: OAuthProfile): Promise<{ userId: string; isNew: boolean }> {
    const email = profile.email.trim().toLowerCase();
    return this.uow.run(async () => {
      const db = this.uow.client;
      const linked = await db.oAuthAccount.findUnique({
        where: { provider_providerUserId: { provider: profile.provider, providerUserId: profile.providerUserId } },
        select: { userId: true },
      });
      if (linked) return { userId: linked.userId, isNew: false };

      // 같은 이메일의 기존 사용자가 있으면 계정 연결, 없으면 생성
      let user = await db.user.findUnique({ where: { email }, select: { id: true } });
      let isNew = false;
      if (!user) {
        user = await db.user.create({
          data: { email, nickname: await this.uniqueNickname(profile.displayName ?? email.split('@')[0] ?? 'learner'), avatarUrl: profile.avatarUrl ?? null, stats: { create: {} } },
          select: { id: true },
        });
        isNew = true;
      }
      await db.oAuthAccount.create({ data: { userId: user.id, provider: profile.provider, providerUserId: profile.providerUserId } });
      return { userId: user.id, isNew };
    });
  }

  async issueTokens(userId: string): Promise<TokenPair> {
    const user = await this.uow.client.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, role: true } });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') },
    );
    const raw = randomBytes(48).toString('base64url');
    const ttlDays = Number.parseInt(this.config.get('JWT_REFRESH_TTL', '14d'), 10) || 14;
    const refreshExpiresAt = new Date(Date.now() + ttlDays * 86_400_000);
    await this.uow.client.refreshToken.create({ data: { userId: user.id, tokenHash: hash(raw), expiresAt: refreshExpiresAt } });
    return { accessToken, refreshToken: raw, refreshExpiresAt };
  }

  /** 리프레시 토큰 회전: 기존 토큰 폐기 + 새 쌍 발급. 폐기된 토큰 재사용은 거부 */
  async rotate(rawRefresh: string): Promise<TokenPair | null> {
    const row = await this.uow.client.refreshToken.findUnique({ where: { tokenHash: hash(rawRefresh) } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) return null;
    await this.uow.client.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(row.userId);
  }

  async revoke(rawRefresh: string | undefined): Promise<void> {
    if (!rawRefresh) return;
    await this.uow.client.refreshToken.updateMany({ where: { tokenHash: hash(rawRefresh), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async uniqueNickname(base: string): Promise<string> {
    const clean = base.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24) || 'learner';
    for (let i = 0; i < 20; i += 1) {
      const candidate = i === 0 ? clean : `${clean}${Math.floor(Math.random() * 9000 + 1000)}`;
      const taken = await this.uow.client.user.findUnique({ where: { nickname: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${clean}-${randomBytes(3).toString('hex')}`;
  }
}

function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
