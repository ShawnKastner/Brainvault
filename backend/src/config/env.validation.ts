type Environment = 'development' | 'production' | 'test';

function readString(config: Record<string, unknown>, key: string, fallback: string): string {
  const value = config[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];
  const parsed = typeof value === 'number' ? value : Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return parsed;
}

function readEnvironment(config: Record<string, unknown>): Environment {
  const value = readString(config, 'NODE_ENV', 'development');
  if (value === 'development' || value === 'production' || value === 'test') {
    return value;
  }

  throw new Error('NODE_ENV must be one of development, production, or test');
}

export function resolveDbSynchronize(environment: string, value?: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return environment !== 'production';
  }

  if (typeof value === 'boolean') {
    if (environment === 'production' && value) {
      throw new Error('DB_SYNCHRONIZE cannot be true in production');
    }
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) {
    if (environment === 'production') {
      throw new Error('DB_SYNCHRONIZE cannot be true in production');
    }
    return true;
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  throw new Error('DB_SYNCHRONIZE must be a boolean value');
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const nodeEnv = readEnvironment(config);

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: readNumber(config, 'PORT', 3000),
    DB_HOST: readString(config, 'DB_HOST', 'localhost'),
    DB_PORT: readNumber(config, 'DB_PORT', 5432),
    DB_NAME: readString(config, 'DB_NAME', 'brainvault'),
    DB_USER: readString(config, 'DB_USER', 'brainvault'),
    DB_PASS: readString(config, 'DB_PASS', 'brainvault_secret'),
    DB_SYNCHRONIZE: resolveDbSynchronize(nodeEnv, config['DB_SYNCHRONIZE']),
    CORS_ORIGINS: readString(
      config,
      'CORS_ORIGINS',
      'http://localhost:4200,http://localhost:80,http://localhost',
    ),
  };
}
