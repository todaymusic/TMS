import { Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';

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
    await this.ensureExists(id);
    return this.prisma.leave.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.leave.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.leave.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Leave ${id} not found`);
  }
}
