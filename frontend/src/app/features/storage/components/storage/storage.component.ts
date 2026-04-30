import { DatePipe, DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgxExtendedPdfViewerModule, ScrollModeType } from 'ngx-extended-pdf-viewer';
import { finalize } from 'rxjs';
import { StorageApiService } from '../../../../core/api/storage-api.service';
import type { PdfAssetResponse } from '../../../../core/models/storage.model';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';

const PDF_CONTENT_TYPE = 'application/pdf';
const COMPACT_STORAGE_MEDIA_QUERY = '(max-width: 1100px)';

type PdfPreviewStatus =
  | { id: null; state: 'idle' }
  | { id: string; state: 'checking' | 'available' | 'missing' | 'error' };

type PdfPreviewMode = 'desktop-native-preview' | 'mobile-embedded-preview';

@Component({
  selector: 'bv-storage',
  standalone: true,
  imports: [ConfirmModalComponent, DatePipe, NgxExtendedPdfViewerModule],
  templateUrl: './storage.component.html',
  styleUrl: './storage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorageComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly storageApi = inject(StorageApiService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly pdfs = signal<PdfAssetResponse[]>([]);
  protected readonly selectedPdfId = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly deleteCandidate = signal<PdfAssetResponse | null>(null);
  protected readonly storagePanelCollapsed = signal(false);
  protected readonly pdfPreviewStatus = signal<PdfPreviewStatus>({ id: null, state: 'idle' });
  protected readonly pdfScrollMode = ScrollModeType;

  private pdfCheckRun = 0;

  protected readonly filteredPdfs = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const pdfs = this.pdfs();
    if (!query) return pdfs;

    return pdfs.filter((pdf) => pdf.originalName.toLowerCase().includes(query));
  });

  protected readonly selectedPdf = computed(() => {
    const selectedId = this.selectedPdfId();
    if (!selectedId) return null;

    return this.pdfs().find((pdf) => pdf.id === selectedId) ?? null;
  });

  protected readonly selectedPdfUrl = computed<SafeResourceUrl | null>(() => {
    const pdf = this.selectedPdf();
    const status = this.pdfPreviewStatus();
    if (!pdf || status.id !== pdf.id || status.state !== 'available') return null;

    return this.sanitizer.bypassSecurityTrustResourceUrl(this.storageApi.getPdfUrl(pdf.id));
  });

  protected readonly selectedPdfViewerUrl = computed<string | null>(() => {
    const pdf = this.selectedPdf();
    const status = this.pdfPreviewStatus();
    if (!pdf || status.id !== pdf.id || status.state !== 'available') return null;

    return this.storageApi.getPdfUrl(pdf.id);
  });

  protected readonly pdfPreviewMode = computed<PdfPreviewMode>(() => {
    const pdf = this.selectedPdf();
    if (!pdf) return 'desktop-native-preview';

    return this.shouldUseEmbeddedPdfViewer()
      ? 'mobile-embedded-preview'
      : 'desktop-native-preview';
  });

  protected readonly usesEmbeddedPdfViewer = computed(() => this.pdfPreviewMode() === 'mobile-embedded-preview');

  protected readonly pdfPreviewChecking = computed(() => {
    const pdf = this.selectedPdf();
    const status = this.pdfPreviewStatus();

    return pdf !== null && status.id === pdf.id && status.state === 'checking';
  });

  protected readonly pdfPreviewError = computed(() => {
    const pdf = this.selectedPdf();
    const status = this.pdfPreviewStatus();
    if (!pdf || status.id !== pdf.id) return null;

    if (status.state === 'missing') {
      return 'Die PDF ist in der Datenbank gelistet, fehlt aber im Upload-Speicher.';
    }

    if (status.state === 'error') {
      return 'Die PDF-Datei konnte nicht geprüft werden.';
    }

    return null;
  });

  protected readonly storageSummary = computed(() => {
    const count = this.pdfs().length;
    if (count === 0) return 'Keine PDFs';
    if (count === 1) return '1 PDF';
    return `${count} PDFs`;
  });

  ngOnInit(): void {
    this.loadPdfs();
  }

  protected loadPdfs(): void {
    this.loading.set(true);
    this.error.set(null);

    this.storageApi
      .getPdfs()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (pdfs) => {
          this.pdfs.set(pdfs);
          this.clearMissingSelectedPdf();
          this.verifySelectedPdf();
        },
        error: () => this.error.set('Die PDFs konnten nicht geladen werden.'),
      });
  }

  protected updateSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected selectPdf(pdf: PdfAssetResponse): void {
    this.selectedPdfId.set(pdf.id);
    if (this.isCompactStorageLayout()) {
      this.storagePanelCollapsed.set(true);
    }
    this.verifySelectedPdf();
  }

  protected toggleStoragePanel(): void {
    this.storagePanelCollapsed.update((collapsed) => !collapsed);
  }

  protected uploadSelectedPdf(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0] ?? null;
    if (input) input.value = '';
    if (!file) return;

    if (file.type !== PDF_CONTENT_TYPE) {
      this.error.set('Nur PDF-Dateien sind erlaubt.');
      return;
    }

    this.uploading.set(true);
    this.error.set(null);

    this.storageApi
      .uploadPdf(file)
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe({
        next: (pdf) => {
          this.pdfs.update((pdfs) => [pdf, ...pdfs.filter((entry) => entry.id !== pdf.id)]);
          this.selectedPdfId.set(pdf.id);
          if (this.isCompactStorageLayout()) {
            this.storagePanelCollapsed.set(true);
          }
          this.verifySelectedPdf();
        },
        error: () => this.error.set('Die PDF-Datei konnte nicht hochgeladen werden.'),
      });
  }

  protected requestDelete(pdf: PdfAssetResponse, event: Event): void {
    event.stopPropagation();
    this.deleteCandidate.set(pdf);
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteCandidate.set(null);
  }

  protected confirmDelete(): void {
    const pdf = this.deleteCandidate();
    if (!pdf) return;

    this.deleting.set(true);
    this.error.set(null);

    this.storageApi
      .deletePdf(pdf.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.pdfs.update((pdfs) => pdfs.filter((entry) => entry.id !== pdf.id));
          if (this.selectedPdfId() === pdf.id) {
            this.selectedPdfId.set(null);
          }
          this.deleteCandidate.set(null);
          this.verifySelectedPdf();
        },
        error: () => this.error.set('Die PDF-Datei konnte nicht gelöscht werden.'),
      });
  }

  protected dismissError(): void {
    this.error.set(null);
  }

  protected formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;

    const kib = size / 1024;
    if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KB`;

    const mib = kib / 1024;
    return `${mib.toFixed(mib >= 10 ? 0 : 1)} MB`;
  }

  private clearMissingSelectedPdf(): void {
    const pdfs = this.pdfs();
    const selectedId = this.selectedPdfId();
    if (!selectedId || pdfs.some((pdf) => pdf.id === selectedId)) return;

    this.selectedPdfId.set(null);
  }

  private verifySelectedPdf(): void {
    const pdf = this.selectedPdf();
    const run = ++this.pdfCheckRun;

    if (!pdf) {
      this.pdfPreviewStatus.set({ id: null, state: 'idle' });
      return;
    }

    this.pdfPreviewStatus.set({ id: pdf.id, state: 'checking' });

    this.storageApi.checkPdf(pdf.id).subscribe({
      next: () => {
        if (this.isCurrentPdfCheck(run, pdf.id)) {
          this.pdfPreviewStatus.set({ id: pdf.id, state: 'available' });
        }
      },
      error: (error: unknown) => {
        if (!this.isCurrentPdfCheck(run, pdf.id)) return;

        this.pdfPreviewStatus.set({
          id: pdf.id,
          state: isNotFoundError(error) ? 'missing' : 'error',
        });
      },
    });
  }

  private isCurrentPdfCheck(run: number, pdfId: string): boolean {
    return run === this.pdfCheckRun && this.selectedPdfId() === pdfId;
  }

  private isCompactStorageLayout(): boolean {
    return this.document.defaultView?.matchMedia(COMPACT_STORAGE_MEDIA_QUERY).matches ?? false;
  }

  private shouldUseEmbeddedPdfViewer(): boolean {
    return this.isCompactStorageLayout() || this.isIOSLikeDevice();
  }

  private isIOSLikeDevice(): boolean {
    const navigator = this.document.defaultView?.navigator;
    if (!navigator) return false;

    const userAgent = navigator.userAgent ?? '';
    const platform = navigator.platform ?? '';
    const maxTouchPoints = navigator.maxTouchPoints ?? 0;

    return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof HttpErrorResponse
    ? error.status === 404
    : typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}
