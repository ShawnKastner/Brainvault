import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { SETTING_THEME_IDS, type SettingTheme } from '../settings.constants';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: SETTING_THEME_IDS })
  @IsOptional()
  @IsIn([...SETTING_THEME_IDS])
  theme?: SettingTheme;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  compactNavigation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showReadingStats?: boolean;
}
