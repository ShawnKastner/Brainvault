import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import type { PageResponse } from '../../../../core/models/page.model';
import type { SpaceWithPagesResponse } from '../../../../core/models/space.model';
import { SidebarComponent } from './sidebar.component';

const page: PageResponse = {
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

const space: SpaceWithPagesResponse = {
  id: 'space-1',
  name: 'Notes',
  description: null,
  color: '#378ADD',
  sortOrder: 0,
  parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  pages: [],
  children: [],
};

const sourceSpace: SpaceWithPagesResponse = {
  ...space,
  pages: [page],
};

const targetSpace: SpaceWithPagesResponse = {
  id: 'space-2',
  name: 'Archive',
  description: null,
  color: '#BA7517',
  sortOrder: 1,
  parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  pages: [],
  children: [],
};

const archivePage: PageResponse = {
  ...page,
  id: 'page-2',
  title: 'Release Notes',
  tags: ['release'],
  spaceId: 'space-2',
};

describe(SidebarComponent.name, () => {
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('spaces', []);
    fixture.detectChanges();
  });

  it('emits create requests from the new space form', () => {
    const emitted: unknown[] = [];
    fixture.componentInstance.createSpace.subscribe((value) => emitted.push(value));

    fixture.componentInstance.startCreateSpace();
    fixture.componentInstance.spaceForm.setValue({ name: ' Notes ', color: '#378ADD' });
    fixture.componentInstance.submitSpace();

    expect(emitted).toEqual([{ name: 'Notes', color: '#378ADD', parentId: null }]);
  });

  it('does not render per-space create actions', () => {
    fixture.componentRef.setInput('spaces', [space]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.nav-section-create')).toBeNull();
  });

  it('emits delete requests without toggling the space', () => {
    const deleted: SpaceWithPagesResponse[] = [];
    const toggled: string[] = [];
    fixture.componentRef.setInput('spaces', [space]);
    fixture.componentInstance.deleteSpace.subscribe((value) => deleted.push(value));
    fixture.componentInstance.toggleSpace.subscribe((value) => toggled.push(value));
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.nav-section-delete') as HTMLButtonElement;
    button.click();

    expect(deleted).toEqual([space]);
    expect(toggled).toEqual([]);
  });

  it('opens settings from the avatar button', () => {
    let opened = 0;
    fixture.componentInstance.openSettings.subscribe(() => {
      opened += 1;
    });
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector('.avatar') as HTMLButtonElement;
    avatar.click();

    expect(opened).toBe(1);
    expect(avatar.getAttribute('aria-label')).toBe('Einstellungen öffnen');
  });

  it('renders a dismiss control in compact mode and emits dismiss events', () => {
    let dismissed = 0;
    fixture.componentRef.setInput('compactMode', true);
    fixture.componentInstance.dismiss.subscribe(() => {
      dismissed += 1;
    });
    fixture.detectChanges();

    const closeButton = fixture.nativeElement.querySelector('.sidebar-close') as HTMLButtonElement;
    closeButton.click();

    expect(closeButton.getAttribute('aria-label')).toBe('Navigation schliessen');
    expect(dismissed).toBe(1);
  });

  it('emits storage selections and marks the storage item active', () => {
    let opened = 0;
    fixture.componentRef.setInput('storageActive', true);
    fixture.componentInstance.selectStorage.subscribe(() => {
      opened += 1;
    });
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.storage-nav-button') as HTMLButtonElement;
    button.click();

    expect(opened).toBe(1);
    expect(button.classList).toContain('active');
  });

  it('keeps short clicks as page selection', () => {
    const selected: string[] = [];
    fixture.componentRef.setInput('spaces', [sourceSpace]);
    fixture.componentInstance.selectPage.subscribe((value) => selected.push(value));
    fixture.detectChanges();

    pageButton().click();

    expect(selected).toEqual(['page-1']);
  });

  it('opens all spaces with content by default', () => {
    fixture.componentRef.setInput('spaces', [
      sourceSpace,
      {
        ...targetSpace,
        pages: [archivePage],
      },
    ]);
    fixture.detectChanges();

    const expandedStates = Array.from(
      fixture.nativeElement.querySelectorAll('.nav-section-expander') as NodeListOf<HTMLButtonElement>,
      (button) => button.getAttribute('aria-expanded'),
    );

    expect(expandedStates).toEqual(['true', 'true']);
    expect(fixture.nativeElement.textContent).toContain('NestJS Architektur');
    expect(fixture.nativeElement.textContent).toContain('Release Notes');
  });

  it('keeps explicitly closed spaces collapsed', () => {
    fixture.componentRef.setInput('spaces', [sourceSpace]);
    fixture.componentRef.setInput('openSpaces', { 'space-1': false });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.nav-item')).toBeNull();
    expect(fixture.nativeElement.querySelector('.nav-section-expander')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders nested spaces and emits space selections', () => {
    const selected: string[] = [];
    fixture.componentRef.setInput('spaces', [
      {
        ...sourceSpace,
        children: [{ ...targetSpace, parentId: 'space-1' }],
      },
    ]);
    fixture.componentInstance.selectSpace.subscribe((value) => selected.push(value));
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('.nav-section-link') as NodeListOf<HTMLButtonElement>;
    links[1].click();

    expect(fixture.nativeElement.textContent).toContain('Archive');
    expect(selected).toEqual(['space-2']);
  });

  it('does not move a page before the long-press delay', fakeAsync(() => {
    const moved: unknown[] = [];
    fixture.componentRef.setInput('spaces', [sourceSpace, targetSpace]);
    fixture.componentInstance.movePageToSpace.subscribe((value) => moved.push(value));
    fixture.detectChanges();

    pageButton().dispatchEvent(pointerEvent('pointerdown'));
    tick(449);
    window.dispatchEvent(pointerEvent('pointerup'));
    tick();

    expect(moved).toEqual([]);
  }));

  it('moves a long-pressed page when dropped on another space header', fakeAsync(() => {
    const moved: unknown[] = [];
    fixture.componentRef.setInput('spaces', [sourceSpace, targetSpace]);
    fixture.componentInstance.movePageToSpace.subscribe((value) => moved.push(value));
    fixture.detectChanges();

    spyOn(document, 'elementFromPoint').and.returnValue(spaceHeader('space-2'));

    pageButton().dispatchEvent(pointerEvent('pointerdown'));
    tick(450);
    window.dispatchEvent(pointerEvent('pointerup'));
    tick();

    expect(moved).toEqual([{ pageId: 'page-1', targetSpaceId: 'space-2' }]);
  }));

  it('does not move a page when dropped on its current space', fakeAsync(() => {
    const moved: unknown[] = [];
    fixture.componentRef.setInput('spaces', [sourceSpace, targetSpace]);
    fixture.componentInstance.movePageToSpace.subscribe((value) => moved.push(value));
    fixture.detectChanges();

    spyOn(document, 'elementFromPoint').and.returnValue(spaceHeader('space-1'));

    pageButton().dispatchEvent(pointerEvent('pointerdown'));
    tick(450);
    window.dispatchEvent(pointerEvent('pointerup'));
    tick();

    expect(moved).toEqual([]);
  }));

  it('does not move a page when dropped outside a space header', fakeAsync(() => {
    const moved: unknown[] = [];
    fixture.componentRef.setInput('spaces', [sourceSpace, targetSpace]);
    fixture.componentInstance.movePageToSpace.subscribe((value) => moved.push(value));
    fixture.detectChanges();

    spyOn(document, 'elementFromPoint').and.returnValue(null);

    pageButton().dispatchEvent(pointerEvent('pointerdown'));
    tick(450);
    window.dispatchEvent(pointerEvent('pointerup'));
    tick();

    expect(moved).toEqual([]);
  }));

  it('does not start dragging while saving', fakeAsync(() => {
    const moved: unknown[] = [];
    fixture.componentRef.setInput('spaces', [sourceSpace, targetSpace]);
    fixture.componentRef.setInput('saving', true);
    fixture.componentInstance.movePageToSpace.subscribe((value) => moved.push(value));
    fixture.detectChanges();

    pageButton().dispatchEvent(pointerEvent('pointerdown'));
    tick(450);
    window.dispatchEvent(pointerEvent('pointerup'));
    tick();

    expect(fixture.componentInstance.draggingPage()).toBeNull();
    expect(moved).toEqual([]);
  }));

  it('does not start dragging when drag is disabled', fakeAsync(() => {
    const moved: unknown[] = [];
    fixture.componentRef.setInput('spaces', [sourceSpace, targetSpace]);
    fixture.componentRef.setInput('dragDisabled', true);
    fixture.componentInstance.movePageToSpace.subscribe((value) => moved.push(value));
    fixture.detectChanges();

    pageButton().dispatchEvent(pointerEvent('pointerdown'));
    tick(450);
    window.dispatchEvent(pointerEvent('pointerup'));
    tick();

    expect(fixture.componentInstance.draggingPage()).toBeNull();
    expect(moved).toEqual([]);
  }));

  function pageButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.nav-item') as HTMLButtonElement;
  }

  function spaceHeader(spaceId: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-space-id="${spaceId}"]`) as HTMLElement;
  }
});

function pointerEvent(type: string): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    button: 0,
    clientX: 10,
    clientY: 10,
    isPrimary: true,
    pointerId: 1,
  });
}
