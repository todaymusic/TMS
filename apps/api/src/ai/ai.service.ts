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
