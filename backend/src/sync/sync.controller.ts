import { Controller, Post, Get, Delete, Body, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { SyncService } from './sync.service.js';

@Controller('api/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('upload')
  async uploadData(@Body() body: { data: any[], isAppend?: boolean }) {
    if (!body || !body.data) {
      throw new Error("Invalid payload: 'data' property is required.");
    }
    return this.syncService.saveData('historicalData', body.data, body.isAppend);
  }

  @Get('download')
  async downloadData() {
    return this.syncService.getData('historicalData');
  }

  @Get('metadata')
  async getMetadata() {
    return this.syncService.getMetadata('historicalData');
  }

  @Delete('clear')
  async clearData() {
    return this.syncService.clearData('historicalData');
  }
}
