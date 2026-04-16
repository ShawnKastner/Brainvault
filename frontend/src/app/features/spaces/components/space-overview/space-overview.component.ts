import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { CreateSpaceRequest, SpaceWithPagesResponse } from '../../../../core/models/space.model';

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
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly space = input.required<SpaceWithPagesResponse>();
  readonly saving = input(false);

  readonly selectPage = output<string>();
  readonly selectSpace = output<string>();
  readonly renameSpace = output<RenameSpaceRequest>();
  readonly createSubspace = output<CreateSpaceRequest>();

  protected readonly renaming = signal(false);
  protected readonly creatingSubspace = signal(false);
  protected readonly renameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });
  protected readonly subspaceForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    color: ['#378ADD', Validators.required],
  });

  protected readonly documentCountLabel = computed(() => {
    const pageCount = this.space().pages.length;
    const childCount = this.space().children.length;
    return `${formatDocumentCount(pageCount)} · ${formatSubspaceCount(childCount)}`;
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

  startCreateSubspace(): void {
    if (this.saving()) return;

    this.subspaceForm.reset({ name: '', color: this.space().color });
    this.creatingSubspace.set(true);
  }

  submitSubspace(): void {
    if (!this.creatingSubspace() || this.saving()) return;

    if (this.subspaceForm.invalid) {
      this.subspaceForm.markAllAsTouched();
      return;
    }

    const value = this.subspaceForm.getRawValue();
    this.createSubspace.emit({
      name: value.name.trim(),
      color: value.color,
      parentId: this.space().id,
    });
    this.cancelCreateSubspace();
  }

  cancelCreateSubspace(): void {
    this.creatingSubspace.set(false);
    this.subspaceForm.reset({ name: '', color: '#378ADD' });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}

function formatDocumentCount(count: number): string {
  if (count === 0) return 'Keine Dokumente';
  if (count === 1) return '1 Dokument';
  return `${count} Dokumente`;
}

function formatSubspaceCount(count: number): string {
  if (count === 0) return 'Keine Unterspaces';
  if (count === 1) return '1 Unterspace';
  return `${count} Unterspaces`;
}
