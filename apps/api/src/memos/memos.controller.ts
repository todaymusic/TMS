import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMemoDto, UpdateMemoDto } from './dto/memo.dto';
import { MemosService } from './memos.service';

type AuthedRequest = Request & { user?: { id: string } };

// 메모(스티커 노트) — 본인만 접근
@UseGuards(JwtAuthGuard)
@Controller('memos')
export class MemosController {
  constructor(private readonly memos: MemosService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.memos.list(req.user!.id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateMemoDto) {
    return this.memos.create(req.user!.id, dto.color);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateMemoDto,
  ) {
    return this.memos.update(req.user!.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.memos.remove(req.user!.id, id);
  }
}
