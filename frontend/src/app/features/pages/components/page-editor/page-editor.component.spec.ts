import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PageResponse } from '../../../../core/models/page.model';
import { PageEditorComponent } from './page-editor.component';

const page: PageResponse = {
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
  let fixture: ComponentFixture<PageEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageEditorComponent);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('emits a normalized update request', () => {
    const emitted: unknown[] = [];
    fixture.componentInstance.save.subscribe((value) => emitted.push(value));

    fixture.componentInstance.form.controls.title.setValue(' Updated ');
    fixture.componentInstance.submit();

    expect(emitted).toEqual([
      {
        title: 'Updated',
        description: '',
        content: '',
        contentFormat: 'markdown',
        tags: [],
      },
    ]);
  });
});
