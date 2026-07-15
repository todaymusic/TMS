import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveStatus, LeaveType } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';

// 종류별 연차 차감(일): 연차 1 / 반차 0.5 / 반반차 0.25 / 병가·기타 0
const DEDUCT: Record<LeaveType, number> = {
  annual: 1,
  half: 0.5,
  quarter: 0.25,
  sick: 0,
  etc: 0,
  business_trip: 0,
};

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLeaveDto) {
    // 출장은 연차 차감이 없고 승인 절차 없이 바로 확정(자동 승인)
    const isTrip = dto.type === LeaveType.business_trip;
    return this.prisma.leave.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason,
        daypart: dto.daypart ?? null,
        status: isTrip ? LeaveStatus.approved : LeaveStatus.requested,
      },
    });
  }

  // 내용 수정(날짜·사유·반일). 종류/상태는 건드리지 않아 연차 차감에 영향 없음.
  async update(id: string, dto: UpdateLeaveDto) {
    const leave = await this.prisma.leave.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException(`Leave ${id} not found`);
    const dp =
      dto.daypart === undefined
        ? undefined
        : dto.daypart === 'am' || dto.daypart === 'pm'
          ? dto.daypart
          : null;
    return this.prisma.leave.update({
      where: { id },
      data: {
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        reason: dto.reason,
        daypart: dp,
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

    // 반려(미승인) → 근무 캘린더에 남기지 않도록 아예 삭제.
    // (승인됐던 건을 뒤늦게 반려하면 remove가 차감된 잔여 연차까지 복구)
    if (dto.status === LeaveStatus.rejected) {
      return this.remove(id);
    }

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

  // 승인된 휴가 취소 요청(본인) — 관리자 확인 대기
  async requestCancel(id: string) {
    const leave = await this.prisma.leave.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException(`Leave ${id} not found`);
    if (leave.status !== LeaveStatus.approved) {
      throw new BadRequestException('승인된 휴가만 취소 요청할 수 있습니다');
    }
    return this.prisma.leave.update({
      where: { id },
      data: { cancelRequested: true },
    });
  }

  // 취소 요청 거절(관리자) — 플래그 해제
  async denyCancel(id: string) {
    const leave = await this.prisma.leave.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException(`Leave ${id} not found`);
    return this.prisma.leave.update({
      where: { id },
      data: { cancelRequested: false },
    });
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
