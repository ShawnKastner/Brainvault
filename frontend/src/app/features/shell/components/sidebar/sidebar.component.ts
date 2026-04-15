import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  input,
  output,
  signal,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { PageResponse } from '../../../../core/models/page.model';
import type { CreateSpaceRequest, SpaceWithPagesResponse } from '../../../../core/models/space.model';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';

export interface MovePageToSpaceRequest {
  pageId: string;
  targetSpaceId: string;
}

interface PendingPageDrag {
  pageId: string;
  sourceSpaceId: string;
  title: string;
  pointerId: number;
  x: number;
  y: number;
}

interface DragPreview {
  title: string;
  x: number;
  y: number;
}

@Component({
  selector: 'bv-sidebar',
  standalone: true,
  imports: [ReactiveFormsModule, LoadingStateComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnDestroy {
  private static readonly longPressDelayMs = 450;

  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly spaces = input.required<SpaceWithPagesResponse[]>();
  readonly loading = input(false);
  readonly saving = input(false);
  readonly dragDisabled = input(false);
  readonly openSpaces = input<Partial<Record<string, boolean>>>({});
  readonly activePageId = input<string | null>(null);
  readonly searchQuery = input('');

  readonly selectPage = output<string>();
  readonly toggleSpace = output<string>();
  readonly searchQueryChange = output<string>();
  readonly createSpace = output<CreateSpaceRequest>();
  readonly deleteSpace = output<SpaceWithPagesResponse>();
  readonly movePageToSpace = output<MovePageToSpaceRequest>();
  readonly openSettings = output<void>();

  readonly showNewSpace = signal(false);
  readonly draggingPage = signal<PendingPageDrag | null>(null);
  readonly dragPreview = signal<DragPreview | null>(null);
  readonly dropTargetSpaceId = signal<string | null>(null);
  readonly spaceForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    color: ['#378ADD', Validators.required],
  });

  private pendingDrag: PendingPageDrag | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressNextClick = false;

  private readonly handlePointerMove = (event: PointerEvent) => this.onWindowPointerMove(event);
  private readonly handlePointerUp = (event: PointerEvent) => this.onWindowPointerUp(event);
  private readonly handlePointerCancel = (event: PointerEvent) => this.cancelPointerInteraction(event);

  ngOnDestroy(): void {
    this.finishPointerInteraction();
  }

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

  selectPageFromClick(pageId: string, event: MouseEvent): void {
    if (this.suppressNextClick) {
      event.preventDefault();
      event.stopPropagation();
      this.suppressNextClick = false;
      return;
    }

    this.selectPage.emit(pageId);
  }

  startPagePointer(page: PageResponse, sourceSpaceId: string, event: PointerEvent): void {
    if (!this.canStartPageDrag(event)) return;

    this.pendingDrag = {
      pageId: page.id,
      sourceSpaceId,
      title: page.title,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };

    this.addPointerListeners();
    this.longPressTimer = setTimeout(() => {
      this.beginPageDrag();
    }, SidebarComponent.longPressDelayMs);
  }

  private canStartPageDrag(event: PointerEvent): boolean {
    return (
      this.pendingDrag === null &&
      event.isPrimary &&
      event.button === 0 &&
      !this.saving() &&
      !this.dragDisabled()
    );
  }

  private beginPageDrag(): void {
    if (!this.pendingDrag) return;
    if (this.saving() || this.dragDisabled()) {
      this.finishPointerInteraction();
      return;
    }

    this.suppressNextClick = true;
    this.draggingPage.set(this.pendingDrag);
    this.dragPreview.set({
      title: this.pendingDrag.title,
      x: this.pendingDrag.x,
      y: this.pendingDrag.y,
    });
    this.updateDropTarget(this.pendingDrag.x, this.pendingDrag.y);
  }

  private onWindowPointerMove(event: PointerEvent): void {
    if (!this.pendingDrag || this.pendingDrag.pointerId !== event.pointerId) return;

    this.pendingDrag = {
      ...this.pendingDrag,
      x: event.clientX,
      y: event.clientY,
    };

    if (!this.draggingPage()) return;

    event.preventDefault();
    this.dragPreview.set({
      title: this.pendingDrag.title,
      x: event.clientX,
      y: event.clientY,
    });
    this.updateDropTarget(event.clientX, event.clientY);
  }

  private onWindowPointerUp(event: PointerEvent): void {
    if (!this.pendingDrag || this.pendingDrag.pointerId !== event.pointerId) return;

    const draggedPage = this.draggingPage();
    if (draggedPage) {
      event.preventDefault();
      this.updateDropTarget(event.clientX, event.clientY);
      const targetSpaceId = this.dropTargetSpaceId();
      if (targetSpaceId && targetSpaceId !== draggedPage.sourceSpaceId) {
        this.movePageToSpace.emit({ pageId: draggedPage.pageId, targetSpaceId });
      }
    }

    this.finishPointerInteraction(draggedPage !== null);
  }

  private cancelPointerInteraction(event: PointerEvent): void {
    if (!this.pendingDrag || this.pendingDrag.pointerId !== event.pointerId) return;

    this.finishPointerInteraction(this.draggingPage() !== null);
  }

  private updateDropTarget(x: number, y: number): void {
    const sourceSpaceId = this.draggingPage()?.sourceSpaceId;
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-space-drop-target]');
    const targetSpaceId = element?.dataset['spaceId'] ?? null;

    this.dropTargetSpaceId.set(targetSpaceId && targetSpaceId !== sourceSpaceId ? targetSpaceId : null);
  }

  private addPointerListeners(): void {
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerCancel);
  }

  private removePointerListeners(): void {
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);
  }

  private finishPointerInteraction(dragWasActive = false): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    this.pendingDrag = null;
    this.draggingPage.set(null);
    this.dragPreview.set(null);
    this.dropTargetSpaceId.set(null);
    this.removePointerListeners();

    if (dragWasActive) {
      setTimeout(() => {
        this.suppressNextClick = false;
      });
    }
  }
}
