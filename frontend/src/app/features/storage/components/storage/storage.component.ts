import { DatePipe, DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgxExtendedPdfViewerModule, ScrollModeType } from 'ngx-extended-pdf-viewer';
import { finalize } from 'rxjs';
import { StorageApiService } from '../../../../core/api/storage-api.service';
import type { StorageFileResponse } from '../../../../core/models/storage.model';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';

const PDF_CONTENT_TYPE = 'application/pdf';
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const COMPACT_STORAGE_MEDIA_QUERY = '(max-width: 1100px)';

type FilePreviewStatus =
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
  protected readonly storageApi = inject(StorageApiService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly files = signal<StorageFileResponse[]>([]);
  protected readonly selectedFileId = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly deleteCandidate = signal<StorageFileResponse | null>(null);
  protected readonly storagePanelCollapsed = signal(false);
  protected readonly previewStatus = signal<FilePreviewStatus>({ id: null, state: 'idle' });
  protected readonly pdfScrollMode = ScrollModeType;

  private fileCheckRun = 0;

  protected readonly filteredFiles = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    return query
      ? this.files().filter((file) => file.originalName.toLowerCase().includes(query))
      : this.files();
  });

  protected readonly selectedFile = computed(() =>
    this.files().find((file) => file.id === this.selectedFileId()) ?? null,
  );

  protected readonly selectedFileIsPdf = computed(() => this.selectedFile()?.contentType === PDF_CONTENT_TYPE);

  protected readonly selectedFileUrl = computed<SafeResourceUrl | null>(() => {
    const file = this.selectedFile();
    const status = this.previewStatus();
    if (!file || status.id !== file.id || status.state !== 'available') return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.storageApi.getFileUrl(file.id));
  });

  protected readonly selectedFileViewerUrl = computed(() => {
    const file = this.selectedFile();
    const status = this.previewStatus();
    return file && status.id === file.id && status.state === 'available'
      ? this.storageApi.getFileUrl(file.id)
      : null;
  });

  protected readonly usesEmbeddedPdfViewer = computed(() =>
    this.selectedFileIsPdf() && this.pdfPreviewMode() === 'mobile-embedded-preview',
  );

  protected readonly previewChecking = computed(() => {
    const file = this.selectedFile();
    const status = this.previewStatus();
    return file !== null && status.id === file.id && status.state === 'checking';
  });

  protected readonly previewError = computed(() => {
    const file = this.selectedFile();
    const status = this.previewStatus();
    if (!file || status.id !== file.id) return null;
    if (status.state === 'missing') return 'Die Datei ist gelistet, fehlt aber im Upload-Speicher.';
    if (status.state === 'error') return 'Die Datei konnte nicht geprüft werden.';
    return null;
  });

  protected readonly storageSummary = computed(() => {
    const count = this.files().length;
    return count === 0 ? 'Keine Dateien' : count === 1 ? '1 Datei' : `${count} Dateien`;
  });

  ngOnInit(): void {
    this.loadFiles();
  }

  protected loadFiles(): void {
    this.loading.set(true);
    this.error.set(null);
    this.storageApi.getFiles().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (files) => {
        this.files.set(files);
        this.clearMissingSelection();
      },
      error: () => this.error.set('Die Dateien konnten nicht geladen werden.'),
    });
  }

  protected selectFile(file: StorageFileResponse): void {
    this.selectedFileId.set(file.id);
    if (this.isCompactStorageLayout()) this.storagePanelCollapsed.set(true);
    this.checkSelectedFile(file.id);
  }

  protected uploadSelectedFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      this.error.set('Nur PDF-, Word-, Excel- und PowerPoint-Dateien sind erlaubt.');
      return;
    }

    this.uploading.set(true);
    this.error.set(null);
    this.storageApi.uploadFile(file).pipe(finalize(() => this.uploading.set(false))).subscribe({
      next: (uploadedFile) => {
        this.files.update((files) => [uploadedFile, ...files.filter((entry) => entry.id !== uploadedFile.id)]);
        this.selectFile(uploadedFile);
      },
      error: () => this.error.set('Die Datei konnte nicht hochgeladen werden.'),
    });
  }

  protected requestDelete(file: StorageFileResponse, event: Event): void {
    event.stopPropagation();
    this.deleteCandidate.set(file);
  }

  protected cancelDelete(): void {
    if (!this.deleting()) this.deleteCandidate.set(null);
  }

  protected confirmDelete(): void {
    const file = this.deleteCandidate();
    if (!file || this.deleting()) return;
    this.deleting.set(true);
    this.error.set(null);
    this.storageApi.deleteFile(file.id).pipe(finalize(() => this.deleting.set(false))).subscribe({
      next: () => {
        this.files.update((files) => files.filter((entry) => entry.id !== file.id));
        if (this.selectedFileId() === file.id) {
          this.selectedFileId.set(null);
          this.previewStatus.set({ id: null, state: 'idle' });
        }
        this.deleteCandidate.set(null);
      },
      error: () => this.error.set('Die Datei konnte nicht gelöscht werden.'),
    });
  }

  protected updateSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected dismissError(): void {
    this.error.set(null);
  }

  protected toggleStoragePanel(): void {
    this.storagePanelCollapsed.update((collapsed) => !collapsed);
  }

  protected getFileTypeLabel(file: StorageFileResponse): string {
    const extension = file.originalName.split('.').pop()?.toUpperCase();
    return extension || 'DATEI';
  }

  protected getFileTypeClass(file: StorageFileResponse): string {
    const extension = file.originalName.split('.').pop()?.toLowerCase() ?? '';
    if (extension.startsWith('doc')) return 'word';
    if (extension.startsWith('xls')) return 'excel';
    if (extension.startsWith('ppt')) return 'powerpoint';
    return 'pdf';
  }

  protected formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private checkSelectedFile(fileId: string): void {
    const run = ++this.fileCheckRun;
    this.previewStatus.set({ id: fileId, state: 'checking' });
    this.storageApi.checkFile(fileId).subscribe({
      next: () => {
        if (this.isCurrentFileCheck(run, fileId)) this.previewStatus.set({ id: fileId, state: 'available' });
      },
      error: (error: unknown) => {
        if (!this.isCurrentFileCheck(run, fileId)) return;
        this.previewStatus.set({ id: fileId, state: isNotFoundError(error) ? 'missing' : 'error' });
      },
    });
  }

  private clearMissingSelection(): void {
    const selectedId = this.selectedFileId();
    if (!selectedId || this.files().some((file) => file.id === selectedId)) return;
    this.selectedFileId.set(null);
    this.previewStatus.set({ id: null, state: 'idle' });
  }

  private isCurrentFileCheck(run: number, fileId: string): boolean {
    return run === this.fileCheckRun && this.selectedFileId() === fileId;
  }

  private pdfPreviewMode(): PdfPreviewMode {
    return this.shouldUseEmbeddedPdfViewer() ? 'mobile-embedded-preview' : 'desktop-native-preview';
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
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof HttpErrorResponse
    ? error.status === 404
    : typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}
