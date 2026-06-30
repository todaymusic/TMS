import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// 업무설명 doc 생성·대화 요약 용도 — 비용/속도 균형으로 Sonnet 사용(필요 시 opus-4-8로 상향)
const MODEL = 'claude-sonnet-4-6';

const DEFAULT_DOC_PROMPT = `당신은 업무 정의 어시스턴트입니다. 아래 간략 메모를 바탕으로 담당자가 바로 이해하고 착수할 수 있는 업무설명 문서를 한국어로 작성하세요.
출력 형식(마크다운):
1) 배경/목적
2) 목표(완료 기준)
3) 작업 범위
4) 요구 산출물
5) 체크포인트/마감
간결하고 실무적으로 작성하고, 메모에 없는 사실을 지어내지 마세요.`;

@Injectable()
export class AiService {
  private readonly client: Anthropic | null;

  constructor(private readonly prisma: PrismaService) {
    // ANTHROPIC_API_KEY 가 있을 때만 클라이언트 생성
    this.client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic()
      : null;
  }

  private ensureClient(): Anthropic {
    if (!this.client) {
      throw new BadRequestException(
        'ANTHROPIC_API_KEY 가 설정되지 않았습니다 (Railway 환경변수에 추가하세요)',
      );
    }
    return this.client;
  }

  private textOf(msg: Anthropic.Message): string {
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }

  /** 간략 메모 → 정돈된 업무설명 doc (마크다운) */
  async generateTaskDoc(input: {
    memo: string;
    prompt?: string;
    title?: string;
    category?: string;
    subCategory?: string;
  }): Promise<{ doc: string }> {
    if (!input.memo?.trim()) {
      throw new BadRequestException('상세 설명(메모)이 비어 있습니다');
    }
    const client = this.ensureClient();
    const context = [
      input.title ? `제목: ${input.title}` : null,
      input.category ? `대분류: ${input.category}` : null,
      input.subCategory ? `업무영역: ${input.subCategory}` : null,
      '',
      '간략 메모:',
      input.memo.trim(),
    ]
      .filter((l) => l !== null)
      .join('\n');

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: input.prompt?.trim() || DEFAULT_DOC_PROMPT,
      messages: [{ role: 'user', content: context }],
    });
    return { doc: this.textOf(msg) };
  }

  /** 회의 트랜스크립트 → 간결한 제목(2단어 정도) + 회의 개요(마크다운) */
  async meetingSummary(transcript: string): Promise<{ title: string; summary: string }> {
    if (!transcript?.trim()) {
      throw new BadRequestException('트랜스크립트가 비어 있습니다');
    }
    const client = this.ensureClient();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 3500,
      system:
        '회의 트랜스크립트를 한국어로 정리하는 어시스턴트입니다. ' +
        '(1) title: 회의에서 실제 논의된 **핵심 키워드(주제) 1~3개**를 뽑아 그 주제들이 드러나는 간결한 제목을 만드세요. ' +
        '예: 콘텐츠와 솔루션을 논의 → "콘텐츠 & 솔루션 회의", 블로그 키워드 교육 → "블로그 키워드 교육". ' +
        '회사명·인사말·잡담이 아니라 **실제 안건/주제 중심**으로. "오늘은뮤직 회의" 처럼 회사명만 들어간 밋밋한 제목은 금지. ' +
        '내용이 적어도 최대한 핵심 단어를 뽑아 제목을 만들고, 정말 인사·테스트뿐이라 주제가 없으면 "(날짜) 회의" 형태로. "회의 내용 없음/미확인" 같은 표현은 제목으로 쓰지 마세요. ' +
        '(2) summary: 마크다운으로 핵심 안건 / 주요 결정 / 액션아이템(담당·기한 있으면 포함)을 항목별로 정리. ' +
        '트랜스크립트에 없는 내용은 지어내지 마세요.',
      messages: [
        { role: 'user', content: `다음 회의 트랜스크립트를 정리해 주세요.\n\n${transcript.slice(0, 30000)}` },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '2~3단어 간결한 제목' },
              summary: { type: 'string', description: '마크다운 회의 개요' },
            },
            required: ['title', 'summary'],
            additionalProperties: false,
          },
        },
      },
    });
    const json = this.textOf(msg);
    try {
      return JSON.parse(json) as { title: string; summary: string };
    } catch {
      throw new BadRequestException('AI 응답을 파싱하지 못했습니다');
    }
  }

  /** 완료 검수 평가 — 업무설명 대비 제출(노트·보고·진행률)이 충실한지 → 평가 + 등급추천 */
  async evaluateTaskCompletion(input: {
    title: string;
    description?: string | null;
    aiDescriptionDoc?: string | null;
    statusMemo?: string | null;
    reportLink?: string | null;
    videoLink?: string | null;
    progress: number;
  }): Promise<{ evaluation: string; grade: string }> {
    const client = this.ensureClient();
    const body = [
      `업무: ${input.title}`,
      `업무 설명(요구사항): ${(input.aiDescriptionDoc || input.description || '없음').slice(0, 1500)}`,
      `담당자 진행 메모: ${input.statusMemo || '없음'}`,
      `제출 산출물: ${input.reportLink || input.videoLink || '없음'}`,
      `담당자 설정 진행률: ${input.progress}%`,
    ].join('\n');

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system:
        '당신은 업무 검수자입니다. 업무 요구사항(설명) 대비 담당자가 제출한 결과(진행 메모·산출물·진행률)가 얼마나 충실히 완료됐는지 평가하세요. ' +
        '(1) evaluation: 한국어 2~4문장 평가 — 잘된 점, 부족한 점, 요구사항 충족 여부, 재작업 필요 여부 의견. ' +
        '(2) grade: "우수"(요구 충족+완성도 높음) / "양호"(대체로 충족) / "보완"(부족, 재작업 권장) 중 하나 추천.',
      messages: [{ role: 'user', content: body }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              evaluation: { type: 'string' },
              grade: { type: 'string', enum: ['우수', '양호', '보완'] },
            },
            required: ['evaluation', 'grade'],
            additionalProperties: false,
          },
        },
      },
    });
    try {
      return JSON.parse(this.textOf(msg)) as { evaluation: string; grade: string };
    } catch {
      throw new BadRequestException('AI 응답 파싱 실패');
    }
  }

  /** 데일리 평가 — 업무설명 ↔ 노트/보고 ↔ 진행률% 일치도 한줄평 */
  async dailyReview(userId: string, date: string) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const select = {
      title: true,
      description: true,
      aiDescriptionDoc: true,
      statusMemo: true,
      reportLink: true,
      videoLink: true,
      progress: true,
      status: true,
    } as const;

    let tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        OR: [
          { plannedDate: { gte: d, lt: next } },
          { startedAt: { gte: d, lt: next } },
          { dueDate: { gte: d, lt: next } },
        ],
      },
      select,
    });
    // 폴백: 오늘 날짜 업무가 없으면 진행중/완료 등 활동 업무로 평가
    if (tasks.length === 0) {
      tasks = await this.prisma.task.findMany({
        where: { assigneeId: userId, status: { not: 'todo' } },
        select,
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });
    }
    if (tasks.length === 0) {
      throw new BadRequestException('평가할 업무가 없습니다');
    }

    const client = this.ensureClient();
    const body = tasks
      .map((t, i) =>
        [
          `[${i + 1}] ${t.title} (상태 ${t.status}, 진행률 ${t.progress}%)`,
          `  업무설명: ${(t.aiDescriptionDoc || t.description || '없음').slice(0, 400)}`,
          `  진행메모: ${t.statusMemo || '없음'}`,
          `  보고/산출물: ${t.reportLink || t.videoLink || '없음'}`,
        ].join('\n'),
      )
      .join('\n\n');

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system:
        '당신은 팀 리더의 시각으로 하루 업무를 평가하는 어시스턴트입니다. 각 업무의 (1)업무설명 (2)진행메모/보고 내용 (3)본인이 설정한 진행률%이 서로 얼마나 일치·적절한지 보고, 과대평가/근거부족/잘 맞음 등을 짚어 한국어로 2~3문장의 데일리 한줄평을 작성하세요. 칭찬과 개선점을 균형있게, 구체적으로. 데이터에 없는 사실은 지어내지 마세요.',
      messages: [
        { role: 'user', content: `오늘 업무 내역입니다. 평가해 주세요.\n\n${body}` },
      ],
    });
    return { review: this.textOf(msg) };
  }

  /** 프로젝트 대화 → AI 소통 요약(핵심결정/진행/미결), Project.aiSummary 에 저장 */
  async summarizeProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const messages = await this.prisma.message.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    if (messages.length === 0) {
      throw new BadRequestException('요약할 대화가 없습니다');
    }

    const client = this.ensureClient();
    const transcript = [...messages]
      .reverse()
      .map((m) => `${m.user.name}: ${m.content}`)
      .join('\n');

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system:
        '프로젝트 협업 대화를 한국어로 요약하는 어시스턴트입니다. 핵심 결정사항, 진행 상황, 미결 이슈/액션아이템을 항목별로 정리하세요. 대화에 없는 내용을 지어내지 마세요.',
      messages: [
        {
          role: 'user',
          content: `다음은 «${project.name}» 프로젝트의 최근 대화입니다. 요약해 주세요.\n\n${transcript}`,
        },
      ],
      // 구조화 출력 — 항상 파싱 가능한 JSON 보장
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              decisions: {
                type: 'array',
                items: { type: 'string' },
                description: '핵심 결정사항',
              },
              progress: {
                type: 'array',
                items: { type: 'string' },
                description: '진행 상황',
              },
              open: {
                type: 'array',
                items: { type: 'string' },
                description: '미결 이슈 / 액션아이템',
              },
            },
            required: ['decisions', 'progress', 'open'],
            additionalProperties: false,
          },
        },
      },
    });

    const json = this.textOf(msg);
    let summary: unknown;
    try {
      summary = JSON.parse(json);
    } catch {
      throw new BadRequestException('AI 응답을 파싱하지 못했습니다');
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        aiSummary: {
          ...(summary as object),
          generatedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
      select: { aiSummary: true },
    });
    return updated.aiSummary;
  }
}
