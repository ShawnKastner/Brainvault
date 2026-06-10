import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './assets/entities/asset.entity';
import { AssetPreviewService } from './assets/preview/asset-preview.service';
import { GotenbergClientService } from './assets/preview/gotenberg-client.service';
import { PreviewQueueModule } from './assets/preview/preview-queue.module';
import { PreviewProcessor } from './assets/preview/preview.processor';
import { appConfig } from './config/app.config';
import { validateEnvironment } from './config/env.validation';
import { databaseConfig } from './database/database.config';
import { DatabaseModule } from './database/database.module';
import { WorkerHealthController } from './worker-health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([Asset]),
    PreviewQueueModule,
  ],
  controllers: [WorkerHealthController],
  providers: [AssetPreviewService, GotenbergClientService, PreviewProcessor],
})
export class PreviewWorkerModule {}
