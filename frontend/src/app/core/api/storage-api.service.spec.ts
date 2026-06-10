import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../config/api-url.token';
import { StorageApiService } from './storage-api.service';

describe(StorageApiService.name, () => {
  let service: StorageApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StorageApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(StorageApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads storage files', () => {
    service.getFiles().subscribe((pdfs) => {
      expect(pdfs.length).toBe(1);
      expect(pdfs[0].originalName).toBe('briefing.pdf');
    });

    const request = http.expectOne('/api/assets/files');
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        id: 'pdf-1',
        url: '/api/assets/files/pdf-1',
        filename: 'file.pdf',
        originalName: 'briefing.pdf',
        contentType: 'application/pdf',
        size: 12,
        createdAt: '2026-04-21T09:15:00.000Z',
        updatedAt: '2026-04-21T09:15:00.000Z',
      },
    ]);
  });

  it('uploads storage files as multipart form data', () => {
    const file = new File(['%PDF-1.7'], 'briefing.pdf', { type: 'application/pdf' });

    service.uploadFile(file).subscribe();

    const request = http.expectOne('/api/assets/files');
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBe(true);
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush({
      id: 'pdf-1',
      url: '/api/assets/files/pdf-1',
      filename: 'file.pdf',
      originalName: 'briefing.pdf',
      contentType: 'application/pdf',
      size: 12,
      createdAt: '2026-04-21T09:15:00.000Z',
      updatedAt: '2026-04-21T09:15:00.000Z',
    });
  });

  it('deletes files and exposes the file URL', () => {
    expect(service.getFileUrl('pdf 1')).toBe('/api/assets/files/pdf%201');

    service.deleteFile('pdf-1').subscribe();

    const request = http.expectOne('/api/assets/files/pdf-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  it('checks file availability with HEAD', () => {
    service.checkFile('pdf 1').subscribe();

    const request = http.expectOne('/api/assets/files/pdf%201');
    expect(request.request.method).toBe('HEAD');
    request.flush(null);
  });

  it('starts, checks, and exposes document previews', () => {
    service.requestPreview('file 1').subscribe();
    const start = http.expectOne('/api/assets/files/file%201/preview');
    expect(start.request.method).toBe('POST');
    start.flush({ status: 'pending', url: null, errorCode: null });

    service.getPreviewStatus('file 1').subscribe();
    const status = http.expectOne('/api/assets/files/file%201/preview/status');
    expect(status.request.method).toBe('GET');
    status.flush({ status: 'ready', url: '/preview', errorCode: null });

    expect(service.getPreviewUrl('file 1')).toBe('/api/assets/files/file%201/preview');
  });
});
