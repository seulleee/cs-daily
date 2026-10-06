import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** JWT 액세스 토큰 검증. 실패 시 401 → DomainExceptionFilter가 UNAUTHORIZED로 매핑 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
