import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMemoDto } from './dto/memo.dto';

@Injectable()
export class MemosService {
  constructor(private readonly prisma: PrismaService) {}

  /** 내 메모 목록 — 최근 수정 순.
   *  주의: 구 TMS 포스트잇(User.scratchMemo)과 완전히 독립 — 절대 읽거나 수정하지 않는다. */
  list(userId: string) {
    return this.prisma.memo.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(userId: string, color?: string) {
    return this.prisma.memo.create({
      data: { userId, color: color ?? 'yellow' },
    });
  }

  /** 본인 메모만 접근 가능 */
  private async ownMemo(userId: string, id: string) {
    const memo = await this.prisma.memo.findUnique({ where: { id } });
    if (!memo || memo.userId !== userId) {
      throw new NotFoundException('Memo not found');
    }
    return memo;
  }

  async update(userId: string, id: string, dto: UpdateMemoDto) {
    await this.ownMemo(userId, id);
    return this.prisma.memo.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.ownMemo(userId, id);
    await this.prisma.memo.delete({ where: { id } });
    return { ok: true };
  }
}
