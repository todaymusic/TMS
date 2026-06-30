import { Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus, LeaveType } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';

// 종류별 연차 차감(일): 연차 1 / 반차 0.5 / 반반차 0.25 / 병가·기타 0
const DEDUCT: Record<LeaveType, number> = {
  annual: 1,
  half: 0.5,
  quarter: 0.25,
  sick: 0,
  etc: 0,
};

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLeaveDto) {
    return this.prisma.leave.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason,
        status: LeaveStatus.requested,
      },
    });
  }

  findAll(filters: { userId?: string; status?: LeaveStatus }) {
    return this.prisma.leave.findMany({
      where: { userId: filters.userId, status: filters.status },
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async updateStatus(id: string, dto: UpdateLeaveStatusDto) {
    const leave = await this.prisma.leave.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException(`Leave ${id} not found`);

    // requested → approved 전이 시에만 연차 잔여 차감(중복 방지)
    const willDeduct =
      dto.status === LeaveStatus.approved &&
      leave.status !== LeaveStatus.approved &&
      DEDUCT[leave.type] > 0;

    const updateLeave = this.prisma.leave.update({
      where: { id },
      data: { status: dto.status },
    });

    if (!willDeduct) return updateLeave;

    const [updated] = await this.prisma.$transaction([
      updateLeave,
      this.prisma.user.update({
        where: { id: leave.userId },
        data: { leaveBalance: { decrement: DEDUCT[leave.type] } },
      }),
    ]);
    return updated;
  }

  async remove(id: string) {
    const leave = await this.prisma.leave.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException(`Leave ${id} not found`);

    // 승인됐던 휴가 취소 → 차감됐던 연차 복구
    const restore =
      leave.status === LeaveStatus.approved && DEDUCT[leave.type] > 0;
    if (!restore) {
      return this.prisma.leave.delete({ where: { id } });
    }
    const [, deleted] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: leave.userId },
        data: { leaveBalance: { increment: DEDUCT[leave.type] } },
      }),
      this.prisma.leave.delete({ where: { id } }),
    ]);
    return deleted;
  }
}
