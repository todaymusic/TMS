import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// 응답에서 비밀번호 해시 제외
const omitPassword = { password: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    // 초기 비밀번호가 오면 bcrypt 해시로 저장(평문 저장 금지)
    const { password, ...rest } = dto;
    const data = {
      ...rest,
      ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
    };
    try {
      return await this.prisma.user.create({ data, omit: omitPassword });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('이미 사용 중인 이메일입니다');
      }
      throw e;
    }
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { name: 'asc' },
      omit: omitPassword,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: omitPassword,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    // 수동 상태를 활동(업무중/자리비움/방해금지)으로 바꾸면 '퇴근(clockedOut)' 상태 해제
    const clearClockOut =
      dto.status !== undefined && dto.status !== 'off';
    // 비밀번호가 오면(마승일이 초기화) bcrypt 해시로 저장
    const { password, ...rest } = dto;
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...rest,
          ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
          ...(clearClockOut ? { clockedOut: false } : {}),
        },
        omit: omitPassword,
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('이미 사용 중인 이메일입니다');
      }
      throw e;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.user.delete({ where: { id }, omit: omitPassword });
    } catch (e) {
      // FK 제약(활동 이력 존재) → 하드 삭제 불가. 비활성화를 안내.
      if ((e as { code?: string }).code === 'P2003') {
        throw new BadRequestException(
          '이 계정은 업무·근태·메시지 등 활동 이력이 있어 삭제할 수 없습니다. 대신 "비활성화"로 로그인을 막아주세요.',
        );
      }
      throw e;
    }
  }
}
