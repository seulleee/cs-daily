import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** ThrottlerModule.forRoot에 등록하는 사용자별 한도 이름(닉네임 검색 분당 30회) */
export const USER_SEARCH_THROTTLER = 'userSearch';

/**
 * 사용자(JWT) 기준으로 `userSearch` 한도만 센다. JwtAuthGuard 뒤에서 실행돼야 한다.
 * 라우트에 이 가드를 직접 걸어 쓰며, 전역 가드(IpThrottlerGuard)는 이 한도를 건너뛴다.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter((t) => t.name === USER_SEARCH_THROTTLER);
  }

  protected override async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.id ?? req.ip;
  }
}

/** 전역(APP_GUARD) IP 기준 가드. 사용자별 한도(`userSearch`)는 UserThrottlerGuard가 따로 세므로 제외한다 */
@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter((t) => t.name !== USER_SEARCH_THROTTLER);
  }
}
