import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_URL } from '../../../core/config/api-url.token';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, SettingsService } from '../../../core/services/settings.service';
import { SettingsModalComponent } from './settings-modal.component';

describe(SettingsModalComponent.name, () => {
  let fixture: ComponentFixture<SettingsModalComponent>;
  let settings: SettingsService;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-nav-density');

    await TestBed.configureTestingModule({
      imports: [SettingsModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    settings = TestBed.inject(SettingsService);
    http.expectOne('/api/settings').flush(DEFAULT_SETTINGS);
    fixture = TestBed.createComponent(SettingsModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-nav-density');
  });

  it('selects a theme from the theme cards', () => {
    const radios = fixture.nativeElement.querySelectorAll('[role="radio"]') as NodeListOf<HTMLButtonElement>;

    radios[1].click();
    http.expectOne('/api/settings').flush({
      theme: 'clear',
      compactNavigation: false,
      showReadingStats: true,
    });
    fixture.detectChanges();

    expect(settings.settings().theme).toBe('clear');
    expect(document.documentElement.dataset['theme']).toBe('clear');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
  });

  it('toggles compact navigation and reading stats', () => {
    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]') as NodeListOf<HTMLButtonElement>;

    switches[0].click();
    http.expectOne('/api/settings').flush({
      theme: 'classic',
      compactNavigation: true,
      showReadingStats: true,
    });
    switches[1].click();
    http.expectOne('/api/settings').flush({
      theme: 'classic',
      compactNavigation: true,
      showReadingStats: false,
    });
    fixture.detectChanges();

    expect(settings.settings().compactNavigation).toBeTrue();
    expect(settings.settings().showReadingStats).toBeFalse();
    expect(document.documentElement.dataset['navDensity']).toBe('compact');
  });

  it('resets settings to defaults', () => {
    settings.updateSettings({
      theme: 'night',
      compactNavigation: true,
      showReadingStats: false,
    });
    http.expectOne('/api/settings').flush({
      theme: 'night',
      compactNavigation: true,
      showReadingStats: false,
    });
    fixture.detectChanges();

    const resetButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('zurücksetzen'));

    resetButton?.click();
    http.expectOne('/api/settings').flush(DEFAULT_SETTINGS);

    expect(settings.settings()).toEqual(DEFAULT_SETTINGS);
    expect(document.documentElement.dataset['theme']).toBe('classic');
    expect(document.documentElement.dataset['navDensity']).toBeUndefined();
  });

  it('emits close from the backdrop and Escape key', () => {
    let closeCount = 0;
    fixture.componentInstance.close.subscribe(() => {
      closeCount += 1;
    });

    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop') as HTMLButtonElement;
    backdrop.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closeCount).toBe(2);
  });

  it('shows backend persistence errors inside the modal', () => {
    settings.setTheme('night');
    http.expectOne('/api/settings').flush('Server error', {
      status: 500,
      statusText: 'Server Error',
    });
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;

    expect(alert.textContent).toContain('gespeichert');
  });
});
