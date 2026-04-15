import { Repository } from 'typeorm';
import { AppSetting } from './entities/app-setting.entity';
import { SettingsService } from './settings.service';
import { DEFAULT_APP_SETTINGS, DEFAULT_SETTINGS_SCOPE } from './settings.constants';

interface SettingsRepositoryMock {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

function createSetting(overrides: Partial<AppSetting> = {}): AppSetting {
  return {
    id: '2a23b229-3b8f-48df-afd1-308525d382c7',
    ...DEFAULT_SETTINGS_SCOPE,
    ...DEFAULT_APP_SETTINGS,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe(SettingsService.name, () => {
  let repository: SettingsRepositoryMock;
  let service: SettingsService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn((setting) => setting as AppSetting),
      save: jest.fn(async (setting) => createSetting(setting)),
    };
    service = new SettingsService(repository as unknown as Repository<AppSetting>);
  });

  it('returns and persists defaults for a missing current scope', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findCurrent()).resolves.toEqual(DEFAULT_APP_SETTINGS);
    expect(repository.findOne).toHaveBeenCalledWith({ where: DEFAULT_SETTINGS_SCOPE });
    expect(repository.create).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS_SCOPE,
      ...DEFAULT_APP_SETTINGS,
    });
    expect(repository.save).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS_SCOPE,
      ...DEFAULT_APP_SETTINGS,
    });
  });

  it('returns existing settings without creating a new row', async () => {
    repository.findOne.mockResolvedValue(
      createSetting({
        theme: 'night',
        compactNavigation: true,
        showReadingStats: false,
      }),
    );

    await expect(service.findCurrent()).resolves.toEqual({
      theme: 'night',
      compactNavigation: true,
      showReadingStats: false,
    });
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('patches only provided values on the current scope', async () => {
    const existing = createSetting({
      theme: 'classic',
      compactNavigation: false,
      showReadingStats: true,
    });
    repository.findOne.mockResolvedValue(existing);

    await expect(
      service.updateCurrent({ theme: 'clear', compactNavigation: true }),
    ).resolves.toEqual({
      theme: 'clear',
      compactNavigation: true,
      showReadingStats: true,
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existing.id,
        scopeType: 'instance',
        scopeId: 'default',
        theme: 'clear',
        compactNavigation: true,
        showReadingStats: true,
      }),
    );
  });

  it('creates the scoped row when patching before settings exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.updateCurrent({ showReadingStats: false })).resolves.toEqual({
      theme: 'classic',
      compactNavigation: false,
      showReadingStats: false,
    });
    expect(repository.save).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS_SCOPE,
      ...DEFAULT_APP_SETTINGS,
      showReadingStats: false,
    });
  });
});
