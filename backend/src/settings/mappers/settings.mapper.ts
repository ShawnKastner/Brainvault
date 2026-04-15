import { SettingsResponseDto } from '../dto/settings-response.dto';
import { AppSetting } from '../entities/app-setting.entity';

export function toSettingsResponse(settings: AppSetting): SettingsResponseDto {
  return {
    theme: settings.theme,
    compactNavigation: settings.compactNavigation,
    showReadingStats: settings.showReadingStats,
  };
}
