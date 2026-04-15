import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { PageResponse, UpdatePageRequest } from '../../core/models/page.model';
import type { CreateSpaceRequest, SpaceWithPagesResponse } from '../../core/models/space.model';
import { SettingsService } from '../../core/services/settings.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ConfirmModalComponent } from '../../shared/ui/confirm-modal/confirm-modal.component';
import { SettingsModalComponent } from '../../shared/ui/settings-modal/settings-modal.component';
import { PageEditorComponent } from '../pages/components/page-editor/page-editor.component';
import { PageViewComponent } from '../pages/components/page-view/page-view.component';
import { KnowledgeBaseStore } from '../pages/services/knowledge-base.store';
import {
  SpaceOverviewComponent,
  type RenameSpaceRequest,
} from '../spaces/components/space-overview/space-overview.component';
import { SidebarComponent, type MovePageToSpaceRequest } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';

type DeleteDialog =
  | { kind: 'page'; page: PageResponse }
  | { kind: 'space'; space: SpaceWithPagesResponse };

@Component({
  selector: 'bv-shell',
  standalone: true,
  imports: [
    ConfirmModalComponent,
    EmptyStateComponent,
    PageEditorComponent,
    PageViewComponent,
    ReactiveFormsModule,
    SettingsModalComponent,
    SidebarComponent,
    SpaceOverviewComponent,
    TopbarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly settingsService = inject(SettingsService);

  protected readonly store = inject(KnowledgeBaseStore);
  protected readonly openSpaces = signal<Partial<Record<string, boolean>>>({});
  protected readonly editMode = signal(false);
  protected readonly showNewPage = signal(false);
  protected readonly settingsOpen = signal(false);
  protected readonly deleteDialog = signal<DeleteDialog | null>(null);

  protected readonly deleteDialogTitle = computed(() => {
    const dialog = this.deleteDialog();
    if (!dialog) return '';
    return dialog.kind === 'page' ? 'Seite löschen?' : 'Space löschen?';
  });

  protected readonly deleteDialogMessage = computed(() => {
    const dialog = this.deleteDialog();
    if (!dialog) return '';

    if (dialog.kind === 'page') {
      return `Die Seite "${dialog.page.title}" wird dauerhaft gelöscht.`;
    }

    const count = dialog.space.pages.length;
    if (count === 0) {
      return `Der Space "${dialog.space.name}" wird dauerhaft gelöscht. Er enthält keine Seiten.`;
    }
    if (count === 1) {
      return `Der Space "${dialog.space.name}" wird dauerhaft gelöscht. Eine enthaltene Seite wird ebenfalls gelöscht.`;
    }
    return `Der Space "${dialog.space.name}" wird dauerhaft gelöscht. ${count} enthaltene Seiten werden ebenfalls gelöscht.`;
  });

  protected readonly deleteDialogConfirmLabel = computed(() => {
    const dialog = this.deleteDialog();
    return dialog?.kind === 'space' ? 'Space löschen' : 'Seite löschen';
  });

  protected readonly newPageForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    spaceId: ['', Validators.required],
  });

  @ViewChild(PageEditorComponent) private pageEditor?: PageEditorComponent;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const pageId = params.get('pageId');
      const spaceId = params.get('spaceId');
      this.editMode.set(false);
      this.showNewPage.set(false);

      if (pageId) {
        this.store.selectPage(pageId);
        this.store.loadSpaces(pageId);
        return;
      }

      this.store.selectSpace(spaceId);
      if (spaceId) {
        this.openSpaces.update((spaces) => ({ ...spaces, [spaceId]: true }));
      }
      this.store.loadSpaces(null);
    });

    effect(() => {
      const spaceId = this.store.activeSpace()?.id ?? this.store.spaces()[0]?.id;
      if (spaceId && this.newPageForm.controls.spaceId.value !== spaceId) {
        this.newPageForm.controls.spaceId.setValue(spaceId, { emitEvent: false });
      }
    });
  }

  protected toggleSpace(spaceId: string): void {
    const isFirstSpace = this.store.spaces()[0]?.id === spaceId;
    const currentValue = this.openSpaces()[spaceId] ?? isFirstSpace;
    this.openSpaces.update((spaces) => ({ ...spaces, [spaceId]: !currentValue }));
  }

  protected selectPage(pageId: string): void {
    const spaceId = this.store.spaces().find((space) => space.pages.some((page) => page.id === pageId))?.id;
    if (spaceId) {
      this.openSpaces.update((spaces) => ({ ...spaces, [spaceId]: true }));
    }

    this.editMode.set(false);
    this.showNewPage.set(false);
    void this.router.navigate(['/pages', pageId]);
  }

  protected createSpace(request: CreateSpaceRequest): void {
    this.store.createSpace(request);
  }

  protected requestDeleteSpace(space: SpaceWithPagesResponse): void {
    const fullSpace = this.store.spaces().find((candidate) => candidate.id === space.id) ?? space;
    this.deleteDialog.set({ kind: 'space', space: fullSpace });
  }

  protected movePageToSpace(request: MovePageToSpaceRequest): void {
    this.openSpaces.update((spaces) => ({ ...spaces, [request.targetSpaceId]: true }));
    this.store.movePageToSpace(request.pageId, request.targetSpaceId);
  }

  protected renameSpace(request: RenameSpaceRequest): void {
    this.store.updateSpace(request.id, { name: request.name });
  }

  protected submitNewPage(): void {
    if (this.newPageForm.invalid) {
      this.newPageForm.markAllAsTouched();
      return;
    }

    const value = this.newPageForm.getRawValue();
    this.store.createPage(
      {
        title: value.title.trim(),
        spaceId: value.spaceId,
        contentFormat: 'html',
      },
      (page) => {
        this.showNewPage.set(false);
        this.newPageForm.reset({
          title: '',
          spaceId: value.spaceId,
        });
        this.editMode.set(true);
        void this.router.navigate(['/pages', page.id]);
      },
    );
  }

  protected savePage(request: UpdatePageRequest): void {
    const page = this.store.activePage();
    if (!page) return;

    this.store.updatePage(page.id, request, () => this.editMode.set(false));
  }

  protected savePageFromTopbar(): void {
    this.pageEditor?.submit();
  }

  protected deleteActivePage(): void {
    const page = this.store.activePage();
    if (!page) return;

    this.deleteDialog.set({ kind: 'page', page });
  }

  protected closeDeleteDialog(): void {
    if (this.store.saving()) return;
    this.deleteDialog.set(null);
  }

  protected confirmDelete(): void {
    const dialog = this.deleteDialog();
    if (!dialog) return;

    if (dialog.kind === 'space') {
      this.store.deleteSpace(dialog.space.id, (nextPageId) => {
        this.openSpaces.update((spaces) => {
          const { [dialog.space.id]: _deletedSpace, ...rest } = spaces;
          return rest;
        });
        this.finishDelete(nextPageId);
      });
      return;
    }

    this.store.deletePage(dialog.page.id, (nextPageId) => {
      this.finishDelete(nextPageId);
    });
  }

  private finishDelete(nextPageId: string | null): void {
    this.deleteDialog.set(null);
    this.editMode.set(false);
    this.showNewPage.set(false);
    void this.router.navigate(nextPageId ? ['/pages', nextPageId] : ['/']);
  }
}
