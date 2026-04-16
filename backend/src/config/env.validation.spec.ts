import { resolveDbMigrationsRun, validateEnvironment } from './env.validation';

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
});
