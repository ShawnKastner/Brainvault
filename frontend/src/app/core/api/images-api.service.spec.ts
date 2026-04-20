import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_URL } from '../config/api-url.token';
import { ImagesApiService } from './images-api.service';

describe(ImagesApiService.name, () => {
  let service: ImagesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ImagesApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(ImagesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads images as multipart form data', () => {
    const file = new File(['image'], 'image.png', { type: 'image/png' });

    service.uploadImage(file).subscribe();

    const request = http.expectOne('/api/assets/images');
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBe(true);
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush({
      id: 'asset-1',
      url: '/api/assets/images/image.png',
      filename: 'image.png',
      originalName: 'image.png',
      contentType: 'image/png',
      size: 5,
    });
  });
});
