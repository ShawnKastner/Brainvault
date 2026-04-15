import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PagesApiService } from '../../../core/api/pages-api.service';
import { SpacesApiService } from '../../../core/api/spaces-api.service';
import type { PageResponse } from '../../../core/models/page.model';
import type { SpaceWithPagesResponse } from '../../../core/models/space.model';
import { KnowledgeBaseStore } from './knowledge-base.store';

const page1: PageResponse = {
  id: 'page-1',
  title: 'NestJS Architektur',
  description: null,
  content: 'Module und Provider',
  contentFormat: 'markdown',
  tags: ['nestjs'],
  spaceId: 'space-1',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const page2: PageResponse = {
  id: 'page-2',
  title: 'Runbooks',
  description: null,
  content: 'Deployments',
  contentFormat: 'markdown',
  tags: ['ops'],
  spaceId: 'space-2',
  sortOrder: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const spaces: SpaceWithPagesResponse[] = [
  {
    id: 'space-1',
    name: 'Development',
    description: null,
    color: '#378ADD',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [page1],
  },
];

const spacesAfterDelete: SpaceWithPagesResponse[] = [
  {
    id: 'space-2',
    name: 'Operations',
    description: null,
    color: '#BA7517',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [{ ...page2, sortOrder: 0 }],
  },
];

const spacesForMove: SpaceWithPagesResponse[] = [
  spaces[0],
  {
    id: 'space-2',
    name: 'Operations',
    description: null,
    color: '#BA7517',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [page2],
  },
];

const spacesAfterMove: SpaceWithPagesResponse[] = [
  { ...spacesForMove[0], pages: [] },
  {
    ...spacesForMove[1],
    pages: [page2, { ...page1, spaceId: 'space-2', sortOrder: 5 }],
  },
];

describe(KnowledgeBaseStore.name, () => {
  let store: KnowledgeBaseStore;
  let spacesApi: jasmine.SpyObj<SpacesApiService>;
  let pagesApi: jasmine.SpyObj<PagesApiService>;

  beforeEach(() => {
    spacesApi = jasmine.createSpyObj<SpacesApiService>('SpacesApiService', ['getAll', 'create', 'remove']);
    pagesApi = jasmine.createSpyObj<PagesApiService>('PagesApiService', [
      'create',
      'update',
      'remove',
    ]);

    TestBed.configureTestingModule({
      providers: [
        KnowledgeBaseStore,
        { provide: SpacesApiService, useValue: spacesApi },
        { provide: PagesApiService, useValue: pagesApi },
      ],
    });

    store = TestBed.inject(KnowledgeBaseStore);
  });

  it('loads spaces and selects the first page by default', () => {
    spacesApi.getAll.and.returnValue(of(spaces));

    store.loadSpaces();

    expect(store.spaces()).toEqual(spaces);
    expect(store.activePageId()).toBe('page-1');
    expect(store.loading()).toBeFalse();
  });

  it('filters spaces client-side', () => {
    store.spaces.set(spaces);

    store.setSearchQuery('nestjs');

    expect(store.filteredSpaces()[0].pages[0].title).toBe('NestJS Architektur');
  });

  it('deletes a space and selects the first remaining page', () => {
    const deleted = jasmine.createSpy('deleted');
    store.activePageId.set('page-1');
    spacesApi.remove.and.returnValue(of(void 0));
    spacesApi.getAll.and.returnValue(of(spacesAfterDelete));

    store.deleteSpace('space-1', deleted);

    expect(spacesApi.remove).toHaveBeenCalledWith('space-1');
    expect(store.spaces()).toEqual(spacesAfterDelete);
    expect(store.activePageId()).toBe('page-2');
    expect(deleted).toHaveBeenCalledWith('page-2');
    expect(store.saving()).toBeFalse();
  });

  it('keeps the active page when deleting another space', () => {
    const remainingSpaces = [...spacesAfterDelete];
    store.activePageId.set('page-2');
    spacesApi.remove.and.returnValue(of(void 0));
    spacesApi.getAll.and.returnValue(of(remainingSpaces));

    store.deleteSpace('space-1');

    expect(store.spaces()).toEqual(remainingSpaces);
    expect(store.activePageId()).toBe('page-2');
  });

  it('moves a page to the end of the target space', () => {
    store.spaces.set(spacesForMove);
    store.activePageId.set('page-1');
    pagesApi.update.and.returnValue(of({ ...page1, spaceId: 'space-2', sortOrder: 5 }));
    spacesApi.getAll.and.returnValue(of(spacesAfterMove));

    store.movePageToSpace('page-1', 'space-2');

    expect(pagesApi.update).toHaveBeenCalledWith('page-1', {
      spaceId: 'space-2',
      sortOrder: 5,
    });
    expect(store.spaces()).toEqual(spacesAfterMove);
    expect(store.activePageId()).toBe('page-1');
    expect(store.saving()).toBeFalse();
  });

  it('does not call the API when moving a page to its current space', () => {
    store.spaces.set(spacesForMove);

    store.movePageToSpace('page-1', 'space-1');

    expect(pagesApi.update).not.toHaveBeenCalled();
    expect(store.saving()).toBeFalse();
  });

  it('keeps a different active page selected after moving another page', () => {
    store.spaces.set(spacesForMove);
    store.activePageId.set('page-2');
    pagesApi.update.and.returnValue(of({ ...page1, spaceId: 'space-2', sortOrder: 5 }));
    spacesApi.getAll.and.returnValue(of(spacesAfterMove));

    store.movePageToSpace('page-1', 'space-2');

    expect(store.activePageId()).toBe('page-2');
  });

  it('reports errors when a page move fails', () => {
    store.spaces.set(spacesForMove);
    store.activePageId.set('page-2');
    pagesApi.update.and.returnValue(throwError(() => new Error('failed')));

    store.movePageToSpace('page-1', 'space-2');

    expect(spacesApi.getAll).not.toHaveBeenCalled();
    expect(store.error()).toBe('Die Seite konnte nicht verschoben werden.');
    expect(store.activePageId()).toBe('page-2');
    expect(store.saving()).toBeFalse();
  });
});
