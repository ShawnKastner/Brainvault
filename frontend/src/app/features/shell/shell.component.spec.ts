import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import type { PageResponse } from '../../core/models/page.model';
import type { SpaceWithPagesResponse } from '../../core/models/space.model';
import { SettingsService } from '../../core/services/settings.service';
import { KnowledgeBaseStore } from '../pages/services/knowledge-base.store';
import { ShellComponent, SIDEBAR_CLOSED_SPACES_STORAGE_KEY } from './shell.component';

const page: PageResponse = {
  id: 'page-1',
  title: 'NestJS Architektur',
  description: null,
  content: 'Module und Provider',
  contentFormat: 'markdown',
  tags: ['nestjs'],
  spaceId: 'space-child',
  sortOrder: 0,
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

class KnowledgeBaseStoreStub {
  readonly spaces = signal<SpaceWithPagesResponse[]>([]);
  readonly activePageId = signal<string | null>(null);
  readonly activeSpaceId = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly flattenedSpaces = computed(() => flattenSpaces(this.spaces()));
  readonly allSpaces = computed(() => this.flattenedSpaces().map((entry) => entry.space));
  readonly filteredSpaces = computed(() => this.spaces());
  readonly activeSpacePath = computed(() => {
    const activeSpaceId = this.activeSpaceId();
    return activeSpaceId ? (findSpacePath(this.spaces(), activeSpaceId) ?? []) : [];
  });
  readonly activeSpace = computed(() => this.activeSpacePath().at(-1) ?? null);
  readonly activePage = computed(() => null);

  readonly loadSpaces = jasmine.createSpy('loadSpaces');
  readonly createSpace = jasmine.createSpy('createSpace');
  readonly deleteSpace = jasmine
    .createSpy('deleteSpace')
    .and.callFake((_id: string, onDeleted?: (nextPageId: string | null) => void) => onDeleted?.(null));
  readonly updateSpace = jasmine.createSpy('updateSpace');
  readonly createPage = jasmine.createSpy('createPage');
  readonly updatePage = jasmine.createSpy('updatePage');
  readonly movePageToSpace = jasmine.createSpy('movePageToSpace');
  readonly deletePage = jasmine.createSpy('deletePage');
  readonly dismissError = jasmine.createSpy('dismissError');

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
}

describe(ShellComponent.name, () => {
  let store: KnowledgeBaseStoreStub;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    window.localStorage.removeItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY);
    store = new KnowledgeBaseStoreStub();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        { provide: Router, useValue: router },
        { provide: KnowledgeBaseStore, useValue: store },
        { provide: SettingsService, useValue: {} },
      ],
    });
    TestBed.overrideComponent(ShellComponent, { set: { template: '' } });
    await TestBed.compileComponents();
  });

  afterEach(() => {
    window.localStorage.removeItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY);
  });

  it('persists closed space overrides and restores them', () => {
    const fixture = createShell();
    shell(fixture).toggleSpace('space-1');
    fixture.detectChanges();

    expect(JSON.parse(window.localStorage.getItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY) ?? '[]')).toEqual([
      'space-1',
    ]);

    fixture.destroy();
    const restoredFixture = createShell();

    expect(shell(restoredFixture).openSpaces()).toEqual({ 'space-1': false });
  });

  it('removes a closed override when a space is reopened', () => {
    window.localStorage.setItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY, JSON.stringify(['space-1']));
    const fixture = createShell();

    shell(fixture).toggleSpace('space-1');
    fixture.detectChanges();

    expect(shell(fixture).openSpaces()).toEqual({});
    expect(window.localStorage.getItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY)).toBeNull();
  });

  it('opens a selected page path by clearing closed ancestor overrides', () => {
    window.localStorage.setItem(
      SIDEBAR_CLOSED_SPACES_STORAGE_KEY,
      JSON.stringify(['space-root', 'space-child']),
    );
    store.spaces.set([
      createSpaceFixture({
        id: 'space-root',
        children: [
          createSpaceFixture({
            id: 'space-child',
            parentId: 'space-root',
            pages: [page],
          }),
        ],
      }),
    ]);
    const fixture = createShell();

    shell(fixture).selectPage('page-1');
    fixture.detectChanges();

    expect(shell(fixture).openSpaces()).toEqual({});
    expect(window.localStorage.getItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY)).toBeNull();
  });

  it('removes deleted spaces and descendants from persisted overrides', () => {
    window.localStorage.setItem(
      SIDEBAR_CLOSED_SPACES_STORAGE_KEY,
      JSON.stringify(['space-root', 'space-child', 'space-other']),
    );
    const childSpace = createSpaceFixture({
      id: 'space-child',
      parentId: 'space-root',
    });
    const deletedSpace = createSpaceFixture({
      id: 'space-root',
      children: [childSpace],
    });
    store.spaces.set([
      deletedSpace,
      createSpaceFixture({
        id: 'space-other',
        sortOrder: 1,
      }),
    ]);
    const fixture = createShell();

    shell(fixture).requestDeleteSpace(deletedSpace);
    shell(fixture).confirmDelete();
    fixture.detectChanges();

    expect(JSON.parse(window.localStorage.getItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY) ?? '[]')).toEqual([
      'space-other',
    ]);
  });

  function createShell(): ComponentFixture<ShellComponent> {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    return fixture;
  }

  function shell(fixture: ComponentFixture<ShellComponent>): {
    openSpaces: () => Partial<Record<string, boolean>>;
    toggleSpace: (spaceId: string) => void;
    selectPage: (pageId: string) => void;
    requestDeleteSpace: (space: SpaceWithPagesResponse) => void;
    confirmDelete: () => void;
  } {
    return fixture.componentInstance as unknown as {
      openSpaces: () => Partial<Record<string, boolean>>;
      toggleSpace: (spaceId: string) => void;
      selectPage: (pageId: string) => void;
      requestDeleteSpace: (space: SpaceWithPagesResponse) => void;
      confirmDelete: () => void;
    };
  }
});

function flattenSpaces(
  spaces: SpaceWithPagesResponse[],
  depth = 0,
  ancestors: SpaceWithPagesResponse[] = [],
): Array<{ space: SpaceWithPagesResponse; depth: number; path: SpaceWithPagesResponse[] }> {
  return spaces.flatMap((space) => [
    { space, depth, path: [...ancestors, space] },
    ...flattenSpaces(space.children, depth + 1, [...ancestors, space]),
  ]);
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
