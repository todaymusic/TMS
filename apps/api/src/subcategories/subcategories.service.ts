import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// hellotms 대시보드 소분류(업무 영역) 관리.
// 저장값은 문자열 그대로 Task.subCategory 에 들어가므로 기존 한글 값과 자연 호환.
// 삭제/이름 변경해도 이미 만들어진 업무의 subCategory 문자열은 바뀌지 않는다.
const DEFAULT_SUBCATS = [
  '미정',
  '디자인',
  '개발',
  '마케팅',
  '기획',
  '지점업무',
  '교육',
  '운영',
  '인사·총무',
];

@Injectable()
export class SubcategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAdmin(requesterId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { isAdmin: true },
    });
    if (!me?.isAdmin) throw new ForbiddenException('Admin only');
  }

  /** 목록 — 비어 있으면 기본값 시드(1회) */
  async list() {
    const count = await this.prisma.subcategory.count();
    if (count === 0) {
      await this.prisma.subcategory.createMany({
        data: DEFAULT_SUBCATS.map((name, i) => ({ name, sortOrder: i })),
        skipDuplicates: true,
      });
    }
    return this.prisma.subcategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(requesterId: string, name: string) {
    await this.assertAdmin(requesterId);
    const trimmed = name.trim();
    const max = await this.prisma.subcategory.aggregate({
      _max: { sortOrder: true },
    });
    try {
      return await this.prisma.subcategory.create({
        data: { name: trimmed, sortOrder: (max._max.sortOrder ?? 0) + 1 },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Subcategory already exists');
      }
      throw e;
    }
  }

  async rename(requesterId: string, id: string, name: string) {
    await this.assertAdmin(requesterId);
    const found = await this.prisma.subcategory.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Subcategory not found');
    try {
      return await this.prisma.subcategory.update({
        where: { id },
        data: { name: name.trim() },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Subcategory already exists');
      }
      throw e;
    }
  }

  async remove(requesterId: string, id: string) {
    await this.assertAdmin(requesterId);
    const found = await this.prisma.subcategory.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Subcategory not found');
    await this.prisma.subcategory.delete({ where: { id } });
    return { ok: true };
  }
}
