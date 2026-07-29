import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// employeeCode(로그인 코드)는 일반 PATCH로 변경 불가 — 관리자 전용 PATCH /users/:id/code 사용
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['employeeCode'] as const),
) {}
