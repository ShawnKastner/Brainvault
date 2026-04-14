import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PageResponse, UpdatePageRequest } from '../../../../core/models/page.model';
import { PageEditorComponent } from './page-editor.component';

const basePage: PageResponse = {
  id: 'page-1',
  title: 'Markdown Notizen',
  description: null,
  content: null,
  contentFormat: 'markdown',
  tags: [],
  spaceId: 'space-1',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe(PageEditorComponent.name, () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageEditorComponent],
    }).compileComponents();
  });

  it('emits a normalized HTML update request', () => {
    const { fixture, emitted } = setup({
      ...basePage,
      content: '<p>Alter Inhalt</p>',
      contentFormat: 'html',
      tags: ['docs'],
    });

    const component = fixture.componentInstance;
    component.form.controls.title.setValue(' Updated ');
    component.form.controls.tags.setValue(' angular, editor, ');
    component.editor?.commands.setContent('<h2>Neu</h2><p>Rich Text</p>');

    component.submit();

    expect(emitted).toEqual([
      {
        title: 'Updated',
        description: '',
        content: '<h2>Neu</h2><p>Rich Text</p>',
        contentFormat: 'html',
        tags: ['angular', 'editor'],
      },
    ]);
  });

  it('loads markdown content and saves it as HTML', () => {
    const { fixture, emitted } = setup({
      ...basePage,
      content: '## Ueberschrift\n\nInhalt mit **Markdown**.',
      contentFormat: 'markdown',
    });

    fixture.componentInstance.submit();

    expect(emitted.length).toBe(1);
    expect(emitted[0].contentFormat).toBe('html');
    expect(emitted[0].content).toContain('<h2>Ueberschrift</h2>');
    expect(emitted[0].content).toContain('<strong>Markdown</strong>');
  });

  it('keeps the cancel output available', () => {
    const { fixture } = setup(basePage);
    const cancelled: void[] = [];
    fixture.componentInstance.cancel.subscribe(() => cancelled.push(undefined));

    const cancelButton = fixture.nativeElement.querySelector('.editor-actions button[type="button"]');
    cancelButton.click();

    expect(cancelled.length).toBe(1);
  });
});

function setup(page: PageResponse): {
  fixture: ComponentFixture<PageEditorComponent>;
  emitted: UpdatePageRequest[];
} {
  const fixture = TestBed.createComponent(PageEditorComponent);
  const emitted: UpdatePageRequest[] = [];

  fixture.componentRef.setInput('page', page);
  fixture.componentRef.setInput('saving', false);
  fixture.componentInstance.save.subscribe((value) => emitted.push(value));
  fixture.detectChanges();

  return { fixture, emitted };
}
