import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GithubStrategy, type Profile as GithubProfile } from 'passport-github2';
import { Strategy as GoogleStrategy, type Profile as GoogleProfile } from 'passport-google-oauth20';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import type { Request } from 'express';
import type { OAuthProfile } from '../domain/oauth-profile';
import { ACCESS_COOKIE } from '../../../shared/presentation/auth-cookies';
import type { AuthUser } from '../../../shared/presentation/current-user.decorator';

@Injectable()
export class GithubOAuthStrategy extends PassportStrategy(GithubStrategy, 'github') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('GITHUB_CLIENT_ID', 'unset'),
      clientSecret: config.get('GITHUB_CLIENT_SECRET', 'unset'),
      callbackURL: `${config.getOrThrow('API_BASE_URL')}/auth/github/callback`,
      scope: ['user:email'],
    });
  }
  validate(_at: string, _rt: string, profile: GithubProfile): OAuthProfile {
    const email = profile.emails?.find((e) => (e as { primary?: boolean }).primary)?.value ?? profile.emails?.[0]?.value;
    if (!email) throw new Error('GitHub 계정에 공개 이메일이 없습니다');
    return { provider: 'github', providerUserId: profile.id, email, displayName: profile.username ?? profile.displayName, avatarUrl: profile.photos?.[0]?.value };
  }
}

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(GoogleStrategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID', 'unset'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET', 'unset'),
      callbackURL: `${config.getOrThrow('API_BASE_URL')}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }
  validate(_at: string, _rt: string, profile: GoogleProfile): OAuthProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new Error('Google 계정 이메일을 읽을 수 없습니다');
    return { provider: 'google', providerUserId: profile.id, email, displayName: profile.displayName, avatarUrl: profile.photos?.[0]?.value };
  }
}

/** 액세스 토큰: HttpOnly 쿠키 우선, 없으면 Authorization: Bearer (모바일 앱 확장 대비) */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(JwtStrategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(req: Request) => req.cookies?.[ACCESS_COOKIE] ?? null, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      secretOrKey: config.getOrThrow('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }
  validate(payload: { sub: string; role: 'user' | 'admin' }): AuthUser {
    return { id: payload.sub, role: payload.role };
  }
}
