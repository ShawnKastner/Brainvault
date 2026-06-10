import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AssetPreviewService } from './asset-preview.service';
import { GotenbergClientService, PreviewConversionError } from './gotenberg-client.service';
import {
  ASSET_PREVIEW_QUEUE,
  type AssetPreviewJobData,
} from './preview.constants';

@Processor(ASSET_PREVIEW_QUEUE, {
  concurrency: Number(process.env['PREVIEW_WORKER_CONCURRENCY'] ?? 1),
})
export class PreviewProcessor extends WorkerHost {
  private readonly logger = new Logger(PreviewProcessor.name);

  constructor(
    private readonly previews: AssetPreviewService,
    private readonly gotenberg: GotenbergClientService,
  ) {
    super();
  }

  async process(job: Job<AssetPreviewJobData>): Promise<void> {
    const { assetId } = job.data;
    const startedAt = Date.now();

    try {
      const input = await this.previews.beginConversion(assetId);
      if (!input) return;
      const output = await this.gotenberg.convert(input.filePath, input.filename);
      await this.previews.completeConversion(assetId, output);
      this.logger.log(
        `Preview completed asset=${assetId} job=${job.id} durationMs=${Date.now() - startedAt}`,
      );
    } catch (error) {
      const conversionError =
        error instanceof PreviewConversionError
          ? error
          : new PreviewConversionError('converter_unavailable', true, String(error));
      const attempts = job.opts.attempts ?? 1;
      const finalAttempt = !conversionError.retryable || job.attemptsMade + 1 >= attempts;

      if (finalAttempt) {
        await this.previews.markFailed(assetId, conversionError.code);
        this.logger.error(
          `Preview failed asset=${assetId} job=${job.id} code=${conversionError.code}`,
        );
        return;
      }

      await this.previews.markPending(assetId);
      this.logger.warn(
        `Preview retry asset=${assetId} job=${job.id} attempt=${job.attemptsMade + 1}`,
      );
      throw conversionError;
    }
  }
}
