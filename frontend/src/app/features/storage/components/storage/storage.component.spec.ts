import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { StorageApiService } from '../../../../core/api/storage-api.service';
import type { PdfAssetResponse } from '../../../../core/models/storage.model';
import { StorageComponent } from './storage.component';

const pdfs: PdfAssetResponse[] = [
  {
    id: 'pdf-1',
    url: '/api/assets/pdfs/pdf-1',
    filename: 'stored-1.pdf',
    originalName: 'briefing.pdf',
    contentType: 'application/pdf',
    size: 2048,
    createdAt: '2026-04-21T09:15:00.000Z',
    updatedAt: '2026-04-21T09:15:00.000Z',
  },
  {
    id: 'pdf-2',
    url: '/api/assets/pdfs/pdf-2',
    filename: 'stored-2.pdf',
    originalName: 'roadmap.pdf',
    contentType: 'application/pdf',
    size: 4096,
    createdAt: '2026-04-20T09:15:00.000Z',
    updatedAt: '2026-04-20T09:15:00.000Z',
  },
];

describe(StorageComponent.name, () => {
  let fixture: ComponentFixture<StorageComponent>;
  let storageApi: jasmine.SpyObj<StorageApiService>;

  beforeEach(async () => {
    storageApi = jasmine.createSpyObj<StorageApiService>('StorageApiService', [
      'getPdfs',
      'uploadPdf',
      'deletePdf',
      'checkPdf',
      'getPdfUrl',
    ]);
    storageApi.getPdfs.and.returnValue(of(pdfs));
    storageApi.checkPdf.and.returnValue(of(undefined));
    storageApi.getPdfUrl.and.callFake((id) => `/api/assets/pdfs/${id}`);
    setCompactLayout(false);

    await TestBed.configureTestingModule({
      imports: [StorageComponent],
      providers: [{ provide: StorageApiService, useValue: storageApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(StorageComponent);
    fixture.detectChanges();
  });

  it('loads PDFs without selecting an entry for preview', () => {
    expect(storageApi.getPdfs).toHaveBeenCalled();
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
    expect(iframe.getAttribute('src')).toBe('/api/assets/pdfs/pdf-2');
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
    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('/api/assets/pdfs/pdf-2');
  });

  it('shows a preview error when the selected PDF file is missing', () => {
    storageApi.checkPdf.and.callFake((id) =>
      id === 'pdf-2' ? throwError(() => ({ status: 404 })) : of(undefined),
    );

    const row = fixture.debugElement.queryAll(By.css('.pdf-select'))[1].nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Die PDF ist in der Datenbank gelistet, fehlt aber im Upload-Speicher.',
    );
  });

  it('uploads a PDF and selects the uploaded entry', () => {
    const uploaded: PdfAssetResponse = {
      ...pdfs[0],
      id: 'pdf-3',
      originalName: 'uploaded.pdf',
    };
    storageApi.uploadPdf.and.returnValue(of(uploaded));

    dispatchFileSelection(new File(['%PDF-1.7'], 'uploaded.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    expect(storageApi.uploadPdf).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('uploaded.pdf');
    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('/api/assets/pdfs/pdf-3');
  });

  it('rejects non-PDF files on the client', () => {
    dispatchFileSelection(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    fixture.detectChanges();

    expect(storageApi.uploadPdf).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Nur PDF-Dateien sind erlaubt.');
  });

  it('deletes a PDF after confirmation', () => {
    storageApi.deletePdf.and.returnValue(of(undefined));

    const row = fixture.debugElement.query(By.css('.pdf-select')).nativeElement as HTMLButtonElement;
    row.click();
    fixture.detectChanges();

    const deleteButton = fixture.nativeElement.querySelector('.pdf-delete') as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    const confirmButton = Array.from(
      fixture.nativeElement.querySelectorAll('.confirm-modal .button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('PDF löschen'));
    confirmButton?.click();
    fixture.detectChanges();

    expect(storageApi.deletePdf).toHaveBeenCalledWith('pdf-1');
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
});
