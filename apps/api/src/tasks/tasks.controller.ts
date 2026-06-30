import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { EndTaskDto } from './dto/end-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasks.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryTaskDto) {
    return this.tasks.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasks.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(id, dto);
  }

  // 내 활동 체크리스트: 시작
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.tasks.start(id);
  }

  // 잠시 중단 / 재개 (세션 시간 기록)
  @Post(':id/pause')
  pause(@Param('id') id: string) {
    return this.tasks.pause(id);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.tasks.resume(id);
  }

  // 내 활동 체크리스트: 종료(+산출물)
  @Post(':id/end')
  end(@Param('id') id: string, @Body() dto: EndTaskDto) {
    return this.tasks.end(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasks.remove(id);
  }
}
