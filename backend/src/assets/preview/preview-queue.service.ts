import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  ASSET_PREVIEW_JOB,
  ASSET_PREVIEW_QUEUE,
  type AssetPreviewJobData,
} from './preview.constants';

@Injectable()
export class PreviewQueueService {
  constructor(
    @InjectQueue(ASSET_PREVIEW_QUEUE)
    private readonly queue: Queue<AssetPreviewJobData>,
  ) {}

  async enqueue(assetId: string): Promise<void> {
    const jobId = this.jobId(assetId);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed' || state === 'completed') {
        await existing.remove();
      } else {
        return;
      }
    }

    await this.queue.add(
      ASSET_PREVIEW_JOB,
      { assetId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  async remove(assetId: string): Promise<void> {
    const job = await this.queue.getJob(this.jobId(assetId));
    if (job && !(await job.isActive())) {
      await job.remove();
    }
  }

  async checkHealth(): Promise<void> {
    await this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
  }

  private jobId(assetId: string): string {
    return `asset-preview-${assetId}`;
  }
}
