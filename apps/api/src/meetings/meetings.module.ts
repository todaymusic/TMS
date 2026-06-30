import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChatModule } from '../chat/chat.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [AiModule, ChatModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
})
export class MeetingsModule {}
