export const SETTING_THEME_IDS = ['classic', 'clear', 'night'] as const;
export type SettingTheme = (typeof SETTING_THEME_IDS)[number];

export type SettingScopeType = 'instance' | 'user';

export interface EffectiveSettings {
  theme: SettingTheme;
  compactNavigation: boolean;
  showReadingStats: boolean;
}

export const DEFAULT_SETTINGS_SCOPE = {
  scopeType: 'instance' as const,
  scopeId: 'default',
};

export const DEFAULT_APP_SETTINGS: EffectiveSettings = {
  theme: 'classic',
  compactNavigation: false,
  showReadingStats: true,
};
