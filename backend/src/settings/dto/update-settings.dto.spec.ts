import { validate } from 'class-validator';
import { UpdateSettingsDto } from './update-settings.dto';

describe(UpdateSettingsDto.name, () => {
  it('accepts partial valid settings', async () => {
    const dto = new UpdateSettingsDto();
    dto.theme = 'night';
    dto.compactNavigation = true;

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects invalid theme values', async () => {
    const dto = new UpdateSettingsDto();
    dto.theme = 'purple' as UpdateSettingsDto['theme'];

    await expect(validate(dto)).resolves.toEqual([
      expect.objectContaining({
        property: 'theme',
      }),
    ]);
  });
});
