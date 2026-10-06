import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** JwtAuthGuard가 request.user에 넣는 최소 주체 정보 */
export interface AuthUser {
  id: string;
  role: 'user' | 'admin';
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
