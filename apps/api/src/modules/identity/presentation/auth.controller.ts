import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, type OAuthProfile, type TokenPair } from '../application/auth.service';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../../shared/presentation/auth-cookies';

/**
 * OAuth 로그인 흐름:
 *   GET /auth/github → GitHub 동의 화면 → GET /auth/github/callback → 쿠키 발급 → 웹으로 리다이렉트
 * 쿠키: HttpOnly; Secure(prod); SameSite=Lax. Next.js가 /api/*를 리라이트하므로 same-site로 동작한다.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('github')
  @UseGuards(AuthGuard('github'))
  github() {}

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    return this.finish(req.user as OAuthProfile, res);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  google() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.finish(req.user as OAuthProfile, res);
  }

  /** 액세스 토큰 만료 시 프런트가 호출. 리프레시 쿠키를 회전한다 */
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const pair = await this.auth.rotate(req.cookies?.[REFRESH_COOKIE]);
    if (!pair) {
      this.clear(res);
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '다시 로그인해 주세요' } });
    }
    this.setCookies(res, pair);
    return res.status(204).send();
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    await this.auth.revoke(req.cookies?.[REFRESH_COOKIE]);
    this.clear(res);
    return res.status(204).send();
  }

  private async finish(profile: OAuthProfile, res: Response) {
    const { userId, isNew } = await this.auth.signInWithOAuth(profile);
    const pair = await this.auth.issueTokens(userId);
    this.setCookies(res, pair);
    const web = this.config.getOrThrow<string>('WEB_BASE_URL');
    return res.redirect(isNew ? `${web}/onboarding` : `${web}/learn`);
  }

  private setCookies(res: Response, pair: TokenPair) {
    const secure = this.config.get('NODE_ENV') === 'production';
    const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
    res.cookie(ACCESS_COOKIE, pair.accessToken, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, pair.refreshToken, { ...base, expires: pair.refreshExpiresAt }); // path '/' — Next.js middleware가 세션 존재를 판단할 수 있게
  }

  private clear(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }
}
