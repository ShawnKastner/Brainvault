import { Controller, Get } from '@nestjs/common';
import { GotenbergClientService } from './assets/preview/gotenberg-client.service';
import { PreviewQueueService } from './assets/preview/preview-queue.service';

@Controller('health')
export class WorkerHealthController {
  constructor(
    private readonly queue: PreviewQueueService,
    private readonly gotenberg: GotenbergClientService,
  ) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    await Promise.all([this.queue.checkHealth(), this.gotenberg.checkHealth()]);
    return { status: 'ok' };
  }
}
