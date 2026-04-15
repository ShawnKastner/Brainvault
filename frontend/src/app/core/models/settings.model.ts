export type ThemeId = 'classic' | 'clear' | 'night';

export interface AppSettings {
  theme: ThemeId;
  compactNavigation: boolean;
  showReadingStats: boolean;
}

export type UpdateSettingsRequest = Partial<AppSettings>;

export const SETTINGS_STORAGE_KEY = 'brainvault:settings:v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'classic',
  compactNavigation: false,
  showReadingStats: true,
};
