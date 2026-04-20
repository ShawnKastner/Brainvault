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
}));
