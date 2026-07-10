import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserStatus } from '../../../generated/prisma/enums';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  dept?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsHexColor()
  avatarColor?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  statusMessage?: string;

  @IsOptional()
  @IsString()
  workStart?: string;

  @IsOptional()
  @IsString()
  workEnd?: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @IsOptional()
  @IsString()
  app?: string; // 소속 앱: "tms" | "hellotms"

  @IsOptional()
  @IsString()
  password?: string; // 초기 비밀번호(계정 생성 시) / 비밀번호 초기화 — 서비스에서 bcrypt 해시

  @IsOptional()
  @IsNumber()
  leaveBalance?: number;

  @IsOptional()
  @IsNumber()
  monthlyLeaveGrant?: number;
}
