import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_URL } from '../config/api-url.token';
import { SettingsApiService } from './settings-api.service';

describe(SettingsApiService.name, () => {
  let service: SettingsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SettingsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(SettingsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads settings from the relative API route', () => {
    service.get().subscribe();

    const request = http.expectOne('/api/settings');
    expect(request.request.method).toBe('GET');
    request.flush({ theme: 'classic', compactNavigation: false, showReadingStats: true });
  });

  it('uses PATCH for settings updates', () => {
    service.update({ theme: 'night' }).subscribe();

    const request = http.expectOne('/api/settings');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ theme: 'night' });
    request.flush({ theme: 'night', compactNavigation: false, showReadingStats: true });
  });
});
