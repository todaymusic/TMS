import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsOptional()
  @IsString()
  reportLink?: string;

  @IsOptional()
  @IsString()
  videoLink?: string;

  @IsOptional()
  @IsString()
  workflowLink?: string;
}
