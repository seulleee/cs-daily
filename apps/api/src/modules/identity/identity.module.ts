import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { USER_PREFS_PORT } from '../learning/domain/ports';
import { ProgressionModule } from '../progression/progression.module';
import { AuthService } from './application/auth.service';
import { GithubOAuthStrategy, GoogleOAuthStrategy, JwtAccessStrategy } from './infrastructure/oauth.strategies';
import { UserPrefsAdapter } from './infrastructure/user-prefs.adapter';
import { AuthController } from './presentation/auth.controller';
import { JwtAuthGuard } from './presentation/jwt-auth.guard';
import { MeController } from './presentation/me.controller';
import { RolesGuard } from './presentation/roles.guard';

/** Identity 컨텍스트: 사용자·OAuth·JWT. 다른 컨텍스트에 JwtAuthGuard·RolesGuard·UserPrefsPort 제공 */
@Module({
  imports: [ConfigModule, PassportModule.register({ session: false }), JwtModule.register({}), ProgressionModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, GithubOAuthStrategy, GoogleOAuthStrategy, JwtAccessStrategy, JwtAuthGuard, RolesGuard, UserPrefsAdapter, { provide: USER_PREFS_PORT, useExisting: UserPrefsAdapter }],
  exports: [JwtAuthGuard, RolesGuard, USER_PREFS_PORT],
})
export class IdentityModule {}
