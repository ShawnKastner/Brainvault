import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { SettingsApiService } from '../api/settings-api.service';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
  type ThemeId,
} from '../models/settings.model';

const THEME_IDS: readonly ThemeId[] = ['classic', 'clear', 'night'];

export {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
  type ThemeId,
} from '../models/settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly document = inject(DOCUMENT);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly settingsSignal = signal<AppSettings>(this.readStoredSettings());
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private settingsVersion = 0;

  readonly settings = this.settingsSignal.asReadonly();
  readonly theme = computed(() => this.settings().theme);
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  constructor() {
    this.applyDocumentSettings(this.settings());
    this.loadFromBackend();
  }

  setTheme(theme: ThemeId): void {
    this.updateSettings({ theme });
  }

  updateSettings(settings: Partial<AppSettings>): void {
    const nextSettings = this.normalizeSettings({
      ...this.settingsSignal(),
      ...settings,
    });
    this.applySettings(nextSettings);
    this.persistOptimisticSettings(settings, nextSettings);
  }

  reset(): void {
    this.applySettings(DEFAULT_SETTINGS);
    this.persistOptimisticSettings(DEFAULT_SETTINGS, DEFAULT_SETTINGS);
  }

  private loadFromBackend(): void {
    const requestVersion = this.settingsVersion;
    this.loadingSignal.set(true);
    this.settingsApi.get().subscribe({
      next: (settings) => {
        if (requestVersion === this.settingsVersion) {
          this.applySettings(settings);
        }
        this.errorSignal.set(null);
      },
      error: () => {
        this.errorSignal.set('Einstellungen konnten nicht vom Server geladen werden.');
        this.loadingSignal.set(false);
      },
      complete: () => this.loadingSignal.set(false),
    });
  }

  private persistOptimisticSettings(
    patch: Partial<AppSettings>,
    fallbackSettings: AppSettings,
  ): void {
    this.settingsVersion += 1;
    const requestVersion = this.settingsVersion;

    this.settingsApi.update(patch).subscribe({
      next: (settings) => {
        if (requestVersion === this.settingsVersion) {
          this.applySettings(settings);
          this.errorSignal.set(null);
        }
      },
      error: () => {
        if (requestVersion === this.settingsVersion) {
          this.applySettings(fallbackSettings);
          this.errorSignal.set('Einstellungen konnten nicht auf dem Server gespeichert werden.');
        }
      },
    });
  }

  private applySettings(settings: AppSettings): void {
    const normalized = this.normalizeSettings(settings);
    this.settingsSignal.set(normalized);
    this.applyDocumentSettings(normalized);
    this.writeStoredSettings(normalized);
  }

  private readStoredSettings(): AppSettings {
    const storage = this.document.defaultView?.localStorage;
    if (!storage) return DEFAULT_SETTINGS;

    try {
      const raw = storage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return DEFAULT_SETTINGS;

      return this.normalizeSettings(JSON.parse(raw) as unknown);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private writeStoredSettings(settings: AppSettings): void {
    const storage = this.document.defaultView?.localStorage;
    if (!storage) return;

    try {
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Persisting preferences should never block the main app.
    }
  }

  private normalizeSettings(value: unknown): AppSettings {
    const candidate = isRecord(value) ? value : {};

    return {
      theme: isThemeId(candidate['theme']) ? candidate['theme'] : DEFAULT_SETTINGS.theme,
      compactNavigation:
        typeof candidate['compactNavigation'] === 'boolean'
          ? candidate['compactNavigation']
          : DEFAULT_SETTINGS.compactNavigation,
      showReadingStats:
        typeof candidate['showReadingStats'] === 'boolean'
          ? candidate['showReadingStats']
          : DEFAULT_SETTINGS.showReadingStats,
    };
  }

  private applyDocumentSettings(settings: AppSettings): void {
    const root = this.document.documentElement;
    root.dataset['theme'] = settings.theme;

    if (settings.compactNavigation) {
      root.dataset['navDensity'] = 'compact';
    } else {
      delete root.dataset['navDensity'];
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_IDS.includes(value as ThemeId);
}
