import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// 한국시간(KST) 기준 "YYYY-MM"
function kstMonth(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * 월별 연차 자동적립.
 * - 매월 1일(KST) + 서버 부팅 시 실행, 같은 달 중복 적립 방지(lastLeaveAccrual).
 * - 최초 1회(lastLeaveAccrual=null)는 소급 지급 없이 기준선만 설정 → 다음 달부터 적립.
 * - 사람마다 monthlyLeaveGrant(월 적립 일수)로 차등 적립. 0이면 적립 안 함.
 */
@Injectable()
export class LeaveAccrualService implements OnModuleInit {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(private readonly prisma: PrismaService) {}

  async accrue(): Promise<{ month: string; granted: number; baselined: number }> {
    const month = kstMonth();
    const users = await this.prisma.user.findMany({
      select: { id: true, monthlyLeaveGrant: true, lastLeaveAccrual: true },
    });

    let granted = 0;
    let baselined = 0;
    for (const u of users) {
      if (u.lastLeaveAccrual === month) continue; // 이번 달 이미 처리됨

      if (u.lastLeaveAccrual == null) {
        // 최초 실행: 소급 지급 없이 기준선만 기록 (다음 달부터 적립 시작)
        await this.prisma.user.update({
          where: { id: u.id },
          data: { lastLeaveAccrual: month },
        });
        baselined++;
        continue;
      }

      // 지난 적립월 != 이번 달 → 이번 달 적립
      const doGrant = u.monthlyLeaveGrant > 0;
      await this.prisma.user.update({
        where: { id: u.id },
        data: {
          lastLeaveAccrual: month,
          ...(doGrant ? { leaveBalance: { increment: u.monthlyLeaveGrant } } : {}),
        },
      });
      if (doGrant) granted++;
    }
    return { month, granted, baselined };
  }

  // 매월 1일 00:05 (KST)
  @Cron('5 0 1 * *', { timeZone: 'Asia/Seoul' })
  async monthlyAccrual(): Promise<void> {
    const r = await this.accrue();
    this.logger.log(
      `월별 연차 적립(${r.month}): 지급 ${r.granted}명 / 기준선 ${r.baselined}명`,
    );
  }

  // 배포·재시작이 월 경계를 넘겼을 때 놓친 적립 보정
  async onModuleInit(): Promise<void> {
    try {
      const r = await this.accrue();
      this.logger.log(
        `부팅 연차 적립 점검(${r.month}): 지급 ${r.granted}명 / 기준선 ${r.baselined}명`,
      );
    } catch (e) {
      this.logger.error('부팅 연차 적립 실패', e as Error);
    }
  }
}
