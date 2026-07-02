import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_URL } from '../config/api-url.token';
import { PagesApiService } from './pages-api.service';

describe(PagesApiService.name, () => {
  let service: PagesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PagesApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(PagesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses HttpParams for the optional space filter', () => {
    service.getAll('space-1').subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/pages');
    expect(request.request.params.get('spaceId')).toBe('space-1');
    request.flush([]);
  });

  it('uses PATCH for page updates', () => {
    service.update('page-1', { title: 'Updated' }).subscribe();

    const request = http.expectOne('/api/pages/page-1');
    expect(request.request.method).toBe('PATCH');
    request.flush({});
  });

  it('downloads page PDF exports as blobs', () => {
    service.exportPdf('page 1').subscribe((response) => {
      expect(response.body?.type).toBe('application/pdf');
    });

    const request = http.expectOne('/api/pages/page%201/export/pdf');
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
  });
});
