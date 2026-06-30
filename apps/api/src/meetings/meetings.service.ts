import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ChatService } from '../chat/chat.service';

function driveLink(fileId?: string | null) {
  return fileId ? `https://drive.google.com/file/d/${fileId}/view` : null;
}

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly chat: ChatService,
  ) {}

  findAll() {
    return this.prisma.meeting.findMany({ orderBy: { date: 'desc' } });
  }

  async findOne(id: string) {
    const m = await this.prisma.meeting.findUnique({ where: { id } });
    if (!m) throw new NotFoundException(`Meeting ${id} not found`);
    return m;
  }

  async create(dto: {
    title?: string;
    date: string;
    driveFileId?: string;
    videoUrl?: string;
    transcriptUrl?: string;
    transcriptText?: string;
    announce?: boolean;
    authorId?: string;
  }) {
    let title = dto.title?.trim() || '';
    let summary: string | null = null;

    // 트랜스크립트가 있으면 AI로 제목(없을 때)·개요 생성
    if (dto.transcriptText?.trim()) {
      try {
        const r = await this.ai.meetingSummary(dto.transcriptText);
        summary = r.summary;
        if (!title) title = r.title;
      } catch {
        /* AI 실패해도 회의는 생성 */
      }
    }
    if (!title) title = '회의';

    const meeting = await this.prisma.meeting.create({
      data: {
        title,
        date: new Date(dto.date),
        driveFileId: dto.driveFileId,
        videoUrl: dto.videoUrl,
        transcriptUrl: dto.transcriptUrl,
        transcriptText: dto.transcriptText,
        summary,
      },
    });

    // 전체공지에 자동 공지(드라이브 링크 포함)
    if (dto.announce !== false && dto.authorId) {
      await this.announce(meeting.id, dto.authorId);
    }
    return meeting;
  }

  /** 트랜스크립트 재요약 */
  async resummarize(id: string) {
    const m = await this.findOne(id);
    if (!m.transcriptText) {
      return m;
    }
    const r = await this.ai.meetingSummary(m.transcriptText);
    return this.prisma.meeting.update({
      where: { id },
      data: { title: r.title, summary: r.summary },
    });
  }

  /** 전체공지 채널에 회의 공지 메시지 게시 */
  async announce(id: string, authorId: string) {
    const m = await this.findOne(id);
    const ch = await this.chat.ensureBroadcast();
    const link = m.videoUrl || m.transcriptUrl || driveLink(m.driveFileId);
    const content =
      `📹 [회의] ${m.title}\n` +
      (link ? `🔗 영상·트랜스크립트: ${link}` : '') +
      (m.summary ? `\n\n${m.summary.slice(0, 300)}` : '');
    await this.chat.send(ch.id, authorId, content);
    return { ok: true };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.meeting.delete({ where: { id } });
  }
}
