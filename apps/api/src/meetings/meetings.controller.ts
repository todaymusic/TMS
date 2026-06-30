import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';
import { MeetingsService } from './meetings.service';

class CreateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsISO8601()
  date!: string;

  @IsOptional()
  @IsString()
  driveFileId?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  transcriptUrl?: string;

  @IsOptional()
  @IsString()
  transcriptText?: string;

  @IsOptional()
  @IsBoolean()
  announce?: boolean;

  @IsOptional()
  @IsString()
  authorId?: string;
}

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  findAll() {
    return this.meetings.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.meetings.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMeetingDto) {
    return this.meetings.create(dto);
  }

  @Post(':id/summarize')
  resummarize(@Param('id') id: string) {
    return this.meetings.resummarize(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.meetings.remove(id);
  }
}
