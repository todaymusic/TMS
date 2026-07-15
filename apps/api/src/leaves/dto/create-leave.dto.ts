import { IsEnum, IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { LeaveType } from '../../../generated/prisma/enums';

export class CreateLeaveDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsEnum(LeaveType)
  type?: LeaveType;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsIn(['am', 'pm'])
  daypart?: 'am' | 'pm'; // 반일 출장 오전/오후 (없으면 종일)
}
