import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PageResponse } from '../../../../core/models/page.model';
import {
  MERMAID_LOADER,
  MermaidRendererApi,
} from '../../../../shared/directives/mermaid-renderer.directive';
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
  let initializeSpy: jasmine.Spy<MermaidRendererApi['initialize']>;
  let renderSpy: jasmine.Spy<MermaidRendererApi['render']>;

  beforeEach(async () => {
    initializeSpy = jasmine.createSpy('initialize');
    renderSpy = jasmine.createSpy('render').and.callFake(async (id: string, definition: string) => ({
      svg: `<svg id="${id}"><text>${definition}</text></svg>`,
    }));

    await TestBed.configureTestingModule({
      imports: [PageViewComponent],
      providers: [
        {
          provide: MERMAID_LOADER,
          useValue: async () => ({
            initialize: initializeSpy,
            render: renderSpy,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PageViewComponent);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('space', null);
    fixture.detectChanges();
  });

  it('renders markdown content', () => {
    expect(fixture.nativeElement.textContent).toContain('Ueberschrift');
  });

  it('renders markdown mermaid code blocks as diagrams', async () => {
    fixture.componentRef.setInput('page', {
      ...page,
      content: '```mermaid\ngraph TD;A-->B\n```',
    });
    fixture.detectChanges();

    await flushRenderer();

    const host = fixture.nativeElement as HTMLElement;

    expect(renderSpy).toHaveBeenCalledOnceWith(jasmine.stringMatching(/^bv-mermaid-/), 'graph TD;A-->B');
    expect(host.querySelector('.page-body pre')).toBeNull();
    expect(host.querySelector('.page-body .mermaid-diagram svg')).not.toBeNull();
  });

  it('renders saved HTML code blocks with literal mermaid fences as diagrams', async () => {
    fixture.componentRef.setInput('page', {
      ...page,
      content: '<pre><code>```mermaid\nflowchart TD\nA--&gt;B\n```</code></pre>',
      contentFormat: 'html',
    });
    fixture.detectChanges();

    await flushRenderer();

    const host = fixture.nativeElement as HTMLElement;

    expect(renderSpy).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(/^bv-mermaid-/),
      'flowchart TD\nA-->B',
    );
    expect(host.querySelector('.page-body pre')).toBeNull();
    expect(host.querySelector('.page-body .mermaid-diagram svg')).not.toBeNull();
  });

  it('renders word count and reading time in the meta row', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('3 Wörter');
    expect(text).toContain('ca. 1 Min. Lesezeit');
  });
});

async function flushRenderer(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
