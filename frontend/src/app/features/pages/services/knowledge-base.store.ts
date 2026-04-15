import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, map, switchMap, tap } from 'rxjs';
import { PagesApiService } from '../../../core/api/pages-api.service';
import { SpacesApiService } from '../../../core/api/spaces-api.service';
import type { CreatePageRequest, PageResponse, UpdatePageRequest } from '../../../core/models/page.model';
import type { CreateSpaceRequest, SpaceWithPagesResponse } from '../../../core/models/space.model';

@Injectable({ providedIn: 'root' })
export class KnowledgeBaseStore {
  private readonly pagesApi = inject(PagesApiService);
  private readonly spacesApi = inject(SpacesApiService);

  readonly spaces = signal<SpaceWithPagesResponse[]>([]);
  readonly activePageId = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly filteredSpaces = computed(() => {
    const query = normalizeSearch(this.searchQuery());
    if (!query) return this.spaces();

    return this.spaces()
      .map((space) => {
        const spaceMatches = matchesQuery([space.name, space.description], query);
        const pages = spaceMatches
          ? space.pages
          : space.pages.filter((page) =>
              matchesQuery([page.title, page.description, page.content, page.tags.join(' ')], query),
            );

        return { ...space, pages };
      })
      .filter((space) => space.pages.length > 0 || matchesQuery([space.name, space.description], query));
  });

  readonly activePage = computed(() => {
    const activeId = this.activePageId();
    if (!activeId) return null;
    return findPage(this.spaces(), activeId)?.page ?? null;
  });

  readonly activeSpace = computed(() => {
    const activeId = this.activePageId();
    if (!activeId) return null;
    return findPage(this.spaces(), activeId)?.space ?? null;
  });

  loadSpaces(preferredPageId?: string | null): void {
    this.loading.set(true);
    this.error.set(null);

    this.spacesApi
      .getAll()
      .pipe(
        tap((spaces) => this.applySpaces(spaces, preferredPageId)),
        this.catchStoreError('Die Spaces konnten nicht geladen werden.'),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  selectPage(pageId: string | null): void {
    this.activePageId.set(pageId);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  createSpace(request: CreateSpaceRequest): void {
    this.saving.set(true);
    this.error.set(null);

    this.spacesApi
      .create(request)
      .pipe(
        switchMap(() => this.spacesApi.getAll()),
        tap((spaces) => this.applySpaces(spaces)),
        this.catchStoreError('Der Space konnte nicht erstellt werden.'),
        finalize(() => this.saving.set(false)),
      )
      .subscribe();
  }

  deleteSpace(id: string, onDeleted?: (nextPageId: string | null) => void): void {
    this.saving.set(true);
    this.error.set(null);

    this.spacesApi
      .remove(id)
      .pipe(
        switchMap(() => this.spacesApi.getAll()),
        tap((spaces) => {
          this.applySpaces(spaces);
          onDeleted?.(this.activePageId());
        }),
        this.catchStoreError('Der Space konnte nicht gelöscht werden.'),
        finalize(() => this.saving.set(false)),
      )
      .subscribe();
  }

  createPage(request: CreatePageRequest, onCreated?: (page: PageResponse) => void): void {
    this.saving.set(true);
    this.error.set(null);

    this.pagesApi
      .create(request)
      .pipe(
        switchMap((page) => this.reloadWithPage(page)),
        tap(({ page }) => onCreated?.(page)),
        this.catchStoreError('Die Seite konnte nicht erstellt werden.'),
        finalize(() => this.saving.set(false)),
      )
      .subscribe();
  }

  updatePage(id: string, request: UpdatePageRequest, onUpdated?: (page: PageResponse) => void): void {
    this.saving.set(true);
    this.error.set(null);

    this.pagesApi
      .update(id, request)
      .pipe(
        switchMap((page) => this.reloadWithPage(page)),
        tap(({ page }) => onUpdated?.(page)),
        this.catchStoreError('Die Seite konnte nicht gespeichert werden.'),
        finalize(() => this.saving.set(false)),
      )
      .subscribe();
  }

  movePageToSpace(pageId: string, targetSpaceId: string): void {
    const currentSpaces = this.spaces();
    const currentPage = findPage(currentSpaces, pageId);
    const targetSpace = currentSpaces.find((space) => space.id === targetSpaceId);

    if (!currentPage || !targetSpace || currentPage.space.id === targetSpaceId) return;

    const preferredPageId = this.activePageId();
    this.saving.set(true);
    this.error.set(null);

    this.pagesApi
      .update(pageId, {
        spaceId: targetSpaceId,
        sortOrder: getNextSortOrder(targetSpace),
      })
      .pipe(
        switchMap(() => this.spacesApi.getAll()),
        tap((spaces) => this.applySpaces(spaces, preferredPageId)),
        this.catchStoreError('Die Seite konnte nicht verschoben werden.'),
        finalize(() => this.saving.set(false)),
      )
      .subscribe();
  }

  deletePage(id: string, onDeleted?: (nextPageId: string | null) => void): void {
    this.saving.set(true);
    this.error.set(null);

    this.pagesApi
      .remove(id)
      .pipe(
        switchMap(() => this.spacesApi.getAll()),
        tap((spaces) => {
          this.spaces.set(spaces);
          const nextPageId = getFirstPageId(spaces);
          this.activePageId.set(nextPageId);
          onDeleted?.(nextPageId);
        }),
        this.catchStoreError('Die Seite konnte nicht gelöscht werden.'),
        finalize(() => this.saving.set(false)),
      )
      .subscribe();
  }

  dismissError(): void {
    this.error.set(null);
  }

  private reloadWithPage(page: PageResponse): Observable<{ page: PageResponse; spaces: SpaceWithPagesResponse[] }> {
    return this.spacesApi.getAll().pipe(
      map((spaces) => ({ page, spaces })),
      tap(({ spaces }) => this.applySpaces(spaces, page.id)),
    );
  }

  private applySpaces(spaces: SpaceWithPagesResponse[], preferredPageId?: string | null): void {
    this.spaces.set(spaces);

    if (preferredPageId !== undefined) {
      this.activePageId.set(preferredPageId);
      return;
    }

    const currentPageId = this.activePageId();
    if (currentPageId && findPage(spaces, currentPageId)) return;

    this.activePageId.set(getFirstPageId(spaces));
  }

  private catchStoreError<T>(message: string) {
    return (source: Observable<T>): Observable<T> =>
      source.pipe(
        catchError((error: unknown) => {
          this.error.set(`${message} ${readErrorMessage(error)}`.trim());
          return EMPTY;
        }),
      );
  }
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(values: Array<string | null | undefined>, query: string): boolean {
  return values.some((value) => value?.toLowerCase().includes(query));
}

function findPage(spaces: SpaceWithPagesResponse[], pageId: string) {
  for (const space of spaces) {
    const page = space.pages.find((candidate) => candidate.id === pageId);
    if (page) return { space, page };
  }
  return null;
}

function getFirstPageId(spaces: SpaceWithPagesResponse[]): string | null {
  return spaces.find((space) => space.pages.length > 0)?.pages[0]?.id ?? null;
}

function getNextSortOrder(space: SpaceWithPagesResponse): number {
  if (space.pages.length === 0) return 0;
  return Math.max(...space.pages.map((page) => page.sortOrder)) + 1;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
    return error.error.message;
  }
  if (error instanceof HttpErrorResponse && Array.isArray(error.error?.message)) {
    return error.error.message.join(' ');
  }
  return '';
}
