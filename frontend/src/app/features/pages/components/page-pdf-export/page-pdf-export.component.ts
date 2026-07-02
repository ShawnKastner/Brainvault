import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { PagesApiService } from '../../../../core/api/pages-api.service';
import type { PageResponse } from '../../../../core/models/page.model';
import { MermaidRendererDirective } from '../../../../shared/directives/mermaid-renderer.directive';
import { PageContentPipe } from '../../../../shared/pipes/page-content.pipe';

declare global {
  interface Window {
    __brainvaultPdfReady?: boolean;
  }
}

@Component({
  selector: 'bv-page-pdf-export',
  standalone: true,
  imports: [MermaidRendererDirective, PageContentPipe],
  templateUrl: './page-pdf-export.component.html',
  styleUrl: './page-pdf-export.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagePdfExportComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly pagesApi = inject(PagesApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly page = signal<PageResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  private contentRenderComplete = false;

  protected readonly mermaidRenderTrigger = computed(() => {
    const page = this.page();
    return {
      content: page?.content ?? '',
      contentFormat: page?.contentFormat ?? 'html',
    };
  });

  constructor() {
    this.setPdfReady(false);

    const pageId = this.route.snapshot.paramMap.get('pageId');
    if (!pageId) {
      this.failExport('Seite konnte nicht geladen werden.');
      return;
    }

    this.pagesApi
      .getOne(pageId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.contentRenderComplete = !page.content;
          if (!page.content) {
            void this.waitForImagesAndMarkReady();
          }
        },
        error: () => this.failExport('Seite konnte nicht geladen werden.'),
      });
  }

  protected formatDate(date: string): string {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  protected handleMermaidComplete(): void {
    this.contentRenderComplete = true;
    void this.waitForImagesAndMarkReady();
  }

  private async waitForImagesAndMarkReady(): Promise<void> {
    if (!this.page() || !this.contentRenderComplete) return;

    await this.waitForImages();
    this.setPdfReady(true);
  }

  private async waitForImages(): Promise<void> {
    const images = Array.from(this.host.nativeElement.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (image) => {
          image.loading = 'eager';

          return image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                image.addEventListener('load', () => resolve(), { once: true });
                image.addEventListener('error', () => resolve(), { once: true });
              });
        },
      ),
    );
  }

  private failExport(message: string): void {
    this.error.set(message);
    this.setPdfReady(true);
  }

  private setPdfReady(ready: boolean): void {
    window.__brainvaultPdfReady = ready;
  }
}
