import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PageResponse } from '../../../../core/models/page.model';
import { PageViewComponent } from './page-view.component';

const page: PageResponse = {
  id: 'page-1',
  title: 'Markdown Notizen',
  description: 'Beschreibung',
  content: '## Ueberschrift\n\nZwei Wörter',
  contentFormat: 'markdown',
  tags: ['markdown'],
  spaceId: 'space-1',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe(PageViewComponent.name, () => {
  let fixture: ComponentFixture<PageViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageViewComponent);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('space', null);
    fixture.detectChanges();
  });

  it('renders markdown content', () => {
    expect(fixture.nativeElement.textContent).toContain('Ueberschrift');
  });

  it('renders word count and reading time in the meta row', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('3 Wörter');
    expect(text).toContain('ca. 1 Min. Lesezeit');
  });
});
