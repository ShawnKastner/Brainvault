import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, map, switchMap, tap } from 'rxjs';
import { PagesApiService } from '../../../core/api/pages-api.service';
import { SpacesApiService } from '../../../core/api/spaces-api.service';
import type { CreatePageRequest, PageResponse, UpdatePageRequest } from '../../../core/models/page.model';
import type {
  CreateSpaceRequest,
  SpaceWithPagesResponse,
  UpdateSpaceRequest,
} from '../../../core/models/space.model';

export interface FlattenedSpace {
  space: SpaceWithPagesResponse;
  depth: number;
  path: SpaceWithPagesResponse[];
}

@Injectable({ providedIn: 'root' })
export class KnowledgeBaseStore {
  private readonly pagesApi = inject(PagesApiService);
  private readonly spacesApi = inject(SpacesApiService);

  readonly spaces = signal<SpaceWithPagesResponse[]>([]);
  readonly activePageId = signal<string | null>(null);
  readonly activeSpaceId = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly flattenedSpaces = computed(() => flattenSpaces(this.spaces()));
  readonly allSpaces = computed(() => this.flattenedSpaces().map((entry) => entry.space));

  readonly filteredSpaces = computed(() => {
    const query = normalizeSearch(this.searchQuery());
    if (!query) return this.spaces();

    return this.spaces()
      .map((space) => filterSpaceTree(space, query))
      .filter((space): space is SpaceWithPagesResponse => space !== null);
  });

  readonly activePage = computed(() => {
    const activeId = this.activePageId();
    if (!activeId) return null;
    return findPage(this.spaces(), activeId)?.page ?? null;
  });

  readonly activeSpacePath = computed(() => {
    const activePageId = this.activePageId();
    if (activePageId) return findPage(this.spaces(), activePageId)?.path ?? [];

    const activeSpaceId = this.activeSpaceId();
    if (!activeSpaceId) return [];
    return findSpacePath(this.spaces(), activeSpaceId) ?? [];
  });

  readonly activeSpace = computed(() => {
    const path = this.activeSpacePath();
    return path[path.length - 1] ?? null;
  });

  loadSpaces(preferredPageId?: string | null): void {
    this.loading.set(true);
    this.error.set(null);

    this.spacesApi
      .getAll()
      .pipe(
        tap((spaces) => this.applySpaces(spaces, { preferredPageId })),
        this.catchStoreError('Die Spaces konnten nicht geladen werden.'),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  selectPage(pageId: string | null): void {
    this.activePageId.set(pageId);
    if (pageId) {
      this.activeSpaceId.set(null);
    }
  }

  selectSpace(spaceId: string | null): void {
    this.activeSpaceId.set(spaceId);
    this.activePageId.set(null);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  createSpace(request: CreateSpaceRequest, onCreated?: (space: SpaceWithPagesResponse) => void): void {
    this.saving.set(true);
    this.error.set(null);

    this.spacesApi
      .create(request)
      .pipe(
        switchMap((created) =>
          this.spacesApi.getAll().pipe(map((spaces) => ({ created, spaces }))),
        ),
        tap(({ created, spaces }) => {
          this.applySpaces(spaces, { preferredSpaceId: created.id });
          onCreated?.(findSpace(this.spaces(), created.id) ?? created);
        }),
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

  updateSpace(id: string, request: UpdateSpaceRequest): void {
    this.saving.set(true);
    this.error.set(null);

    this.spacesApi
      .update(id, request)
      .pipe(
        switchMap(() => this.spacesApi.getAll()),
        tap((spaces) =>
          this.applySpaces(spaces, {
            preferredPageId: this.activePageId(),
            preferredSpaceId: this.activeSpaceId(),
          }),
        ),
        this.catchStoreError('Der Space konnte nicht gespeichert werden.'),
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
    const targetSpace = findSpace(currentSpaces, targetSpaceId);

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
        tap((spaces) => this.applySpaces(spaces, { preferredPageId })),
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
          this.applySpaces(spaces);
          const nextPageId = this.activePageId();
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
      tap(({ spaces }) => this.applySpaces(spaces, { preferredPageId: page.id })),
    );
  }

  private applySpaces(
    spaces: SpaceWithPagesResponse[],
    options: { preferredPageId?: string | null; preferredSpaceId?: string | null } = {},
  ): void {
    this.spaces.set(spaces);

    if (options.preferredPageId !== undefined) {
      this.activePageId.set(options.preferredPageId);
      if (options.preferredPageId) {
        this.activeSpaceId.set(null);
      }
      return;
    }

    if (options.preferredSpaceId !== undefined && options.preferredSpaceId !== null) {
      if (findSpace(spaces, options.preferredSpaceId)) {
        this.activeSpaceId.set(options.preferredSpaceId);
        this.activePageId.set(null);
        return;
      }
    }

    const currentPageId = this.activePageId();
    if (currentPageId && findPage(spaces, currentPageId)) return;

    const currentSpaceId = this.activeSpaceId();
    if (currentSpaceId && findSpace(spaces, currentSpaceId)) {
      this.activePageId.set(null);
      return;
    }

    this.activeSpaceId.set(null);
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

function filterSpaceTree(space: SpaceWithPagesResponse, query: string): SpaceWithPagesResponse | null {
  const spaceMatches = matchesQuery([space.name, space.description], query);
  if (spaceMatches) return space;

  const pages = space.pages.filter((page) =>
    matchesQuery([page.title, page.description, page.content, page.tags.join(' ')], query),
  );
  const children = space.children
    .map((child) => filterSpaceTree(child, query))
    .filter((child): child is SpaceWithPagesResponse => child !== null);

  if (pages.length === 0 && children.length === 0) return null;
  return { ...space, pages, children };
}

function flattenSpaces(
  spaces: SpaceWithPagesResponse[],
  depth = 0,
  ancestors: SpaceWithPagesResponse[] = [],
): FlattenedSpace[] {
  return spaces.flatMap((space) => [
    { space, depth, path: [...ancestors, space] },
    ...flattenSpaces(space.children, depth + 1, [...ancestors, space]),
  ]);
}

function findPage(
  spaces: SpaceWithPagesResponse[],
  pageId: string,
  ancestors: SpaceWithPagesResponse[] = [],
): { space: SpaceWithPagesResponse; page: PageResponse; path: SpaceWithPagesResponse[] } | null {
  for (const space of spaces) {
    const page = space.pages.find((candidate) => candidate.id === pageId);
    const path = [...ancestors, space];
    if (page) return { space, page, path };

    const childResult = findPage(space.children, pageId, path);
    if (childResult) return childResult;
  }
  return null;
}

function findSpace(spaces: SpaceWithPagesResponse[], spaceId: string): SpaceWithPagesResponse | null {
  const path = findSpacePath(spaces, spaceId);
  return path?.[path.length - 1] ?? null;
}

function findSpacePath(
  spaces: SpaceWithPagesResponse[],
  spaceId: string,
  ancestors: SpaceWithPagesResponse[] = [],
): SpaceWithPagesResponse[] | null {
  for (const space of spaces) {
    const path = [...ancestors, space];
    if (space.id === spaceId) return path;

    const childPath = findSpacePath(space.children, spaceId, path);
    if (childPath) return childPath;
  }
  return null;
}

function getFirstPageId(spaces: SpaceWithPagesResponse[]): string | null {
  for (const space of spaces) {
    const pageId = space.pages[0]?.id ?? getFirstPageId(space.children);
    if (pageId) return pageId;
  }
  return null;
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
