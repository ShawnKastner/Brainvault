import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_URL } from '../config/api-url.token';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SettingsService,
  type AppSettings,
} from './settings.service';

describe(SettingsService.name, () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-nav-density');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-nav-density');
  });

  it('uses default settings when nothing is stored', () => {
    const service = TestBed.inject(SettingsService);

    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(document.documentElement.dataset['theme']).toBe('classic');
    expect(document.documentElement.dataset['navDensity']).toBeUndefined();

    flushInitialSettings();
  });

  it('loads valid stored settings and applies document attributes', () => {
    const stored: AppSettings = {
      theme: 'night',
      compactNavigation: true,
      showReadingStats: false,
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(stored));

    const service = TestBed.inject(SettingsService);

    expect(service.settings()).toEqual(stored);
    expect(document.documentElement.dataset['theme']).toBe('night');
    expect(document.documentElement.dataset['navDensity']).toBe('compact');

    flushInitialSettings(stored);
  });

  it('ignores malformed stored settings', () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        theme: 'purple',
        compactNavigation: 'yes',
        showReadingStats: null,
      }),
    );

    const service = TestBed.inject(SettingsService);

    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(document.documentElement.dataset['theme']).toBe('classic');

    flushInitialSettings();
  });

  it('applies backend settings over the local cache', () => {
    const service = TestBed.inject(SettingsService);

    flushInitialSettings({
      theme: 'clear',
      compactNavigation: true,
      showReadingStats: false,
    });

    expect(service.settings()).toEqual({
      theme: 'clear',
      compactNavigation: true,
      showReadingStats: false,
    });
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toEqual({
      theme: 'clear',
      compactNavigation: true,
      showReadingStats: false,
    });
    expect(document.documentElement.dataset['theme']).toBe('clear');
    expect(document.documentElement.dataset['navDensity']).toBe('compact');
  });

  it('persists updates optimistically and stores the backend response', () => {
    const service = TestBed.inject(SettingsService);
    flushInitialSettings();

    service.updateSettings({
      theme: 'clear',
      compactNavigation: true,
      showReadingStats: false,
    });

    expect(service.settings()).toEqual({
      theme: 'clear',
      compactNavigation: true,
      showReadingStats: false,
    });
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toEqual({
      theme: 'clear',
      compactNavigation: true,
      showReadingStats: false,
    });
    expect(document.documentElement.dataset['theme']).toBe('clear');
    expect(document.documentElement.dataset['navDensity']).toBe('compact');

    const request = http.expectOne('/api/settings');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      theme: 'clear',
      compactNavigation: true,
      showReadingStats: false,
    });
    request.flush({
      theme: 'night',
      compactNavigation: true,
      showReadingStats: false,
    });

    expect(service.settings().theme).toBe('night');
    expect(document.documentElement.dataset['theme']).toBe('night');
  });

  it('resets preferences without clearing application data', () => {
    const service = TestBed.inject(SettingsService);
    flushInitialSettings();

    service.updateSettings({
      theme: 'night',
      compactNavigation: true,
      showReadingStats: false,
    });
    http.expectOne('/api/settings').flush({
      theme: 'night',
      compactNavigation: true,
      showReadingStats: false,
    });

    service.reset();

    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toEqual(DEFAULT_SETTINGS);
    expect(document.documentElement.dataset['theme']).toBe('classic');
    expect(document.documentElement.dataset['navDensity']).toBeUndefined();

    const request = http.expectOne('/api/settings');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(DEFAULT_SETTINGS);
    request.flush(DEFAULT_SETTINGS);
  });

  it('keeps local updates visible and exposes an error when saving fails', () => {
    const service = TestBed.inject(SettingsService);
    flushInitialSettings();

    service.setTheme('night');

    const request = http.expectOne('/api/settings');
    request.flush('Server error', { status: 500, statusText: 'Server Error' });

    expect(service.settings().theme).toBe('night');
    expect(document.documentElement.dataset['theme']).toBe('night');
    expect(service.error()).toContain('gespeichert');
  });

  function flushInitialSettings(settings: AppSettings = DEFAULT_SETTINGS): void {
    const request = http.expectOne('/api/settings');
    expect(request.request.method).toBe('GET');
    request.flush(settings);
  }
});
