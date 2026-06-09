import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { of, throwError } from 'rxjs';
import { StorageApiService } from '../../../../core/api/storage-api.service';
import type { PdfAssetResponse } from '../../../../core/models/storage.model';
import { StorageComponent } from './storage.component';

const pdfs: PdfAssetResponse[] = [
  {
    id: 'pdf-1',
    url: '/api/assets/files/pdf-1',
    filename: 'stored-1.pdf',
    originalName: 'briefing.pdf',
    contentType: 'application/pdf',
    size: 2048,
    createdAt: '2026-04-21T09:15:00.000Z',
    updatedAt: '2026-04-21T09:15:00.000Z',
  },
  {
    id: 'pdf-2',
    url: '/api/assets/files/pdf-2',
    filename: 'stored-2.pdf',
    originalName: 'roadmap.pdf',
    contentType: 'application/pdf',
    size: 4096,
    createdAt: '2026-04-20T09:15:00.000Z',
    updatedAt: '2026-04-20T09:15:00.000Z',
  },
];

@Component({
  selector: 'ngx-extended-pdf-viewer',
  standalone: true,
  template: '',
})
class MockNgxExtendedPdfViewerComponent {
  @Input() src: unknown;
  @Input() height: unknown;
  @Input() showToolbar: unknown;
  @Input() pageViewMode: unknown;
  @Input() scrollMode: unknown;
  @Input() textLayer: unknown;
  @Input() showSidebarButton: unknown;
  @Input() showFindButton: unknown;
  @Input() showPagingButtons: unknown;
  @Input() showZoomButtons: unknown;
  @Input() showZoomDropdown: unknown;
  @Input() showOpenFileButton: unknown;
  @Input() showPrintButton: unknown;
  @Input() showDownloadButton: unknown;
  @Input() showSecondaryToolbarButton: unknown;
  @Input() showEditorButtons: unknown;
  @Input() showTextEditor: unknown;
  @Input() showStampEditor: unknown;
  @Input() showCommentEditor: unknown;
  @Input() showDrawEditor: unknown;
  @Input() showHighlightEditor: unknown;
  @Input() showSignatureEditor: unknown;
}

describe(StorageComponent.name, () => {
  let fixture: ComponentFixture<StorageComponent>;
  let storageApi: jasmine.SpyObj<StorageApiService>;
  const defaultNavigator = {
    maxTouchPoints: window.navigator.maxTouchPoints,
    platform: window.navigator.platform,
    userAgent: window.navigator.userAgent,
  };

  beforeEach(async () => {
    storageApi = jasmine.createSpyObj<StorageApiService>('StorageApiService', [
      'getFiles',
      'uploadFile',
      'deleteFile',
      'checkFile',
      'getFileUrl',
    ]);
    storageApi.getFiles.and.returnValue(of(pdfs));
    storageApi.checkFile.and.returnValue(of(undefined));
    storageApi.getFileUrl.and.callFake((id) => `/api/assets/files/${id}`);
    setCompactLayout(false);

    await TestBed.configureTestingModule({
      imports: [StorageComponent],
      providers: [{ provide: StorageApiService, useValue: storageApi }],
    })
      .overrideComponent(StorageComponent, {
        remove: { imports: [NgxExtendedPdfViewerModule] },
        add: { imports: [MockNgxExtendedPdfViewerComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(StorageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    setNavigator(defaultNavigator);
  });

  it('loads PDFs without selecting an entry for preview', () => {
    expect(storageApi.getFiles).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('briefing.pdf');
    expect(fixture.nativeElement.textContent).toContain('Keine Datei ausgewählt');

    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeNull();
  });

  it('filters PDFs by filename and switches selection', () => {
    const component = componentApi();

    component.updateSearch('road');
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('.pdf-list') as HTMLElement;
    expect(list.textContent).not.toContain('briefing.pdf');
    expect(list.textContent).toContain('roadmap.pdf');

    const row = fixture.debugElement.query(By.css('.pdf-select')).nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('/api/assets/files/pdf-2');
    expect(fixture.nativeElement.querySelector('ngx-extended-pdf-viewer')).toBeNull();
  });

  it('toggles the storage file panel', () => {
    const row = fixture.debugElement.query(By.css('.pdf-select')).nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    const view = fixture.nativeElement.querySelector('.storage-view') as HTMLElement;
    const toggle = fixture.nativeElement.querySelector('.storage-panel-toggle') as HTMLButtonElement;

    expect(view.classList).not.toContain('storage-panel-collapsed');

    toggle.click();
    fixture.detectChanges();

    expect(view.classList).toContain('storage-panel-collapsed');

    toggle.click();
    fixture.detectChanges();

    expect(view.classList).not.toContain('storage-panel-collapsed');
  });

  it('collapses the file panel after selecting a PDF in compact layout', () => {
    setCompactLayout(true);

    const row = fixture.debugElement.queryAll(By.css('.pdf-select'))[1].nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    const view = fixture.nativeElement.querySelector('.storage-view') as HTMLElement;
    expect(view.classList).toContain('storage-panel-collapsed');
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    expect(fixture.nativeElement.querySelector('ngx-extended-pdf-viewer')).not.toBeNull();
  });

  it('uses the embedded PDF viewer on iPadOS devices outside compact layout', () => {
    setNavigator({
      maxTouchPoints: 5,
      platform: 'MacIntel',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    });

    const row = fixture.debugElement.queryAll(By.css('.pdf-select'))[1].nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    expect(fixture.nativeElement.querySelector('ngx-extended-pdf-viewer')).not.toBeNull();
  });

  it('shows a preview error when the selected PDF file is missing', () => {
    storageApi.checkFile.and.callFake((id) =>
      id === 'pdf-2' ? throwError(() => ({ status: 404 })) : of(undefined),
    );

    const row = fixture.debugElement.queryAll(By.css('.pdf-select'))[1].nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    expect(fixture.nativeElement.querySelector('ngx-extended-pdf-viewer')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Die Datei ist gelistet, fehlt aber im Upload-Speicher.',
    );
  });

  it('uploads a PDF and selects the uploaded entry', () => {
    const uploaded: PdfAssetResponse = {
      ...pdfs[0],
      id: 'pdf-3',
      originalName: 'uploaded.pdf',
    };
    storageApi.uploadFile.and.returnValue(of(uploaded));

    dispatchFileSelection(new File(['%PDF-1.7'], 'uploaded.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    expect(storageApi.uploadFile).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('uploaded.pdf');
    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('/api/assets/files/pdf-3');
  });


  it('uploads and offers an Office file for download', () => {
    const uploaded: PdfAssetResponse = {
      ...pdfs[0],
      id: 'file-3',
      originalName: 'planung.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    storageApi.uploadFile.and.returnValue(of(uploaded));

    dispatchFileSelection(new File(['PK\x03\x04'], 'planung.xlsx', { type: uploaded.contentType }));
    fixture.detectChanges();

    expect(storageApi.uploadFile).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('planung.xlsx');
    expect(fixture.nativeElement.textContent).toContain('Herunterladen');
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it('rejects unsupported files on the client', () => {
    dispatchFileSelection(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    fixture.detectChanges();

    expect(storageApi.uploadFile).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Nur PDF-, Word-, Excel- und PowerPoint-Dateien sind erlaubt.');
  });

  it('deletes a PDF after confirmation', () => {
    storageApi.deleteFile.and.returnValue(of(undefined));

    const row = fixture.debugElement.query(By.css('.pdf-select')).nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    const deleteButton = fixture.nativeElement.querySelector('.pdf-delete') as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    const confirmButton = Array.from(
      fixture.nativeElement.querySelectorAll('.confirm-modal .button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Datei löschen'));
    confirmButton?.click();
    fixture.detectChanges();

    expect(storageApi.deleteFile).toHaveBeenCalledWith('pdf-1');
    expect(fixture.nativeElement.textContent).not.toContain('briefing.pdf');
    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Keine Datei ausgewählt');
  });

  function componentApi(): {
    updateSearch: (value: string) => void;
  } {
    return fixture.componentInstance as unknown as {
      updateSearch: (value: string) => void;
    };
  }

  function dispatchFileSelection(file: File): void {
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change'));
  }

  function setCompactLayout(matches: boolean): void {
    const matcher = jasmine.createSpy('matchMedia').and.returnValue({
      matches,
      media: '(max-width: 1100px)',
      onchange: null,
      addListener: jasmine.createSpy('addListener'),
      removeListener: jasmine.createSpy('removeListener'),
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
      dispatchEvent: jasmine.createSpy('dispatchEvent'),
    } as unknown as MediaQueryList);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matcher,
    });
  }

  function setNavigator(
    value: {
      maxTouchPoints: number;
      platform: string;
      userAgent: string;
    },
  ): void {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: value.userAgent,
    });
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: value.platform,
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: value.maxTouchPoints,
    });
  }
});
