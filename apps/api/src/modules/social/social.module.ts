import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { FRIEND_HANDLERS } from './application/friend.handlers';
import { SOCIAL_REPO } from './domain/ports';
import { PrismaSocialRepository } from './infrastructure/prisma-social.repository';
import { FriendsController } from './presentation/friends.controller';

/** Social 컨텍스트: 친구 요청·관계, 차단, 닉네임 검색 */
@Module({
  imports: [IdentityModule],
  controllers: [FriendsController],
  providers: [PrismaSocialRepository, { provide: SOCIAL_REPO, useExisting: PrismaSocialRepository }, ...FRIEND_HANDLERS],
})
export class SocialModule {}
