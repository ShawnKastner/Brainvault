import { HealthController } from './health.controller';

describe(HealthController.name, () => {
  it('returns an ok health response', () => {
    const result = new HealthController().getHealth();

    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });
});
