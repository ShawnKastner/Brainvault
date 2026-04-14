import { registerAs } from '@nestjs/config';
import { Page } from '../pages/entities/page.entity';
import { Space } from '../spaces/entities/space.entity';
import { resolveDbSynchronize } from '../config/env.validation';

export const databaseConfig = registerAs('database', () => {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';

  return {
    type: 'postgres' as const,
    host: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 5432),
    database: process.env['DB_NAME'] ?? 'brainvault',
    username: process.env['DB_USER'] ?? 'brainvault',
    password: process.env['DB_PASS'] ?? 'brainvault_secret',
    entities: [Space, Page],
    synchronize: resolveDbSynchronize(nodeEnv, process.env['DB_SYNCHRONIZE']),
    logging: nodeEnv === 'development',
  };
});
