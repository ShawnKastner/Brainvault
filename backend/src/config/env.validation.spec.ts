import {
  readMaxImageUploadBytes,
  readMaxPdfUploadBytes,
  resolveDbMigrationsRun,
  validateEnvironment,
} from './env.validation';

describe('environment validation', () => {
  it('enables database migrations by default', () => {
    expect(resolveDbMigrationsRun()).toBe(true);
    expect(validateEnvironment({})['DB_MIGRATIONS_RUN']).toBe(true);
  });

  it('parses enabled database migrations values', () => {
    for (const value of ['true', '1', 'yes', true]) {
      expect(resolveDbMigrationsRun(value)).toBe(true);
    }
  });

  it('parses disabled database migrations values', () => {
    for (const value of ['false', '0', 'no', false]) {
      expect(resolveDbMigrationsRun(value)).toBe(false);
    }
  });

  it('rejects invalid database migrations values', () => {
    expect(() => resolveDbMigrationsRun('sometimes')).toThrow(
      'DB_MIGRATIONS_RUN must be a boolean value',
    );
  });

  it('defaults and validates the maximum image upload size', () => {
    expect(readMaxImageUploadBytes()).toBe(5 * 1024 * 1024);
    expect(readMaxImageUploadBytes('1024')).toBe(1024);
    expect(validateEnvironment({})['UPLOAD_DIR']).toBe('uploads');
    expect(validateEnvironment({})['MAX_IMAGE_UPLOAD_BYTES']).toBe(5 * 1024 * 1024);
    expect(() => readMaxImageUploadBytes('0')).toThrow(
      'MAX_IMAGE_UPLOAD_BYTES must be a positive integer',
    );
  });

  it('defaults and validates the maximum PDF upload size', () => {
    expect(readMaxPdfUploadBytes()).toBe(25 * 1024 * 1024);
    expect(readMaxPdfUploadBytes('2048')).toBe(2048);
    expect(validateEnvironment({})['MAX_PDF_UPLOAD_BYTES']).toBe(25 * 1024 * 1024);
    expect(() => readMaxPdfUploadBytes('0')).toThrow(
      'MAX_PDF_UPLOAD_BYTES must be a positive integer',
    );
  });
});
