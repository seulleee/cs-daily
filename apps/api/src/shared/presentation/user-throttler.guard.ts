import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** 레이트 리밋을 IP가 아니라 로그인 사용자 기준으로 센다. JwtAuthGuard 뒤에서 실행돼야 한다 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.id ?? req.ip;
  }
}
