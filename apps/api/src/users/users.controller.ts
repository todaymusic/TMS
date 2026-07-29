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
import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

class SetEmployeeCodeDto {
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : (value as string),
  )
  @Matches(/^[A-Z0-9]{6,12}$/, {
    message: 'employeeCode must be 6-12 uppercase letters/digits',
  })
  employeeCode!: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get()
  findAll() {
    return this.users.findAll();
  }

  // 전 멤버 사원번호(로그인 코드) — 관리자 전용 (일반 응답에는 코드 미포함)
  @UseGuards(JwtAuthGuard)
  @Get('codes')
  listCodes(@Req() req: Request & { user?: { id: string } }) {
    return this.users.listCodes(req.user!.id);
  }

  // 사원번호 기입/변경 — 관리자 전용
  @UseGuards(JwtAuthGuard)
  @Patch(':id/code')
  setCode(
    @Req() req: Request & { user?: { id: string } },
    @Param('id') id: string,
    @Body() dto: SetEmployeeCodeDto,
  ) {
    return this.users.setEmployeeCode(req.user!.id, id, dto.employeeCode);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
