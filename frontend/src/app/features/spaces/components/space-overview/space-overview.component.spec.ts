import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import type { PageResponse } from '../../../../core/models/page.model';
import type { SpaceWithPagesResponse } from '../../../../core/models/space.model';
import { SpaceOverviewComponent } from './space-overview.component';

const page: PageResponse = {
  id: 'page-1',
  title: 'NestJS Architektur',
  description: 'Module und Provider',
  content: 'Content',
  contentFormat: 'markdown',
  tags: [],
  spaceId: 'space-1',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const space: SpaceWithPagesResponse = {
  id: 'space-1',
  name: 'Development',
  description: null,
  color: '#378ADD',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  pages: [page],
};

describe(SpaceOverviewComponent.name, () => {
  let fixture: ComponentFixture<SpaceOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpaceOverviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SpaceOverviewComponent);
    fixture.componentRef.setInput('space', space);
    fixture.detectChanges();
  });

  it('lists the documents in the space', () => {
    expect(fixture.nativeElement.textContent).toContain('Development');
    expect(fixture.nativeElement.textContent).toContain('1 Dokument');
    expect(fixture.nativeElement.textContent).toContain('NestJS Architektur');
  });

  it('emits selected pages from the document list', () => {
    const selected: string[] = [];
    fixture.componentInstance.selectPage.subscribe((pageId) => selected.push(pageId));

    documentRow().click();

    expect(selected).toEqual(['page-1']);
  });

  it('starts renaming from the title keyboard interaction', () => {
    title().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(renameInput()).not.toBeNull();
  });

  it('emits trimmed rename requests', fakeAsync(() => {
    const renamed: unknown[] = [];
    fixture.componentInstance.renameSpace.subscribe((request) => renamed.push(request));

    startRename();
    setInputValue(' Renamed ');
    submitRename();

    expect(renamed).toEqual([{ id: 'space-1', name: 'Renamed' }]);
  }));

  it('does not emit rename requests for empty or unchanged names', fakeAsync(() => {
    const renamed: unknown[] = [];
    fixture.componentInstance.renameSpace.subscribe((request) => renamed.push(request));

    startRename();
    setInputValue(' ');
    submitRename();

    startRename();
    setInputValue('Development');
    submitRename();

    expect(renamed).toEqual([]);
  }));

  it('cancels renaming with Escape', fakeAsync(() => {
    const renamed: unknown[] = [];
    fixture.componentInstance.renameSpace.subscribe((request) => renamed.push(request));

    startRename();
    setInputValue('Renamed');
    renameInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(renamed).toEqual([]);
    expect(renameInput()).toBeNull();
  }));

  function startRename(): void {
    fixture.componentInstance.startRename();
    fixture.detectChanges();
    tick();
  }

  function setInputValue(value: string): void {
    const input = renameInput();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function submitRename(): void {
    fixture.componentInstance.submitRename();
    fixture.detectChanges();
  }

  function title(): HTMLElement {
    return fixture.nativeElement.querySelector('.space-title') as HTMLElement;
  }

  function renameInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('.rename-input') as HTMLInputElement;
  }

  function documentRow(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.document-row') as HTMLButtonElement;
  }
});
