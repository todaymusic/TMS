import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const peerSelect = {
  select: { id: true, name: true, avatarColor: true, dept: true },
} as const;

@Injectable()
export class DmService {
  constructor(private readonly prisma: PrismaService) {}

  send(fromId: string, toId: string, content: string) {
    return this.prisma.directMessage.create({
      data: { fromId, toId, content },
      include: { from: peerSelect, to: peerSelect },
    });
  }

  /** 두 사용자 간 대화(시간순) */
  conversation(userId: string, peerId: string) {
    return this.prisma.directMessage.findMany({
      where: {
        OR: [
          { fromId: userId, toId: peerId },
          { fromId: peerId, toId: userId },
        ],
      },
      include: { from: peerSelect },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** 상대(peer)→나 메시지 읽음 처리 */
  async markRead(userId: string, peerId: string) {
    await this.prisma.directMessage.updateMany({
      where: { fromId: peerId, toId: userId, read: false },
      data: { read: true },
    });
    return { ok: true };
  }

  /** 내 대화 목록: 상대별 마지막 메시지 + 안읽음 수 */
  async threads(userId: string) {
    const msgs = await this.prisma.directMessage.findMany({
      where: { OR: [{ fromId: userId }, { toId: userId }] },
      include: { from: peerSelect, to: peerSelect },
      orderBy: { createdAt: 'desc' },
    });

    const byPeer = new Map<
      string,
      {
        peer: { id: string; name: string; avatarColor: string; dept: string | null };
        lastContent: string;
        lastAt: Date;
        unread: number;
      }
    >();
    for (const m of msgs) {
      const peer = m.fromId === userId ? m.to : m.from;
      const existing = byPeer.get(peer.id);
      if (!existing) {
        byPeer.set(peer.id, {
          peer,
          lastContent: m.content,
          lastAt: m.createdAt,
          unread: 0,
        });
      }
      // 안읽음(상대→나, read=false) 카운트
      if (m.toId === userId && !m.read) {
        byPeer.get(peer.id)!.unread += 1;
      }
    }
    return [...byPeer.values()];
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.directMessage.count({
      where: { toId: userId, read: false },
    });
    return { count };
  }
}
