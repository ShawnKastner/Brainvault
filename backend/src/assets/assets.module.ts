import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { Asset } from './entities/asset.entity';
import { AssetPreviewService } from './preview/asset-preview.service';
import { PreviewQueueModule } from './preview/preview-queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset]),
    PreviewQueueModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: Math.max(
            config.get<number>('app.maxImageUploadBytes', 5 * 1024 * 1024),
            config.get<number>('app.maxPdfUploadBytes', 25 * 1024 * 1024),
          ),
        },
      }),
    }),
  ],
  controllers: [AssetsController],
  providers: [AssetsService, AssetPreviewService],
  exports: [AssetsService],
})
export class AssetsModule {}
