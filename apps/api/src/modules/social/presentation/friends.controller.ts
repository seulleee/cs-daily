import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { BlockRequest, SendFriendRequest, type FriendSearchResponse, type FriendsResponse } from '@cs-daily/contracts';
import { JwtAuthGuard } from '../../identity/presentation/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../../shared/presentation/current-user.decorator';
import { ZodBody } from '../../../shared/presentation/zod-body.pipe';
import {
  AcceptFriendRequestCommand,
  BlockUserCommand,
  CancelFriendRequestCommand,
  DeclineFriendRequestCommand,
  ListFriendsQuery,
  RemoveFriendCommand,
  SearchFriendsQuery,
  SendFriendRequestCommand,
  UnblockUserCommand,
} from '../application/commands';
import { SEARCH_MIN } from '../domain/friendship-rules';

const SearchQ = z.string().trim().min(SEARCH_MIN).max(30);

/** 컨트롤러는 DTO → 커맨드/쿼리 변환만 한다 */
@ApiTags('friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FriendsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('friends')
  list(@CurrentUser() user: AuthUser): Promise<FriendsResponse> {
    return this.queryBus.execute(new ListFriendsQuery(user.id, new Date()));
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('friends/search')
  search(@CurrentUser() user: AuthUser, @Query('q', new ZodBody(SearchQ)) q: string): Promise<FriendSearchResponse> {
    return this.queryBus.execute(new SearchFriendsQuery(user.id, q));
  }

  /** 차단·중복 등 어떤 경우에도 같은 202로 응답한다(한도만 409) */
  @Post('friends/requests')
  @HttpCode(202)
  async send(@CurrentUser() user: AuthUser, @Body(new ZodBody(SendFriendRequest)) body: SendFriendRequest) {
    await this.commandBus.execute(new SendFriendRequestCommand(user.id, body.userId));
    return { status: 'sent' as const };
  }

  @Post('friends/requests/:id/accept')
  @HttpCode(204)
  async accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.commandBus.execute(new AcceptFriendRequestCommand(user.id, id));
  }

  @Post('friends/requests/:id/decline')
  @HttpCode(204)
  async decline(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.commandBus.execute(new DeclineFriendRequestCommand(user.id, id));
  }

  @Delete('friends/requests/:id')
  @HttpCode(204)
  async cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.commandBus.execute(new CancelFriendRequestCommand(user.id, id));
  }

  @Delete('friends/:userId')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) friendId: string) {
    await this.commandBus.execute(new RemoveFriendCommand(user.id, friendId));
  }

  @Post('blocks')
  @HttpCode(204)
  async block(@CurrentUser() user: AuthUser, @Body(new ZodBody(BlockRequest)) body: BlockRequest) {
    await this.commandBus.execute(new BlockUserCommand(user.id, body.userId));
  }

  @Delete('blocks/:userId')
  @HttpCode(204)
  async unblock(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) targetId: string) {
    await this.commandBus.execute(new UnblockUserCommand(user.id, targetId));
  }
}
