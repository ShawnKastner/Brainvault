import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { SpaceWithPagesResponse } from '../../../../core/models/space.model';

export interface RenameSpaceRequest {
  id: string;
  name: string;
}

@Component({
  selector: 'bv-space-overview',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './space-overview.component.html',
  styleUrl: './space-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceOverviewComponent {
  readonly space = input.required<SpaceWithPagesResponse>();
  readonly saving = input(false);

  readonly selectPage = output<string>();
  readonly renameSpace = output<RenameSpaceRequest>();

  protected readonly renaming = signal(false);
  protected readonly renameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });

  protected readonly documentCountLabel = computed(() => {
    const count = this.space().pages.length;
    if (count === 0) return 'Keine Dokumente';
    if (count === 1) return '1 Dokument';
    return `${count} Dokumente`;
  });

  @ViewChild('renameInput') private renameInput?: ElementRef<HTMLInputElement>;

  startRename(): void {
    if (this.saving() || this.renaming()) return;

    this.renameControl.setValue(this.space().name);
    this.renameControl.markAsPristine();
    this.renaming.set(true);

    setTimeout(() => {
      this.renameInput?.nativeElement.focus();
      this.renameInput?.nativeElement.select();
    });
  }

  submitRename(): void {
    if (!this.renaming() || this.saving()) return;

    const name = this.renameControl.value.trim();
    if (!name || name === this.space().name) {
      this.cancelRename();
      return;
    }

    if (this.renameControl.invalid) {
      this.renameControl.markAsTouched();
      return;
    }

    this.renameSpace.emit({ id: this.space().id, name });
    this.renaming.set(false);
  }

  cancelRename(): void {
    this.renaming.set(false);
    this.renameControl.setValue(this.space().name);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
