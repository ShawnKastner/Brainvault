import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
import { StorageComponent } from '../storage/components/storage/storage.component';
import { SidebarComponent, type MovePageToSpaceRequest } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';

type DeleteDialog =
  | { kind: 'page'; page: PageResponse }
  | { kind: 'space'; space: SpaceWithPagesResponse };

export const SIDEBAR_CLOSED_SPACES_STORAGE_KEY = 'brainvault.sidebar.closedSpaces.v1';
export const COMPACT_SHELL_MEDIA_QUERY = '(max-width: 860px)';

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
    StorageComponent,
    TopbarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly settingsService = inject(SettingsService);

  protected readonly store = inject(KnowledgeBaseStore);
  protected readonly openSpaces = signal<Partial<Record<string, boolean>>>(
    this.readClosedSpaceOverrides(),
  );
  protected readonly editMode = signal(false);
  protected readonly showNewPage = signal(false);
  protected readonly storageActive = signal(false);
  protected readonly compactLayout = signal(false);
  protected readonly mobileNavOpen = signal(false);
  protected readonly settingsOpen = signal(false);
  protected readonly deleteDialog = signal<DeleteDialog | null>(null);

  private compactLayoutMediaQuery: MediaQueryList | null = null;
  private readonly handleCompactLayoutChange = (event: MediaQueryListEvent) => {
    this.compactLayout.set(event.matches);
    if (!event.matches) {
      this.mobileNavOpen.set(false);
    }
  };

  protected readonly activeSidebarSpaceId = computed(() =>
    this.store.activePageId() ? null : (this.store.activeSpace()?.id ?? null),
  );

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

    const pageCount = countPagesInSpaceTree(dialog.space);
    const childCount = countDescendantSpaces(dialog.space);
    if (pageCount === 0 && childCount === 0) {
      return `Der Space "${dialog.space.name}" wird dauerhaft gelöscht. Er enthält keine Seiten.`;
    }
    if (pageCount === 1 && childCount === 0) {
      return `Der Space "${dialog.space.name}" wird dauerhaft gelöscht. Eine enthaltene Seite wird ebenfalls gelöscht.`;
    }
    const affected = [
      pageCount > 0 ? (pageCount === 1 ? 'eine enthaltene Seite' : `${pageCount} enthaltene Seiten`) : null,
      childCount > 0 ? (childCount === 1 ? 'ein Unterspace' : `${childCount} Unterspaces`) : null,
    ].filter((value): value is string => value !== null);
    return `Der Space "${dialog.space.name}" wird dauerhaft gelöscht. ${affected.join(' und ')} werden ebenfalls gelöscht.`;
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
    this.initializeCompactLayout();

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const pageId = params.get('pageId');
      const spaceId = params.get('spaceId');
      const storageActive = this.isStorageRoute();
      this.closeMobileNavigation();
      this.editMode.set(false);
      this.showNewPage.set(false);
      this.storageActive.set(storageActive);

      if (storageActive) {
        this.store.selectPage(null);
        this.store.selectSpace(null);
        this.store.loadSpaces(null);
        return;
      }

      if (pageId) {
        this.store.selectPage(pageId);
        this.store.loadSpaces(pageId);
        return;
      }

      this.store.selectSpace(spaceId);
      if (spaceId) {
        this.openSpaceIds([spaceId]);
      }
      this.store.loadSpaces(null);
    });

    effect(() => {
      this.writeClosedSpaceOverrides(this.openSpaces());
    });

    effect(() => {
      const spaceId = this.store.activeSpace()?.id ?? this.store.flattenedSpaces()[0]?.space.id;
      if (spaceId && this.newPageForm.controls.spaceId.value !== spaceId) {
        this.newPageForm.controls.spaceId.setValue(spaceId, { emitEvent: false });
      }
    });
  }

  ngOnDestroy(): void {
    this.compactLayoutMediaQuery?.removeEventListener('change', this.handleCompactLayoutChange);
  }

  protected toggleSpace(spaceId: string): void {
    const currentValue = this.openSpaces()[spaceId] ?? true;
    this.setSpaceOpen(spaceId, !currentValue);
  }

  protected toggleMobileNavigation(): void {
    if (!this.compactLayout()) return;

    this.mobileNavOpen.update((open) => !open);
  }

  protected closeMobileNavigation(): void {
    this.mobileNavOpen.set(false);
  }

  protected selectSpace(spaceId: string): void {
    this.openSpacePath(spaceId);
    this.closeMobileNavigation();
    this.storageActive.set(false);
    this.editMode.set(false);
    this.showNewPage.set(false);
    void this.router.navigate(['/spaces', spaceId]);
  }

  protected selectPage(pageId: string): void {
    const spaceEntry = this.store
      .flattenedSpaces()
      .find((entry) => entry.space.pages.some((page) => page.id === pageId));
    if (spaceEntry) {
      this.openSpaceIds(spaceEntry.path.map((space) => space.id));
    }

    this.closeMobileNavigation();
    this.storageActive.set(false);
    this.editMode.set(false);
    this.showNewPage.set(false);
    void this.router.navigate(['/pages', pageId]);
  }

  protected selectStorage(): void {
    this.closeMobileNavigation();
    this.storageActive.set(true);
    this.editMode.set(false);
    this.showNewPage.set(false);
    this.store.selectPage(null);
    this.store.selectSpace(null);
    void this.router.navigate(['/storage']);
  }

  protected createSpace(request: CreateSpaceRequest): void {
    this.store.createSpace(request, (space) => {
      this.openSpaceIds(this.store.activeSpacePath().map((entry) => entry.id));
      void this.router.navigate(['/spaces', space.id]);
    });
  }

  protected requestDeleteSpace(space: SpaceWithPagesResponse): void {
    const fullSpace = this.store.allSpaces().find((candidate) => candidate.id === space.id) ?? space;
    this.deleteDialog.set({ kind: 'space', space: fullSpace });
  }

  protected movePageToSpace(request: MovePageToSpaceRequest): void {
    this.openSpacePath(request.targetSpaceId);
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

  protected openSettings(): void {
    this.closeMobileNavigation();
    this.settingsOpen.set(true);
  }

  protected confirmDelete(): void {
    const dialog = this.deleteDialog();
    if (!dialog) return;

    if (dialog.kind === 'space') {
      this.store.deleteSpace(dialog.space.id, (nextPageId) => {
        this.openSpaceIds(getSpaceTreeIds(dialog.space));
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

  @HostListener('document:keydown.escape')
  protected handleEscapeKey(): void {
    if (this.mobileNavOpen()) {
      this.closeMobileNavigation();
    }
  }

  private isStorageRoute(): boolean {
    return this.route.snapshot.routeConfig?.path === 'storage';
  }

  private openSpacePath(spaceId: string): void {
    const entry = this.store.flattenedSpaces().find((candidate) => candidate.space.id === spaceId);
    if (!entry) return;

    this.openSpaceIds(entry.path.map((space) => space.id));
  }

  private setSpaceOpen(spaceId: string, open: boolean): void {
    this.openSpaces.update((spaces) => {
      const { [spaceId]: _currentSpace, ...rest } = spaces;
      return open ? rest : { ...rest, [spaceId]: false };
    });
  }

  private openSpaceIds(spaceIds: string[]): void {
    this.openSpaces.update((spaces) => removeSpaceIds(spaces, spaceIds));
  }

  private readClosedSpaceOverrides(): Partial<Record<string, boolean>> {
    const storage = this.getLocalStorage();
    if (!storage) return {};

    try {
      const raw = storage.getItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY);
      if (!raw) return {};

      return normalizeClosedSpaceOverrides(JSON.parse(raw) as unknown);
    } catch {
      return {};
    }
  }

  private writeClosedSpaceOverrides(spaces: Partial<Record<string, boolean>>): void {
    const storage = this.getLocalStorage();
    if (!storage) return;

    const closedSpaceIds = Object.entries(spaces)
      .filter(([, open]) => open === false)
      .map(([spaceId]) => spaceId);

    try {
      if (closedSpaceIds.length === 0) {
        storage.removeItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY);
        return;
      }

      storage.setItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY, JSON.stringify(closedSpaceIds));
    } catch {
      // Sidebar state is a local preference and should never block navigation.
    }
  }

  private getLocalStorage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private initializeCompactLayout(): void {
    const mediaQuery = this.document.defaultView?.matchMedia(COMPACT_SHELL_MEDIA_QUERY);
    if (!mediaQuery) return;

    this.compactLayoutMediaQuery = mediaQuery;
    this.compactLayout.set(mediaQuery.matches);
    mediaQuery.addEventListener('change', this.handleCompactLayoutChange);
  }
}

function countPagesInSpaceTree(space: SpaceWithPagesResponse): number {
  return space.pages.length + space.children.reduce((sum, child) => sum + countPagesInSpaceTree(child), 0);
}

function countDescendantSpaces(space: SpaceWithPagesResponse): number {
  return space.children.length + space.children.reduce((sum, child) => sum + countDescendantSpaces(child), 0);
}

function getSpaceTreeIds(space: SpaceWithPagesResponse): string[] {
  return [space.id, ...space.children.flatMap((child) => getSpaceTreeIds(child))];
}

function removeSpaceIds(
  spaces: Partial<Record<string, boolean>>,
  spaceIds: string[],
): Partial<Record<string, boolean>> {
  let changed = false;
  const nextSpaces = { ...spaces };

  for (const spaceId of spaceIds) {
    if (spaceId in nextSpaces) {
      delete nextSpaces[spaceId];
      changed = true;
    }
  }

  return changed ? nextSpaces : spaces;
}

function normalizeClosedSpaceOverrides(value: unknown): Partial<Record<string, boolean>> {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter((spaceId): spaceId is string => typeof spaceId === 'string')
        .map((spaceId) => [spaceId, false]),
    );
  }

  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, false] => typeof entry[0] === 'string' && entry[1] === false,
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
