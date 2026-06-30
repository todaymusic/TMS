import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { EndTaskDto } from './dto/end-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const taskInclude = {
  assigner: { select: { id: true, name: true, avatarColor: true } },
  assignee: { select: { id: true, name: true, avatarColor: true } },
  project: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTaskDto) {
    const { dueDate, ...rest } = dto;
    return this.prisma.task.create({
      data: {
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
      include: taskInclude,
    });
  }

  findAll(query: QueryTaskDto) {
    return this.prisma.task.findMany({
      where: {
        assigneeId: query.assigneeId,
        assignerId: query.assignerId,
        projectId: query.projectId,
        category: query.category,
        status: query.status,
      },
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { ...taskInclude, workLogs: true },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async update(id: string, dto: UpdateTaskDto) {
    await this.findOne(id);
    const { dueDate, plannedDate, ...rest } = dto;
    return this.prisma.task.update({
      where: { id },
      data: {
        ...rest,
        ...(dueDate !== undefined
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
        ...(plannedDate !== undefined
          ? { plannedDate: plannedDate ? new Date(plannedDate) : null }
          : {}),
      },
      include: taskInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.task.delete({ where: { id } });
  }

  /**
   * 업무 시작 — 내 활동 체크리스트 체크 시.
   * startedAt 기록, status=doing, 열린 WorkLog 생성(대시보드/근무로그 연동).
   */
  async start(id: string) {
    const task = await this.findOne(id);
    if (!task.assigneeId)
      throw new BadRequestException('수행자(assignee)가 지정되지 않은 업무는 시작할 수 없습니다');

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id },
        data: {
          status: TaskStatus.doing,
          startedAt: task.startedAt ?? now,
        },
        include: taskInclude,
      }),
      this.prisma.workLog.create({
        data: { userId: task.assigneeId, taskId: id, startedAt: now },
      }),
    ]);
    return updated;
  }

  /**
   * 업무 종료 — 체크리스트 종료 시.
   * endedAt 기록, progress=100, status=done, 산출물 링크 저장, 열린 WorkLog 닫기.
   */
  async end(id: string, dto: EndTaskDto) {
    const task = await this.findOne(id);
    const now = new Date();

    await this.prisma.workLog.updateMany({
      where: { taskId: id, endedAt: null },
      data: { endedAt: now, note: dto.note },
    });

    return this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.done,
        endedAt: now,
        progress: 100,
        ...(dto.reportLink !== undefined ? { reportLink: dto.reportLink } : {}),
        ...(dto.videoLink !== undefined ? { videoLink: dto.videoLink } : {}),
      },
      include: taskInclude,
    });
  }
}
