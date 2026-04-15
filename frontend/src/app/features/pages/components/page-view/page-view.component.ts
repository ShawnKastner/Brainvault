import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import type { PageResponse } from '../../../../core/models/page.model';
import type { SpaceResponse } from '../../../../core/models/space.model';
import { SettingsService } from '../../../../core/services/settings.service';
import { MermaidRendererDirective } from '../../../../shared/directives/mermaid-renderer.directive';
import { PageContentPipe } from '../../../../shared/pipes/page-content.pipe';
import { calculateReadingStats } from '../../../../shared/utils/reading-stats';

@Component({
  selector: 'bv-page-view',
  standalone: true,
  imports: [PageContentPipe, MermaidRendererDirective],
  templateUrl: './page-view.component.html',
  styleUrl: './page-view.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageViewComponent {
  private readonly settingsService = inject(SettingsService);

  readonly page = input.required<PageResponse>();
  readonly space = input<SpaceResponse | null>(null);

  protected readonly showReadingStats = computed(() => this.settingsService.settings().showReadingStats);
  protected readonly mermaidRenderTrigger = computed(() => ({
    content: this.page().content,
    contentFormat: this.page().contentFormat,
    theme: this.settingsService.theme(),
  }));

  protected readonly readingStats = computed(() => {
    const page = this.page();
    return calculateReadingStats(page.content, page.contentFormat);
  });

  protected readonly wordCountLabel = computed(() => {
    const count = this.readingStats().wordCount;
    return count === 1 ? '1 Wort' : `${count} Wörter`;
  });

  protected readonly readingTimeLabel = computed(() => {
    const minutes = this.readingStats().readingTimeMinutes;
    if (minutes === 0) return '0 Min. Lesezeit';
    if (minutes === 1) return 'ca. 1 Min. Lesezeit';
    return `ca. ${minutes} Min. Lesezeit`;
  });

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
