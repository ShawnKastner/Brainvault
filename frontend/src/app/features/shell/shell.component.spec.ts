import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import type { PageResponse } from '../../core/models/page.model';
import type { SpaceWithPagesResponse } from '../../core/models/space.model';
import { SettingsService } from '../../core/services/settings.service';
import { KnowledgeBaseStore } from '../pages/services/knowledge-base.store';
import { COMPACT_SHELL_MEDIA_QUERY, ShellComponent, SIDEBAR_CLOSED_SPACES_STORAGE_KEY } from './shell.component';

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

class MatchMediaController {
  private listeners = new Set<(event: MediaQueryListEvent) => void>();

  constructor(private currentMatches = false) {}

  readonly query = {
    get matches() {
      return controller.currentMatches;
    },
    media: COMPACT_SHELL_MEDIA_QUERY,
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      controller.listeners.add(asMediaQueryListener(listener));
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      controller.listeners.delete(asMediaQueryListener(listener));
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      controller.listeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      controller.listeners.delete(listener);
    },
    dispatchEvent: () => true,
  } as MediaQueryList;

  setMatches(matches: boolean): void {
    this.currentMatches = matches;
    const event = { matches, media: COMPACT_SHELL_MEDIA_QUERY } as MediaQueryListEvent;
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

let controller: MatchMediaController;

describe(ShellComponent.name, () => {
  let store: KnowledgeBaseStoreStub;
  let router: jasmine.SpyObj<Router>;
  let paramMap$: Subject<ParamMap>;
  let activatedRoute: {
    paramMap: Observable<ParamMap>;
    snapshot: { routeConfig: { path: string } };
  };

  beforeEach(async () => {
    window.localStorage.removeItem(SIDEBAR_CLOSED_SPACES_STORAGE_KEY);
    controller = new MatchMediaController(false);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jasmine.createSpy('matchMedia').and.returnValue(controller.query),
    });

    store = new KnowledgeBaseStoreStub();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    paramMap$ = new Subject<ParamMap>();
    activatedRoute = {
      paramMap: paramMap$.asObservable(),
      snapshot: { routeConfig: { path: '' } },
    };

    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: Router, useValue: router },
        { provide: KnowledgeBaseStore, useValue: store },
        { provide: SettingsService, useValue: {} },
      ],
    });
    TestBed.overrideComponent(ShellComponent, {
      set: {
        template: `
          <bv-topbar
            [compactLayout]="compactLayout()"
            [mobileNavOpen]="mobileNavOpen()"
            (toggleMobileNav)="toggleMobileNavigation()"
          />

          @if (compactLayout() && mobileNavOpen()) {
            <button
              type="button"
              class="mobile-nav-backdrop"
              aria-label="Navigation schliessen"
              (click)="closeMobileNavigation()"
            ></button>
          }

          <bv-sidebar
            [spaces]="store.filteredSpaces()"
            [loading]="store.loading()"
            [saving]="store.saving()"
            [dragDisabled]="editMode()"
            [openSpaces]="openSpaces()"
            [activePageId]="storageActive() ? null : store.activePageId()"
            [activeSpaceId]="storageActive() ? null : activeSidebarSpaceId()"
            [storageActive]="storageActive()"
            [searchQuery]="store.searchQuery()"
            [compactMode]="compactLayout()"
            (toggleSpace)="toggleSpace($event)"
            (selectSpace)="selectSpace($event)"
            (selectPage)="selectPage($event)"
            (selectStorage)="selectStorage()"
            (searchQueryChange)="store.setSearchQuery($event)"
            (createSpace)="createSpace($event)"
            (deleteSpace)="requestDeleteSpace($event)"
            (movePageToSpace)="movePageToSpace($event)"
            (openSettings)="openSettings()"
            (dismiss)="closeMobileNavigation()"
          />
        `,
      },
    });
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

  it('activates storage mode from the storage route and hides page selection', () => {
    activatedRoute.snapshot.routeConfig.path = 'storage';

    createShell();

    expect(store.activePageId()).toBeNull();
    expect(store.activeSpaceId()).toBeNull();
    expect(store.loadSpaces).toHaveBeenCalledWith(null);
  });

  it('opens the mobile drawer in compact layout and resets it when the viewport widens', () => {
    const fixture = createShell();

    controller.setMatches(true);
    fixture.detectChanges();
    topbarMenuButton(fixture).click();
    fixture.detectChanges();

    expect(shell(fixture).compactLayout()).toBe(true);
    expect(shell(fixture).mobileNavOpen()).toBe(true);

    controller.setMatches(false);
    fixture.detectChanges();

    expect(shell(fixture).compactLayout()).toBe(false);
    expect(shell(fixture).mobileNavOpen()).toBe(false);
  });

  it('closes the mobile drawer from the backdrop and escape key', () => {
    controller.setMatches(true);
    const fixture = createShell();

    topbarMenuButton(fixture).click();
    fixture.detectChanges();
    backdrop(fixture).click();
    fixture.detectChanges();

    expect(shell(fixture).mobileNavOpen()).toBe(false);

    topbarMenuButton(fixture).click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(shell(fixture).mobileNavOpen()).toBe(false);
  });

  it('closes the mobile drawer after sidebar navigation and settings actions', () => {
    controller.setMatches(true);
    store.spaces.set([createSpaceFixture({ pages: [page] })]);
    const fixture = createShell();

    topbarMenuButton(fixture).click();
    fixture.detectChanges();
    sidebarAvatar(fixture).click();
    fixture.detectChanges();

    expect(shell(fixture).settingsOpen()).toBe(true);
    expect(shell(fixture).mobileNavOpen()).toBe(false);

    topbarMenuButton(fixture).click();
    fixture.detectChanges();
    storageButton(fixture).click();
    fixture.detectChanges();

    expect(shell(fixture).mobileNavOpen()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/storage']);

    topbarMenuButton(fixture).click();
    fixture.detectChanges();
    pageButton(fixture).click();
    fixture.detectChanges();

    expect(shell(fixture).mobileNavOpen()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/pages', 'page-1']);
  });

  it('closes the mobile drawer when the current route changes', () => {
    controller.setMatches(true);
    const fixture = createShell();

    topbarMenuButton(fixture).click();
    fixture.detectChanges();
    emitRoute({ pageId: 'page-1' }, fixture);

    expect(shell(fixture).mobileNavOpen()).toBe(false);
  });

  function createShell(): ComponentFixture<ShellComponent> {
    const fixture = TestBed.createComponent(ShellComponent);
    emitRoute({}, fixture);
    return fixture;
  }

  function emitRoute(
    params: Record<string, string> = {},
    fixture?: ComponentFixture<ShellComponent>,
  ): void {
    paramMap$.next(convertToParamMap(params));
    fixture?.detectChanges();
  }

  function shell(fixture: ComponentFixture<ShellComponent>): {
    compactLayout: () => boolean;
    mobileNavOpen: () => boolean;
    openSpaces: () => Partial<Record<string, boolean>>;
    settingsOpen: () => boolean;
    toggleSpace: (spaceId: string) => void;
    selectPage: (pageId: string) => void;
    requestDeleteSpace: (space: SpaceWithPagesResponse) => void;
    confirmDelete: () => void;
  } {
    return fixture.componentInstance as unknown as {
      compactLayout: () => boolean;
      mobileNavOpen: () => boolean;
      openSpaces: () => Partial<Record<string, boolean>>;
      settingsOpen: () => boolean;
      toggleSpace: (spaceId: string) => void;
      selectPage: (pageId: string) => void;
      requestDeleteSpace: (space: SpaceWithPagesResponse) => void;
      confirmDelete: () => void;
    };
  }

  function topbarMenuButton(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.mobile-nav-button') as HTMLButtonElement;
  }

  function backdrop(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.mobile-nav-backdrop') as HTMLButtonElement;
  }

  function storageButton(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.storage-nav-button') as HTMLButtonElement;
  }

  function pageButton(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.nav-item') as HTMLButtonElement;
  }

  function sidebarAvatar(fixture: ComponentFixture<ShellComponent>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.avatar') as HTMLButtonElement;
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

function asMediaQueryListener(listener: EventListenerOrEventListenerObject): (event: MediaQueryListEvent) => void {
  if (typeof listener === 'function') {
    return listener as (event: MediaQueryListEvent) => void;
  }

  return (event: MediaQueryListEvent) => listener.handleEvent(event);
}
