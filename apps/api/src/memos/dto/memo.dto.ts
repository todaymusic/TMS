import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const MEMO_COLORS = [
  'yellow',
  'green',
  'blue',
  'pink',
  'purple',
  'gray',
] as const;

export class CreateMemoDto {
  @IsOptional()
  @IsIn(MEMO_COLORS)
  color?: string;
}

export class UpdateMemoDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @IsOptional()
  @IsIn(MEMO_COLORS)
  color?: string;
}
