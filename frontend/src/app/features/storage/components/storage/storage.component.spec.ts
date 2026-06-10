import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { StorageApiService } from '../../../../core/api/storage-api.service';
import type { StorageFileResponse } from '../../../../core/models/storage.model';
import { DocumentPreviewComponent } from '../document-preview/document-preview.component';
import { StorageComponent } from './storage.component';

const files: StorageFileResponse[] = [
  createFile('pdf-1', 'briefing.pdf'),
  createFile('pdf-2', 'roadmap.pdf'),
];

@Component({
  selector: 'bv-document-preview',
  standalone: true,
  template: '<div class="preview-mock" [attr.data-file-id]="file.id"></div>',
})
class MockDocumentPreviewComponent {
  @Input({ required: true }) file!: StorageFileResponse;
}

describe(StorageComponent.name, () => {
  let fixture: ComponentFixture<StorageComponent>;
  let storageApi: jasmine.SpyObj<StorageApiService>;

  beforeEach(async () => {
    storageApi = jasmine.createSpyObj<StorageApiService>('StorageApiService', [
      'getFiles',
      'uploadFile',
      'deleteFile',
      'getFileUrl',
    ]);
    storageApi.getFiles.and.returnValue(of(files));
    storageApi.getFileUrl.and.callFake((id) => `/api/assets/files/${id}`);
    setCompactLayout(false);

    await TestBed.configureTestingModule({
      imports: [StorageComponent],
      providers: [{ provide: StorageApiService, useValue: storageApi }],
    })
      .overrideComponent(StorageComponent, {
        remove: { imports: [DocumentPreviewComponent] },
        add: { imports: [MockDocumentPreviewComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(StorageComponent);
    fixture.detectChanges();
  });

  it('loads files without selecting an entry', () => {
    expect(storageApi.getFiles).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('briefing.pdf');
    expect(fixture.nativeElement.textContent).toContain('Keine Datei ausgewählt');
    expect(fixture.nativeElement.querySelector('.preview-mock')).toBeNull();
  });

  it('filters files and passes the selected entry to the preview', () => {
    componentApi().updateSearch('road');
    fixture.detectChanges();

    const row = fixture.debugElement.query(By.css('.pdf-select')).nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('.preview-mock') as HTMLElement;
    expect(preview.dataset['fileId']).toBe('pdf-2');
    expect(fixture.nativeElement.textContent).toContain('Original herunterladen');
  });

  it('collapses the file panel after selection in compact layout', () => {
    setCompactLayout(true);
    const row = fixture.debugElement.queryAll(By.css('.pdf-select'))[1].nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement.querySelector('.storage-view') as HTMLElement).classList,
    ).toContain('storage-panel-collapsed');
  });

  it('uploads and selects an Office file for preview', () => {
    const uploaded = createFile(
      'file-3',
      'planung.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'pending',
    );
    storageApi.uploadFile.and.returnValue(of(uploaded));

    dispatchFileSelection(new File(['PK'], 'planung.xlsx', { type: uploaded.contentType }));
    fixture.detectChanges();

    expect(storageApi.uploadFile).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('planung.xlsx');
    expect(fixture.nativeElement.querySelector('.preview-mock')).not.toBeNull();
  });

  it('rejects unsupported files on the client', () => {
    dispatchFileSelection(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    fixture.detectChanges();

    expect(storageApi.uploadFile).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Nur PDF-, Word-, Excel- und PowerPoint-Dateien sind erlaubt.',
    );
  });

  it('deletes a selected file after confirmation', () => {
    storageApi.deleteFile.and.returnValue(of(undefined));
    (fixture.debugElement.query(By.css('.pdf-select')).nativeElement as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.pdf-delete') as HTMLButtonElement).click();
    fixture.detectChanges();

    const confirmButton = Array.from(
      fixture.nativeElement.querySelectorAll('.confirm-modal .button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Datei löschen'));
    confirmButton?.click();
    fixture.detectChanges();

    expect(storageApi.deleteFile).toHaveBeenCalledWith('pdf-1');
    expect(fixture.nativeElement.textContent).not.toContain('briefing.pdf');
    expect(fixture.nativeElement.textContent).toContain('Keine Datei ausgewählt');
  });

  function componentApi(): { updateSearch: (value: string) => void } {
    return fixture.componentInstance as unknown as { updateSearch: (value: string) => void };
  }

  function dispatchFileSelection(file: File): void {
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
  }

  function setCompactLayout(matches: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jasmine.createSpy('matchMedia').and.returnValue({
        matches,
        media: '(max-width: 1100px)',
        addListener: jasmine.createSpy('addListener'),
        removeListener: jasmine.createSpy('removeListener'),
        addEventListener: jasmine.createSpy('addEventListener'),
        removeEventListener: jasmine.createSpy('removeEventListener'),
        dispatchEvent: jasmine.createSpy('dispatchEvent'),
      } as unknown as MediaQueryList),
    });
  }
});

function createFile(
  id: string,
  originalName: string,
  contentType = 'application/pdf',
  previewStatus: 'ready' | 'pending' = 'ready',
): StorageFileResponse {
  return {
    id,
    url: `/api/assets/files/${id}`,
    filename: `stored-${id}`,
    originalName,
    contentType,
    size: 2048,
    createdAt: '2026-04-21T09:15:00.000Z',
    updatedAt: '2026-04-21T09:15:00.000Z',
    preview: {
      status: previewStatus,
      url: previewStatus === 'ready' ? `/api/assets/files/${id}/preview` : null,
      errorCode: null,
    },
  };
}
