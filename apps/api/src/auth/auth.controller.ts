import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

class SetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(4)
  newPassword!: string;
}

class MemoDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  memo?: string;
}

class SwitchAppDto {
  @IsString()
  app!: string; // "tms" | "hellotms"
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  // 최초 비밀번호 설정(비번 없는 사용자만)
  @Post('set-password')
  setPassword(@Body() dto: SetPasswordDto) {
    return this.auth.setInitialPassword(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user?: { id: string } }) {
    return this.auth.me(req.user!.id);
  }

  // 대표 계정 전환(마승일 ↔ 신선중) — 비번 없이, 대표만
  @UseGuards(JwtAuthGuard)
  @Post('switch-app')
  switchApp(
    @Req() req: Request & { user?: { id: string } },
    @Body() dto: SwitchAppDto,
  ) {
    return this.auth.switchApp(req.user!.id, dto.app);
  }

  // 접속 중 하트비트(현황판 온라인 판정)
  @UseGuards(JwtAuthGuard)
  @Post('heartbeat')
  heartbeat(@Req() req: Request & { user?: { id: string } }) {
    return this.auth.heartbeat(req.user!.id);
  }

  // 업무 종료(퇴근)
  @UseGuards(JwtAuthGuard)
  @Post('clock-out')
  clockOut(@Req() req: Request & { user?: { id: string } }) {
    return this.auth.clockOut(req.user!.id);
  }

  // 내 활동 개인 메모(포스트잇) — 자동저장·서버 보관
  @UseGuards(JwtAuthGuard)
  @Get('memo')
  getMemo(@Req() req: Request & { user?: { id: string } }) {
    return this.auth.getMemo(req.user!.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('memo')
  setMemo(
    @Req() req: Request & { user?: { id: string } },
    @Body() dto: MemoDto,
  ) {
    return this.auth.setMemo(req.user!.id, dto.memo ?? '');
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Req() req: Request & { user?: { id: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      req.user!.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
