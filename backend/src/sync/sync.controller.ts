import { Controller, Post, Get, Delete, Body, Param, UseInterceptors, Sse, MessageEvent } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { SyncService } from './sync.service.js';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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

  @Delete('file/:fileId')
  async deleteFile(@Param('fileId') fileId: string) {
    return this.syncService.deleteFile('historicalData', decodeURIComponent(fileId));
  }

  @Delete('date/:date')
  async deleteByDate(@Param('date') date: string) {
    return this.syncService.deleteByDate('historicalData', date);
  }

  @Sse('updates')
  streamUpdates(): Observable<MessageEvent> {
    return this.syncService.updates$.asObservable().pipe(
      map(() => ({ data: { type: 'update' } } as MessageEvent))
    );
  }
}
