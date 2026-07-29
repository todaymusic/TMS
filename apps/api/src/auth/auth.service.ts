import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sanitize<
    T extends { password?: string | null; employeeCode?: string | null },
  >(user: T) {
    // 비밀번호 해시 + 사원번호(로그인 코드)는 응답에서 항상 제외
    const { password: _pw, employeeCode: _code, ...rest } = user;
    void _pw;
    void _code;
    return rest;
  }

  // ── 사원번호 로그인 레이트리밋(인메모리): IP당 10분 내 실패 10회 제한 ──
  private codeAttempts = new Map<string, { count: number; resetAt: number }>();

  private checkRateLimit(ip: string) {
    const now = Date.now();
    const a = this.codeAttempts.get(ip);
    if (a && now < a.resetAt && a.count >= 10) {
      throw new HttpException(
        'Too many attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private noteFailedAttempt(ip: string) {
    const now = Date.now();
    const a = this.codeAttempts.get(ip);
    if (!a || now >= a.resetAt) {
      this.codeAttempts.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    } else {
      a.count += 1;
    }
  }

  // ── 사원번호 부트스트랩(터미널 없이) ──
  // Railway 환경변수 BOOTSTRAP_SECRET 설정 시에만 활성화.
  // 브라우저로 GET /api/auth/bootstrap-codes?key=<secret> 열면
  // 코드 없는 전 유저에게 자동 발급 후 전체 표를 HTML로 보여준다.
  // 사용 후 Railway에서 BOOTSTRAP_SECRET을 삭제하면 이 페이지는 즉시 비활성화된다.
  private genCode(): string {
    // 혼동 문자(I, L, O, 0, 1) 제외 — 웹 lib/employeeCode.ts와 동일 규칙
    const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const DIGITS = '23456789';
    const ALL = LETTERS + DIGITS;
    const pick = (pool: string) =>
      pool[Math.floor(Math.random() * pool.length)];
    let code = pick(LETTERS) + pick(DIGITS);
    for (let i = 0; i < 6; i++) code += pick(ALL);
    return code;
  }

  async bootstrapCodes(key: string, ip: string): Promise<string> {
    const secret = process.env.BOOTSTRAP_SECRET;
    // 비활성 상태에서는 존재 자체를 숨김
    if (!secret) throw new NotFoundException();
    this.checkRateLimit(ip);
    if (!key || key !== secret) {
      this.noteFailedAttempt(ip);
      throw new ForbiddenException('Invalid key');
    }
    this.codeAttempts.delete(ip);

    const users = await this.prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, isAdmin: true, employeeCode: true },
    });
    const rows: { name: string; email: string; admin: boolean; code: string; fresh: boolean }[] = [];
    for (const u of users) {
      let code = u.employeeCode;
      let fresh = false;
      if (!code) {
        // 유니크 충돌 시 재시도
        for (let attempt = 0; attempt < 5 && !code; attempt++) {
          const c = this.genCode();
          try {
            await this.prisma.user.update({
              where: { id: u.id },
              data: { employeeCode: c },
            });
            code = c;
            fresh = true;
          } catch {
            /* retry */
          }
        }
      }
      rows.push({
        name: u.name,
        email: u.email,
        admin: u.isAdmin,
        code: code ?? '(failed — reload)',
        fresh,
      });
    }

    const esc = (v: string) =>
      v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tr = rows
      .map(
        (r) =>
          `<tr><td>${r.admin ? '👑' : ''}</td><td>${esc(r.name)}</td>` +
          `<td class="code">${esc(r.code)}</td><td class="dim">${esc(r.email)}</td>` +
          `<td class="dim">${r.fresh ? 'new' : ''}</td></tr>`,
      )
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Employee Codes</title>
<style>
  body{font-family:-apple-system,'Pretendard',system-ui,sans-serif;padding:28px;max-width:760px;margin:0 auto;color:#1b1c22}
  h2{margin:0 0 6px}
  p{color:#6c685f;font-size:13.5px;line-height:1.7;margin:4px 0}
  table{border-collapse:collapse;margin-top:16px;width:100%}
  th,td{border:1px solid #e6e3da;padding:9px 12px;font-size:14px;text-align:left}
  th{background:#faf9f6;font-size:12px;color:#6c685f}
  .code{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;letter-spacing:2px}
  .dim{color:#9a958a;font-size:12px}
  .warn{margin-top:18px;padding:12px 14px;background:#fef3c7;border-radius:10px;font-size:13px}
</style></head><body>
<h2>🔑 Employee Codes</h2>
<p>Each code is a login key — send it to each person <b>privately</b> (no group chats).</p>
<table><tr><th></th><th>Name</th><th>Code</th><th>Email</th><th></th></tr>${tr}</table>
<div class="warn">⚠️ Done copying? Delete the <b>BOOTSTRAP_SECRET</b> variable in Railway to disable this page.
Codes can be viewed/changed later in Settings → Members (admin, 👑).</div>
</body></html>`;
  }

  /** 사원번호(코드) 로그인 — 코드 하나로 로그인. 실패 사유는 노출하지 않음 */
  async loginWithCode(codeRaw: string, ip: string) {
    this.checkRateLimit(ip);
    const code = codeRaw.trim().toUpperCase();
    const user = code
      ? await this.prisma.user.findUnique({ where: { employeeCode: code } })
      : null;
    if (!user) {
      this.noteFailedAttempt(ip);
      throw new UnauthorizedException('Invalid employee code');
    }
    // 구 TMS의 계정 비활성화(로그인 차단)는 사원번호 로그인에도 동일하게 적용
    if (user.disabled) {
      throw new UnauthorizedException('비활성화된 계정입니다. 관리자에게 문의하세요.');
    }
    this.codeAttempts.delete(ip);
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    // 로그인 = 새 근무 세션 시작: 접속 갱신 + 퇴근 상태 해제
    const fresh = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), clockedOut: false },
    });
    return { accessToken: token, user: this.sanitize(fresh) };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }
    if (user.disabled) {
      throw new UnauthorizedException('비활성화된 계정입니다. 관리자에게 문의하세요.');
    }
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    // 로그인 = 새 근무 세션 시작: 접속 갱신 + 퇴근 상태 해제
    const fresh = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), clockedOut: false },
    });
    return { accessToken: token, user: this.sanitize(fresh) };
  }

  // 두 앱을 오가는 대표 계정(이름 기준). tms=마승일, hellotms=신선중
  private readonly SUPER_ADMINS = ['마승일', '신선중'];

  // 대표 계정 간 전환(비번 없이) — 마승일 ↔ 신선중. 요청자도 대표여야 함.
  async switchApp(requesterId: string, toApp: string) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });
    if (!requester || !this.SUPER_ADMINS.includes(requester.name)) {
      throw new ForbiddenException('앱 전환 권한이 없습니다');
    }
    // 대상 앱의 대표 계정 찾기(대표 이름 중 app이 일치하는 계정)
    const target = await this.prisma.user.findFirst({
      where: { name: { in: this.SUPER_ADMINS }, app: toApp },
    });
    if (!target) {
      throw new NotFoundException(`'${toApp}' 앱의 대표 계정을 찾을 수 없습니다`);
    }
    const token = await this.jwt.signAsync({
      sub: target.id,
      email: target.email,
    });
    const fresh = await this.prisma.user.update({
      where: { id: target.id },
      data: { lastSeenAt: new Date(), clockedOut: false },
    });
    return { accessToken: token, user: this.sanitize(fresh) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    return this.sanitize(user);
  }

  /** 하트비트 — 접속 중임을 알림(현황판 온라인 판정용) */
  async heartbeat(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  /** 업무 종료(퇴근) — 현황판에 '업무 종료'로 표시 */
  async clockOut(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { clockedOut: true, lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  /** 비밀번호 변경 — 현재 비밀번호 검증 후 교체 (로그인 사용자) */
  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    if (!user.password) {
      throw new BadRequestException('비밀번호가 설정되어 있지 않습니다');
    }
    const ok = await bcrypt.compare(current, user.password);
    if (!ok) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다');
    }
    const hash = await bcrypt.hash(next, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
    return { ok: true };
  }

  /**
   * 최초 비밀번호 설정 — 비밀번호가 아직 없는(null) 사용자만 허용.
   * 초기 팀원 비번 세팅 후 자동으로 닫힘(이미 설정된 사용자는 403).
   */
  async setInitialPassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    if (user.password) {
      throw new ForbiddenException(
        '이미 비밀번호가 설정된 사용자입니다 (변경은 로그인 후)',
      );
    }
    const hash = await bcrypt.hash(password, 10);
    const updated = await this.prisma.user.update({
      where: { email },
      data: { password: hash },
    });
    return { ok: true, user: this.sanitize(updated) };
  }

  /** 내 활동 개인 메모(포스트잇) 조회 — 본인 것만 */
  async getMemo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { scratchMemo: true },
    });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    return { memo: user.scratchMemo ?? '' };
  }

  /** 내 활동 개인 메모 저장 — 자동저장(디바운스)에서 호출 */
  async setMemo(userId: string, memo: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { scratchMemo: memo },
    });
    return { ok: true };
  }
}
