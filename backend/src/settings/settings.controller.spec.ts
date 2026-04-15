import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe(SettingsController.name, () => {
  it('delegates loading to the service', async () => {
    const service = {
      findCurrent: jest.fn().mockResolvedValue({ theme: 'classic' }),
    } as unknown as SettingsService;
    const controller = new SettingsController(service);

    await expect(controller.findCurrent()).resolves.toEqual({ theme: 'classic' });
    expect(service.findCurrent).toHaveBeenCalledTimes(1);
  });

  it('delegates patch updates to the service', async () => {
    const service = {
      updateCurrent: jest.fn().mockResolvedValue({ theme: 'night' }),
    } as unknown as SettingsService;
    const controller = new SettingsController(service);

    await expect(controller.updateCurrent({ theme: 'night' })).resolves.toEqual({
      theme: 'night',
    });
    expect(service.updateCurrent).toHaveBeenCalledWith({ theme: 'night' });
  });
});
