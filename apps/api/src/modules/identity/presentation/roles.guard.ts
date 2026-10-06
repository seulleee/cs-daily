import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@cs-daily/contracts';
import { ForbiddenError } from '../../../shared/domain/domain-error';
import type { AuthUser } from '../../../shared/presentation/current-user.decorator';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<'user' | 'admin'>) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Array<'user' | 'admin'> | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || !required.includes(user.role)) throw new ForbiddenError(ErrorCode.FORBIDDEN, '권한이 없습니다');
    return true;
  }
}
