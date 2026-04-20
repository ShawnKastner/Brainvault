import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PageResponse, UpdatePageRequest } from '../../../../core/models/page.model';
import type { SpaceWithPagesResponse } from '../../../../core/models/space.model';
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

const linkTargetPage: PageResponse = {
  ...basePage,
  id: 'page-2',
  title: 'Roadmap',
  description: 'Planung und Meilensteine',
  spaceId: 'space-2',
};

const linkableSpaces: SpaceWithPagesResponse[] = [
  {
    id: 'space-1',
    name: 'Wissen',
    description: null,
    color: '#378ADD',
    sortOrder: 0,
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    pages: [basePage],
    children: [
      {
        id: 'space-2',
        name: 'Projekte',
        description: null,
        color: '#378ADD',
        sortOrder: 1,
        parentId: 'space-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        pages: [linkTargetPage],
        children: [],
      },
    ],
  },
];

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

  it('opens the link modal without using the browser prompt', () => {
    const promptSpy = spyOn(window, 'prompt');
    const { fixture } = setup(basePage);

    linkToolbarButton(fixture).click();
    fixture.detectChanges();

    expect(promptSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.link-modal-panel')).not.toBeNull();
  });

  it('sets normalized external URL links', () => {
    const { fixture } = setup(basePage);

    linkToolbarButton(fixture).click();
    fixture.detectChanges();
    setInputValue(fixture, '.link-input', 'example.com/docs');
    submitLinkModal(fixture);

    const html = fixture.componentInstance.editor?.getHTML() ?? '';

    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('>https://example.com/docs</a>');
  });

  it('sets internal document links and inserts the document title when no text is selected', () => {
    const { fixture } = setup(basePage, linkableSpaces);

    linkToolbarButton(fixture).click();
    fixture.detectChanges();
    selectMode(fixture, 'Dokument');
    documentOption(fixture, 'Roadmap').click();
    fixture.detectChanges();
    submitLinkModal(fixture);

    const html = fixture.componentInstance.editor?.getHTML() ?? '';

    expect(html).toContain('href="/pages/page-2"');
    expect(html).toContain('>Roadmap</a>');
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain('rel="noopener noreferrer"');
  });

  it('keeps selected text when applying a link', () => {
    const { fixture } = setup({
      ...basePage,
      content: '<p>Text behalten</p>',
      contentFormat: 'html',
    });
    const component = fixture.componentInstance;

    component.editor?.commands.setTextSelection({ from: 1, to: 5 });
    linkToolbarButton(fixture).click();
    fixture.detectChanges();
    setInputValue(fixture, '.link-input', 'example.com');
    submitLinkModal(fixture);

    const html = component.editor?.getHTML() ?? '';

    expect(html).toContain('<a target="_blank" rel="noopener noreferrer" href="https://example.com/">Text</a>');
    expect(html).toContain(' behalten');
    expect(html).not.toContain('>https://example.com/</a>');
  });

  it('removes an existing link from the selected text', () => {
    const { fixture } = setup({
      ...basePage,
      content: '<p><a href="https://example.com/" target="_blank" rel="noopener noreferrer">Docs</a></p>',
      contentFormat: 'html',
    });
    const component = fixture.componentInstance;

    component.editor?.commands.setTextSelection(2);
    linkToolbarButton(fixture).click();
    fixture.detectChanges();
    const removeButton = fixture.nativeElement.querySelector(
      '.link-modal-actions .button.danger',
    ) as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();

    const html = component.editor?.getHTML() ?? '';

    expect(html).toContain('Docs');
    expect(html).not.toContain('<a');
  });
});

function setup(page: PageResponse, spaces: SpaceWithPagesResponse[] = []): {
  fixture: ComponentFixture<PageEditorComponent>;
  emitted: UpdatePageRequest[];
} {
  const fixture = TestBed.createComponent(PageEditorComponent);
  const emitted: UpdatePageRequest[] = [];

  fixture.componentRef.setInput('page', page);
  fixture.componentRef.setInput('linkableSpaces', spaces);
  fixture.componentRef.setInput('saving', false);
  fixture.componentInstance.save.subscribe((value) => emitted.push(value));
  fixture.detectChanges();

  return { fixture, emitted };
}

function linkToolbarButton(fixture: ComponentFixture<PageEditorComponent>): HTMLButtonElement {
  return buttonByText(fixture, 'Link');
}

function buttonByText(fixture: ComponentFixture<PageEditorComponent>, text: string): HTMLButtonElement {
  const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  const button = buttons.find((candidate) => candidate.textContent?.trim() === text);
  expect(button).withContext(`button "${text}"`).toBeDefined();
  return button as HTMLButtonElement;
}

function selectMode(fixture: ComponentFixture<PageEditorComponent>, text: string): void {
  buttonByText(fixture, text).click();
  fixture.detectChanges();
}

function setInputValue(fixture: ComponentFixture<PageEditorComponent>, selector: string, value: string): void {
  const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function documentOption(fixture: ComponentFixture<PageEditorComponent>, title: string): HTMLButtonElement {
  const options = Array.from(
    fixture.nativeElement.querySelectorAll('.document-link-option'),
  ) as HTMLButtonElement[];
  const option = options.find((candidate) => candidate.textContent?.includes(title));
  expect(option).withContext(`document option "${title}"`).toBeDefined();
  return option as HTMLButtonElement;
}

function submitLinkModal(fixture: ComponentFixture<PageEditorComponent>): void {
  const form = fixture.nativeElement.querySelector('.link-modal-panel') as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges();
}
