import { IsISO8601, IsOptional, IsString } from 'class-validator';

// 휴가/출장 내용 수정(날짜·사유·반일). 종류/상태는 여기서 바꾸지 않음(연차 차감 영향 방지).
export class UpdateLeaveDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  daypart?: 'am' | 'pm' | null; // 종일 = null
}
