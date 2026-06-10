import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PreviewWorkerModule } from './preview-worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(PreviewWorkerModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('app.previewWorkerPort', 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`Preview worker health endpoint listening on port ${port}`);
}

bootstrap();
