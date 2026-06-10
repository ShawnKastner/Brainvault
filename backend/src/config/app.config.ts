import { registerAs } from '@nestjs/config';

function parseCorsOrigins(value?: string): string[] {
  return (value ?? 'http://localhost:4200,http://localhost:80,http://localhost')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: Number(process.env['PORT'] ?? 3000),
  corsOrigins: parseCorsOrigins(process.env['CORS_ORIGINS']),
  uploadDir: process.env['UPLOAD_DIR'] ?? 'uploads',
  maxImageUploadBytes: Number(process.env['MAX_IMAGE_UPLOAD_BYTES'] ?? 5 * 1024 * 1024),
  maxPdfUploadBytes: Number(process.env['MAX_PDF_UPLOAD_BYTES'] ?? 25 * 1024 * 1024),
  redisHost: process.env['REDIS_HOST'] ?? 'localhost',
  redisPort: Number(process.env['REDIS_PORT'] ?? 6379),
  gotenbergUrl: process.env['GOTENBERG_URL'] ?? 'http://localhost:3002',
  previewConversionTimeoutMs: Number(process.env['PREVIEW_CONVERSION_TIMEOUT_MS'] ?? 120_000),
  maxPreviewBytes: Number(process.env['MAX_PREVIEW_BYTES'] ?? 100 * 1024 * 1024),
  previewWorkerConcurrency: Number(process.env['PREVIEW_WORKER_CONCURRENCY'] ?? 1),
  previewGeneratorVersion: process.env['PREVIEW_GENERATOR_VERSION'] ?? '1',
  previewWorkerEnabled: process.env['PREVIEW_WORKER_ENABLED'] === 'true',
  previewWorkerPort: Number(process.env['PREVIEW_WORKER_PORT'] ?? 3001),
}));
