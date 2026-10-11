import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesRecord } from './entities/sync.entity.js';
import { TargetSetting } from './entities/target.entity.js';
import { DeadStockRecord } from './entities/deadstock.entity.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SalesRecord, TargetSetting, DeadStockRecord])],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
