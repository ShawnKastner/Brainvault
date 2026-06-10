import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { StorageApiService } from '../../../core/api/storage-api.service';
import type { StorageFileResponse } from '../../../core/models/storage.model';
import { StoragePreviewService } from './storage-preview.service';

describe(StoragePreviewService.name, () => {
  let service: StoragePreviewService;
  let api: jasmine.SpyObj<StorageApiService>;

  const officeFile: StorageFileResponse = {
    id: 'file-1',
    url: '/api/assets/files/file-1',
    filename: 'stored.docx',
    originalName: 'report.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 100,
    createdAt: '2026-06-10T10:00:00.000Z',
    updatedAt: '2026-06-10T10:00:00.000Z',
    preview: { status: 'pending', url: null, errorCode: null },
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<StorageApiService>('StorageApiService', [
      'checkFile',
      'requestPreview',
      'getPreviewStatus',
      'getPreviewUrl',
    ]);
    api.checkFile.and.returnValue(of(undefined));
    api.getPreviewUrl.and.returnValue('/api/assets/files/file-1/preview');
    TestBed.configureTestingModule({
      providers: [
        StoragePreviewService,
        { provide: StorageApiService, useValue: api },
      ],
    });
    service = TestBed.inject(StoragePreviewService);
  });

  it('starts an Office preview and polls until it is ready', fakeAsync(() => {
    api.requestPreview.and.returnValue(of({ status: 'pending', url: null, errorCode: null }));
    api.getPreviewStatus.and.returnValue(of({ status: 'ready', url: '/preview', errorCode: null }));
    const states: string[] = [];

    service.watch(officeFile).subscribe((state) => states.push(state.state));
    tick(2_000);

    expect(states).toEqual(['checking', 'pending', 'ready']);
  }));

  it('maps a missing original file without starting conversion', () => {
    api.checkFile.and.returnValue(throwError(() => ({ status: 404 })));
    const states: string[] = [];

    service.watch(officeFile).subscribe((state) => states.push(state.state));

    expect(states).toEqual(['checking', 'missing']);
    expect(api.requestPreview).not.toHaveBeenCalled();
  });
});
