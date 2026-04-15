import { ApiProperty } from '@nestjs/swagger';
import { SETTING_THEME_IDS, type SettingTheme } from '../settings.constants';

export class SettingsResponseDto {
  @ApiProperty({ enum: SETTING_THEME_IDS })
  theme: SettingTheme;

  @ApiProperty()
  compactNavigation: boolean;

  @ApiProperty()
  showReadingStats: boolean;
}
