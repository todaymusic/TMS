import { Module } from '@nestjs/common';
import { LeaveAccrualService } from './leave-accrual.service';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';

@Module({
  controllers: [LeavesController],
  providers: [LeavesService, LeaveAccrualService],
  exports: [LeavesService],
})
export class LeavesModule {}
