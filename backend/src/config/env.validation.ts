type Environment = 'development' | 'production' | 'test';

const trueValues = ['true', '1', 'yes'];
const falseValues = ['false', '0', 'no'];
const DEFAULT_MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_PDF_UPLOAD_BYTES = 25 * 1024 * 1024;

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

function readPositiveIntegerValue(value: unknown, key: string, fallback: number): number {
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

export function resolveDbMigrationsRun(value?: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (trueValues.includes(normalized)) {
    return true;
  }

  if (falseValues.includes(normalized)) {
    return false;
  }

  throw new Error('DB_MIGRATIONS_RUN must be a boolean value');
}

export function readMaxImageUploadBytes(value?: unknown): number {
  return readPositiveIntegerValue(value, 'MAX_IMAGE_UPLOAD_BYTES', DEFAULT_MAX_IMAGE_UPLOAD_BYTES);
}

export function readMaxPdfUploadBytes(value?: unknown): number {
  return readPositiveIntegerValue(value, 'MAX_PDF_UPLOAD_BYTES', DEFAULT_MAX_PDF_UPLOAD_BYTES);
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
    DB_MIGRATIONS_RUN: resolveDbMigrationsRun(config['DB_MIGRATIONS_RUN']),
    UPLOAD_DIR: readString(config, 'UPLOAD_DIR', 'uploads'),
    MAX_IMAGE_UPLOAD_BYTES: readMaxImageUploadBytes(config['MAX_IMAGE_UPLOAD_BYTES']),
    MAX_PDF_UPLOAD_BYTES: readMaxPdfUploadBytes(config['MAX_PDF_UPLOAD_BYTES']),
    CORS_ORIGINS: readString(
      config,
      'CORS_ORIGINS',
      'http://localhost:4200,http://localhost:80,http://localhost',
    ),
  };
}
