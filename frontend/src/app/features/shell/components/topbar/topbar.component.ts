import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PageResponse } from '../../../../core/models/page.model';
import type { SpaceResponse } from '../../../../core/models/space.model';

@Component({
  selector: 'bv-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {
  readonly activeSpacePath = input<SpaceResponse[]>([]);
  readonly activePage = input<PageResponse | null>(null);
  readonly editMode = input(false);
  readonly saving = input(false);
  readonly storageActive = input(false);

  readonly showCreatePage = output<void>();
  readonly startEdit = output<void>();
  readonly deletePage = output<void>();
  readonly cancelEdit = output<void>();
  readonly savePage = output<void>();
}
