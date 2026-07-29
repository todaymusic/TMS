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
import { SubcategoryNameDto } from './dto/subcategory.dto';
import { SubcategoriesService } from './subcategories.service';

type AuthedRequest = Request & { user?: { id: string } };

// 소분류(업무 영역) — 조회는 로그인 사용자 누구나, 변경은 관리자만
@UseGuards(JwtAuthGuard)
@Controller('subcategories')
export class SubcategoriesController {
  constructor(private readonly subcats: SubcategoriesService) {}

  @Get()
  list() {
    return this.subcats.list();
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: SubcategoryNameDto) {
    return this.subcats.create(req.user!.id, dto.name);
  }

  @Patch(':id')
  rename(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: SubcategoryNameDto,
  ) {
    return this.subcats.rename(req.user!.id, id, dto.name);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.subcats.remove(req.user!.id, id);
  }
}
