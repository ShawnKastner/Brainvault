import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_URL } from '../config/api-url.token';
import { SpacesApiService } from './spaces-api.service';

describe(SpacesApiService.name, () => {
  let service: SpacesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SpacesApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(SpacesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads spaces from the relative API route', () => {
    service.getAll().subscribe();

    const request = http.expectOne('/api/spaces');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('uses DELETE for space removal', () => {
    service.remove('space-1').subscribe();

    const request = http.expectOne('/api/spaces/space-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
