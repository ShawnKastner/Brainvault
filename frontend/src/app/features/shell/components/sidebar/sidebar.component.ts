import { ChangeDetectionStrategy, Component, input, output, signal, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { CreateSpaceRequest, SpaceWithPagesResponse } from '../../../../core/models/space.model';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';

@Component({
  selector: 'bv-sidebar',
  standalone: true,
  imports: [ReactiveFormsModule, LoadingStateComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly spaces = input.required<SpaceWithPagesResponse[]>();
  readonly loading = input(false);
  readonly saving = input(false);
  readonly openSpaces = input<Partial<Record<string, boolean>>>({});
  readonly activePageId = input<string | null>(null);
  readonly searchQuery = input('');

  readonly selectPage = output<string>();
  readonly toggleSpace = output<string>();
  readonly searchQueryChange = output<string>();
  readonly createSpace = output<CreateSpaceRequest>();
  readonly deleteSpace = output<SpaceWithPagesResponse>();

  readonly showNewSpace = signal(false);
  readonly spaceForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    color: ['#378ADD', Validators.required],
  });

  submitSpace(): void {
    if (this.spaceForm.invalid) {
      this.spaceForm.markAllAsTouched();
      return;
    }

    const value = this.spaceForm.getRawValue();
    this.createSpace.emit({
      name: value.name.trim(),
      color: value.color,
    });
    this.spaceForm.reset({ name: '', color: '#378ADD' });
    this.showNewSpace.set(false);
  }

  updateSearch(event: Event): void {
    this.searchQueryChange.emit((event.target as HTMLInputElement).value);
  }

  requestDeleteSpace(space: SpaceWithPagesResponse, event: Event): void {
    event.stopPropagation();
    this.deleteSpace.emit(space);
  }
}
