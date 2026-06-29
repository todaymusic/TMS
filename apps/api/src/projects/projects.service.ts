import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { ProjectRole } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AddOwnerDto, AddParticipantDto } from './dto/member.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const memberSelect = {
  user: { select: { id: true, name: true, avatarColor: true, dept: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProjectDto) {
    const { startDate, endDate, links, ...rest } = dto;
    return this.prisma.project.create({
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        links: links as unknown as Prisma.InputJsonValue,
      },
    });
  }

  findAll() {
    return this.prisma.project.findMany({
      include: {
        owners: { include: memberSelect },
        participants: { include: memberSelect },
        _count: { select: { tasks: true, messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owners: { include: memberSelect },
        participants: { include: memberSelect },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, avatarColor: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.ensureExists(id);
    const { startDate, endDate, links, ...rest } = dto;
    return this.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined
          ? { startDate: startDate ? new Date(startDate) : null }
          : {}),
        ...(endDate !== undefined
          ? { endDate: endDate ? new Date(endDate) : null }
          : {}),
        ...(links !== undefined
          ? { links: links as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.project.delete({ where: { id } });
  }

  // ───────── 담당자(owner) ─────────
  async addOwner(projectId: string, dto: AddOwnerDto) {
    await this.ensureExists(projectId);
    return this.prisma.projectOwner.upsert({
      where: { projectId_userId: { projectId, userId: dto.userId } },
      create: {
        projectId,
        userId: dto.userId,
        role: dto.role ?? ProjectRole.etc,
      },
      update: { role: dto.role ?? ProjectRole.etc },
      include: memberSelect,
    });
  }

  async removeOwner(projectId: string, userId: string) {
    await this.ensureExists(projectId);
    return this.prisma.projectOwner.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  // ───────── 참여자(participant) ─────────
  async addParticipant(projectId: string, dto: AddParticipantDto) {
    await this.ensureExists(projectId);
    return this.prisma.projectParticipant.upsert({
      where: { projectId_userId: { projectId, userId: dto.userId } },
      create: { projectId, userId: dto.userId },
      update: {},
      include: memberSelect,
    });
  }

  async removeParticipant(projectId: string, userId: string) {
    await this.ensureExists(projectId);
    return this.prisma.projectParticipant.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Project ${id} not found`);
  }
}
