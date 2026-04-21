import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { finalize } from 'rxjs';
import { StorageApiService } from '../../../../core/api/storage-api.service';
import type { PdfAssetResponse } from '../../../../core/models/storage.model';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';

const PDF_CONTENT_TYPE = 'application/pdf';

@Component({
  selector: 'bv-storage',
  standalone: true,
  imports: [ConfirmModalComponent, DatePipe],
  templateUrl: './storage.component.html',
  styleUrl: './storage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorageComponent implements OnInit {
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
    if (!pdf) return null;

    return this.sanitizer.bypassSecurityTrustResourceUrl(this.storageApi.getPdfUrl(pdf.id));
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
          this.ensureSelectedPdf();
        },
        error: () => this.error.set('Die PDFs konnten nicht geladen werden.'),
      });
  }

  protected updateSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected selectPdf(pdf: PdfAssetResponse): void {
    this.selectedPdfId.set(pdf.id);
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
            this.selectedPdfId.set(this.pdfs()[0]?.id ?? null);
          }
          this.deleteCandidate.set(null);
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

  private ensureSelectedPdf(): void {
    const pdfs = this.pdfs();
    const selectedId = this.selectedPdfId();
    if (selectedId && pdfs.some((pdf) => pdf.id === selectedId)) return;

    this.selectedPdfId.set(pdfs[0]?.id ?? null);
  }
}
