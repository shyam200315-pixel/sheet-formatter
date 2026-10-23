import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SyncModule } from './sync/sync.module.js';
import { SalesRecord } from './sync/entities/sync.entity.js';
import { TargetSetting } from './sync/entities/target.entity.js';
import { DeadStockRecord } from './sync/entities/deadstock.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const dbType = configService.get<string>('DB_TYPE', databaseUrl ? 'postgres' : 'sqlite');
        const isSsl = configService.get<string>('DB_SSL') === 'true' || !!databaseUrl;
        
        if (dbType === 'postgres' || databaseUrl) {
          if (databaseUrl) {
            return {
              type: 'postgres',
              url: databaseUrl,
              ssl: isSsl ? { rejectUnauthorized: false } : false,
              entities: [SalesRecord, TargetSetting, DeadStockRecord],
              synchronize: true,
            } as unknown as TypeOrmModuleOptions;
          }

          return {
            type: 'postgres',
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 5432),
            username: configService.get<string>('DB_USERNAME', 'postgres'),
            password: configService.get<string>('DB_PASSWORD', 'password'),
            database: configService.get<string>('DB_NAME', 'sheet_formatter'),
            ssl: isSsl ? { rejectUnauthorized: false } : false,
            entities: [SalesRecord, TargetSetting, DeadStockRecord],
            synchronize: true,
          } as unknown as TypeOrmModuleOptions;
        }
        
        // Default to local SQLite for easy development
        return {
          type: 'better-sqlite3',
          database: 'local-db.sqlite',
          entities: [SalesRecord, TargetSetting, DeadStockRecord],
          synchronize: true,
        } as unknown as TypeOrmModuleOptions;
      },
      inject: [ConfigService],
    }),
    SyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
