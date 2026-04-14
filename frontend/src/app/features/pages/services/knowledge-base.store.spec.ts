import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PagesApiService } from '../../../core/api/pages-api.service';
import { SpacesApiService } from '../../../core/api/spaces-api.service';
import type { SpaceWithPagesResponse } from '../../../core/models/space.model';
import { KnowledgeBaseStore } from './knowledge-base.store';

const spaces: SpaceWithPagesResponse[] = [
  {
    id: 'space-1',
    name: 'Development',
    description: null,
    color: '#378ADD',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [
      {
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
      },
    ],
  },
];

describe(KnowledgeBaseStore.name, () => {
  let store: KnowledgeBaseStore;
  let spacesApi: jasmine.SpyObj<SpacesApiService>;
  let pagesApi: jasmine.SpyObj<PagesApiService>;

  beforeEach(() => {
    spacesApi = jasmine.createSpyObj<SpacesApiService>('SpacesApiService', ['getAll', 'create']);
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
});
