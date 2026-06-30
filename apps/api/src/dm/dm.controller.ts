import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { IsString } from 'class-validator';
import { DmService } from './dm.service';

class SendDmDto {
  @IsString()
  fromId!: string;

  @IsString()
  toId!: string;

  @IsString()
  content!: string;
}

@Controller('dm')
export class DmController {
  constructor(private readonly dm: DmService) {}

  @Post()
  send(@Body() dto: SendDmDto) {
    return this.dm.send(dto.fromId, dto.toId, dto.content);
  }

  // GET /api/dm/conversation?userId=&peerId=
  @Get('conversation')
  conversation(
    @Query('userId') userId: string,
    @Query('peerId') peerId: string,
  ) {
    return this.dm.conversation(userId, peerId);
  }

  // GET /api/dm/threads?userId=
  @Get('threads')
  threads(@Query('userId') userId: string) {
    return this.dm.threads(userId);
  }

  // GET /api/dm/unread?userId=
  @Get('unread')
  unread(@Query('userId') userId: string) {
    return this.dm.unreadCount(userId);
  }

  // PATCH /api/dm/read?userId=&peerId=
  @Patch('read')
  markRead(@Query('userId') userId: string, @Query('peerId') peerId: string) {
    return this.dm.markRead(userId, peerId);
  }
}
