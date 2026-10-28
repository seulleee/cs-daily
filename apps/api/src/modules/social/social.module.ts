import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { FRIEND_HANDLERS } from './application/friend.handlers';
import { FRIENDS_PORT } from '../quests/domain/ports';
import { SOCIAL_REPO } from './domain/ports';
import { FriendsAdapter } from './infrastructure/friends.adapter';
import { PrismaSocialRepository } from './infrastructure/prisma-social.repository';
import { FriendsController } from './presentation/friends.controller';

/** Social 컨텍스트: 친구 요청·관계, 차단, 닉네임 검색 */
@Module({
  imports: [IdentityModule],
  controllers: [FriendsController],
  providers: [
    PrismaSocialRepository,
    { provide: SOCIAL_REPO, useExisting: PrismaSocialRepository },
    FriendsAdapter,
    { provide: FRIENDS_PORT, useExisting: FriendsAdapter },
    ...FRIEND_HANDLERS,
  ],
  exports: [FRIENDS_PORT],
})
export class SocialModule {}
