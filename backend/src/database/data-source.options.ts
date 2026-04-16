import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { resolveDbMigrationsRun } from '../config/env.validation';
import { Page } from '../pages/entities/page.entity';
import { AppSetting } from '../settings/entities/app-setting.entity';
import { Space } from '../spaces/entities/space.entity';
import { InitialSchema1776297600000 } from './migrations/1776297600000-InitialSchema';

interface DatabaseOptionsOverrides {
  migrationsRun?: boolean;
}

function readString(env: Record<string, unknown>, key: string, fallback: string): string {
  const value = env[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readNumber(env: Record<string, unknown>, key: string, fallback: number): number {
  const value = env[key];
  const parsed = typeof value === 'number' ? value : Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return parsed;
}

export function createDatabaseOptions(
  overrides: DatabaseOptionsOverrides = {},
): PostgresConnectionOptions {
  const env = process.env;
  const nodeEnv = readString(env, 'NODE_ENV', 'development');

  return {
    type: 'postgres',
    host: readString(env, 'DB_HOST', 'localhost'),
    port: readNumber(env, 'DB_PORT', 5432),
    database: readString(env, 'DB_NAME', 'brainvault'),
    username: readString(env, 'DB_USER', 'brainvault'),
    password: readString(env, 'DB_PASS', 'brainvault_secret'),
    entities: [Space, Page, AppSetting],
    migrations: [InitialSchema1776297600000],
    migrationsRun: overrides.migrationsRun ?? resolveDbMigrationsRun(env['DB_MIGRATIONS_RUN']),
    synchronize: false,
    logging: nodeEnv === 'development',
  };
}
