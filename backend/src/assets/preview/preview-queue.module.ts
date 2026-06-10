import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ASSET_PREVIEW_QUEUE } from './preview.constants';
import { PreviewQueueService } from './preview-queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('app.redisHost', 'localhost'),
          port: config.get<number>('app.redisPort', 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: ASSET_PREVIEW_QUEUE }),
  ],
  providers: [PreviewQueueService],
  exports: [BullModule, PreviewQueueService],
})
export class PreviewQueueModule {}
