import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import type { PageResponse } from '../../../../core/models/page.model';
import type { SpaceResponse } from '../../../../core/models/space.model';
import { PageContentPipe } from '../../../../shared/pipes/page-content.pipe';

@Component({
  selector: 'bv-page-view',
  standalone: true,
  imports: [PageContentPipe],
  templateUrl: './page-view.component.html',
  styleUrl: './page-view.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageViewComponent {
  readonly page = input.required<PageResponse>();
  readonly space = input<SpaceResponse | null>(null);

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
