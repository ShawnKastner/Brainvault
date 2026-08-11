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

function createSpaceFixture(overrides: Partial<SpaceWithPagesResponse> = {}): SpaceWithPagesResponse {
  return {
    id: 'space-1',
    name: 'Development',
    description: null,
    color: '#378ADD',
    sortOrder: 0,
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [],
    children: [],
    ...overrides,
  };
}

const spaces: SpaceWithPagesResponse[] = [
  createSpaceFixture({ pages: [page1] }),
];

const spacesAfterDelete: SpaceWithPagesResponse[] = [
  createSpaceFixture({
    id: 'space-2',
    name: 'Operations',
    color: '#BA7517',
    sortOrder: 1,
    pages: [{ ...page2, sortOrder: 0 }],
  }),
];

const spacesForMove: SpaceWithPagesResponse[] = [
  spaces[0],
  createSpaceFixture({
    id: 'space-2',
    name: 'Operations',
    color: '#BA7517',
    sortOrder: 1,
    pages: [page2],
  }),
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
    spacesApi = jasmine.createSpyObj<SpacesApiService>('SpacesApiService', [
      'getAll',
      'create',
      'remove',
      'update',
    ]);
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

  it('keeps ancestor spaces when filtering nested matches', () => {
    const nestedSpaces = [
      createSpaceFixture({
        id: 'space-root',
        name: 'Root',
        pages: [],
        children: [
          createSpaceFixture({
            id: 'space-child',
            name: 'Child',
            parentId: 'space-root',
            pages: [{ ...page1, spaceId: 'space-child' }],
          }),
        ],
      }),
    ];
    store.spaces.set(nestedSpaces);

    store.setSearchQuery('nestjs');

    expect(store.filteredSpaces()[0].id).toBe('space-root');
    expect(store.filteredSpaces()[0].children[0].id).toBe('space-child');
    expect(store.filteredSpaces()[0].children[0].pages[0].id).toBe('page-1');
  });

  it('selects a space without selecting a page', () => {
    store.spaces.set(spacesForMove);

    store.selectSpace('space-2');

    expect(store.activeSpace()).toEqual(spacesForMove[1]);
    expect(store.activePage()).toBeNull();
    expect(store.activePageId()).toBeNull();
  });

  it('finds active pages and paths recursively', () => {
    const nestedSpaces = [
      createSpaceFixture({
        id: 'space-root',
        name: 'Root',
        pages: [],
        children: [
          createSpaceFixture({
            id: 'space-child',
            name: 'Child',
            parentId: 'space-root',
            pages: [{ ...page1, spaceId: 'space-child' }],
          }),
        ],
      }),
    ];
    store.spaces.set(nestedSpaces);

    store.selectPage('page-1');

    expect(store.activeSpace()?.id).toBe('space-child');
    expect(store.activeSpacePath().map((space) => space.id)).toEqual(['space-root', 'space-child']);
  });

  it('creates subspaces and selects the created space', () => {
    const created = createSpaceFixture({
      id: 'space-child',
      name: 'Child',
      parentId: 'space-1',
    });
    const updatedSpaces = [
      createSpaceFixture({
        pages: [],
        children: [created],
      }),
    ];
    const callback = jasmine.createSpy('created');
    spacesApi.create.and.returnValue(of(created));
    spacesApi.getAll.and.returnValue(of(updatedSpaces));

    store.createSpace({ name: 'Child', parentId: 'space-1' }, callback);

    expect(spacesApi.create).toHaveBeenCalledWith({ name: 'Child', parentId: 'space-1' });
    expect(store.activeSpace()?.id).toBe('space-child');
    expect(store.activePageId()).toBeNull();
    expect(callback).toHaveBeenCalledWith(created);
  });

  it('updates a space and keeps the active space selected', () => {
    const updatedSpaces = [
      {
        ...spaces[0],
        name: 'Engineering',
      },
    ];
    store.spaces.set(spaces);
    store.selectSpace('space-1');
    spacesApi.update.and.returnValue(of(updatedSpaces[0]));
    spacesApi.getAll.and.returnValue(of(updatedSpaces));

    store.updateSpace('space-1', { name: 'Engineering' });

    expect(spacesApi.update).toHaveBeenCalledWith('space-1', { name: 'Engineering' });
    expect(store.spaces()).toEqual(updatedSpaces);
    expect(store.activeSpace()).toEqual(updatedSpaces[0]);
    expect(store.activePageId()).toBeNull();
    expect(store.saving()).toBeFalse();
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

  it('moves a page to the end of a nested target space', () => {
    const nestedTarget = createSpaceFixture({
      id: 'space-child',
      name: 'Child',
      parentId: 'space-2',
      pages: [{ ...page2, spaceId: 'space-child', sortOrder: 3 }],
    });
    const nestedSpaces = [
      spacesForMove[0],
      {
        ...spacesForMove[1],
        pages: [],
        children: [nestedTarget],
      },
    ];
    store.spaces.set(nestedSpaces);
    store.activePageId.set('page-1');
    pagesApi.update.and.returnValue(of({ ...page1, spaceId: 'space-child', sortOrder: 4 }));
    spacesApi.getAll.and.returnValue(of(nestedSpaces));

    store.movePageToSpace('page-1', 'space-child');

    expect(pagesApi.update).toHaveBeenCalledWith('page-1', {
      spaceId: 'space-child',
      sortOrder: 4,
    });
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

  it('moves a space under another space and keeps the active space selected', () => {
    const movedSpace = { ...spacesForMove[0], parentId: 'space-2' };
    const updatedSpaces = [
      {
        ...spacesForMove[1],
        children: [movedSpace],
      },
    ];
    store.spaces.set(spacesForMove);
    store.selectSpace('space-1');
    spacesApi.update.and.returnValue(of(movedSpace));
    spacesApi.getAll.and.returnValue(of(updatedSpaces));

    store.moveSpaceToParent('space-1', 'space-2');

    expect(spacesApi.update).toHaveBeenCalledWith('space-1', { parentId: 'space-2' });
    expect(store.spaces()).toEqual(updatedSpaces);
    expect(store.activeSpace()?.id).toBe('space-1');
    expect(store.activeSpacePath().map((space) => space.id)).toEqual(['space-2', 'space-1']);
    expect(store.saving()).toBeFalse();
  });

  it('moves a nested space back to the root while keeping its active page selected', () => {
    const nestedSource = { ...spacesForMove[0], parentId: 'space-2' };
    const nestedSpaces = [{ ...spacesForMove[1], children: [nestedSource] }];
    const rootSource = { ...nestedSource, parentId: null };
    const updatedSpaces = [{ ...spacesForMove[1], children: [] }, rootSource];
    store.spaces.set(nestedSpaces);
    store.selectPage('page-1');
    spacesApi.update.and.returnValue(of(rootSource));
    spacesApi.getAll.and.returnValue(of(updatedSpaces));

    store.moveSpaceToParent('space-1', null);

    expect(spacesApi.update).toHaveBeenCalledWith('space-1', { parentId: null });
    expect(store.activePageId()).toBe('page-1');
    expect(store.activeSpace()?.id).toBe('space-1');
  });

  it('does not call the API for unchanged or cyclic space moves', () => {
    const child = createSpaceFixture({
      id: 'space-child',
      parentId: 'space-1',
    });
    store.spaces.set([{ ...spaces[0], children: [child] }]);

    store.moveSpaceToParent('space-1', null);
    store.moveSpaceToParent('space-1', 'space-1');
    store.moveSpaceToParent('space-1', 'space-child');
    store.moveSpaceToParent('space-child', 'space-1');

    expect(spacesApi.update).not.toHaveBeenCalled();
    expect(store.saving()).toBeFalse();
  });

  it('reports errors when a space move fails', () => {
    store.spaces.set(spacesForMove);
    store.selectSpace('space-1');
    spacesApi.update.and.returnValue(throwError(() => new Error('failed')));

    store.moveSpaceToParent('space-1', 'space-2');

    expect(spacesApi.getAll).not.toHaveBeenCalled();
    expect(store.error()).toBe('Der Space konnte nicht verschoben werden.');
    expect(store.activeSpace()?.id).toBe('space-1');
    expect(store.saving()).toBeFalse();
  });
});
