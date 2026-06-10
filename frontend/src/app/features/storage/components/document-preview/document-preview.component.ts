import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgxExtendedPdfViewerModule, ScrollModeType } from 'ngx-extended-pdf-viewer';
import type { StorageFileResponse } from '../../../../core/models/storage.model';
import {
  StoragePreviewService,
  type DocumentPreviewState,
} from '../../services/storage-preview.service';

const PDF_CONTENT_TYPE = 'application/pdf';
const COMPACT_STORAGE_MEDIA_QUERY = '(max-width: 1100px)';

@Component({
  selector: 'bv-document-preview',
  standalone: true,
  imports: [NgxExtendedPdfViewerModule],
  templateUrl: './document-preview.component.html',
  styleUrl: './document-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPreviewComponent {
  readonly file = input.required<StorageFileResponse>();

  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly previews = inject(StoragePreviewService);
  private readonly retryRun = signal(0);

  protected readonly state = signal<DocumentPreviewState>({ state: 'checking' });
  protected readonly pdfScrollMode = ScrollModeType;

  protected readonly usesEmbeddedPdfViewer = computed(
    () => this.isCompactStorageLayout() || this.isIOSLikeDevice(),
  );

  protected readonly safeViewerUrl = computed<SafeResourceUrl | null>(() => {
    const state = this.state();
    return state.state === 'ready'
      ? this.sanitizer.bypassSecurityTrustResourceUrl(state.url)
      : null;
  });

  protected readonly directViewerUrl = computed(() => {
    const state = this.state();
    return state.state === 'ready' ? state.url : null;
  });

  protected readonly isConvertedOfficePreview = computed(
    () => this.file().contentType !== PDF_CONTENT_TYPE,
  );

  protected readonly failedErrorCode = computed(() => {
    const state = this.state();
    return state.state === 'failed' ? state.errorCode : null;
  });

  constructor() {
    effect((onCleanup) => {
      const file = this.file();
      this.retryRun();
      this.state.set({ state: 'checking' });
      const subscription = this.previews.watch(file).subscribe((state) => this.state.set(state));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected retry(): void {
    this.retryRun.update((run) => run + 1);
  }

  protected errorMessage(errorCode: string | null): string {
    switch (errorCode) {
      case 'password_protected':
        return 'Passwortgeschützte Dateien können nicht als Vorschau angezeigt werden.';
      case 'invalid_document':
        return 'Die Datei ist beschädigt oder enthält kein gültiges Office-Dokument.';
      case 'unsupported_document':
        return 'Dieses Dokument kann nicht konvertiert werden.';
      case 'conversion_timeout':
        return 'Die Konvertierung hat zu lange gedauert.';
      case 'preview_too_large':
        return 'Die erzeugte Vorschau überschreitet das Größenlimit.';
      default:
        return 'Die Vorschau konnte nicht erstellt werden.';
    }
  }

  private isCompactStorageLayout(): boolean {
    return this.document.defaultView?.matchMedia(COMPACT_STORAGE_MEDIA_QUERY).matches ?? false;
  }

  private isIOSLikeDevice(): boolean {
    const navigator = this.document.defaultView?.navigator;
    if (!navigator) return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
}
