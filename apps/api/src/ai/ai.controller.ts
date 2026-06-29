import { Body, Controller, Param, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AiService } from './ai.service';

class TaskDocDto {
  @IsString()
  memo!: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subCategory?: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  // 업무 부여 폼: 간략 메모 → 업무설명 doc
  @Post('task-doc')
  taskDoc(@Body() dto: TaskDocDto) {
    return this.ai.generateTaskDoc(dto);
  }

  // 프로젝트 상세: 대화 → AI 소통 요약 (저장 후 반환)
  @Post('project-summary/:id')
  projectSummary(@Param('id') id: string) {
    return this.ai.summarizeProject(id);
  }
}
