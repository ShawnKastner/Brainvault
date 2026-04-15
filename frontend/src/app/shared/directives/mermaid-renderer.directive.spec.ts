import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MERMAID_LOADER,
  MermaidRendererApi,
  MermaidRendererDirective,
} from './mermaid-renderer.directive';

@Component({
  standalone: true,
  imports: [MermaidRendererDirective],
  template: '<div class="content" [innerHTML]="content" [bvRenderMermaid]="content"></div>',
})
class TestHostComponent {
  content = '';
}

describe(MermaidRendererDirective.name, () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let initializeSpy: jasmine.Spy<MermaidRendererApi['initialize']>;
  let renderSpy: jasmine.Spy<MermaidRendererApi['render']>;

  beforeEach(async () => {
    initializeSpy = jasmine.createSpy('initialize');
    renderSpy = jasmine.createSpy('render').and.callFake(async (id: string, definition: string) => ({
      svg: `<svg id="${id}"><text>${definition}</text></svg>`,
    }));

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
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

    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('replaces mermaid code blocks with sanitized rendered diagrams', async () => {
    fixture.componentInstance.content =
      '<pre><code class="language-mermaid">graph TD;A--&gt;B</code></pre>';
    fixture.detectChanges();

    await flushRenderer();

    const host = fixture.nativeElement as HTMLElement;
    const diagram = host.querySelector('.mermaid-diagram svg');

    expect(initializeSpy).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        startOnLoad: false,
        securityLevel: 'strict',
        htmlLabels: false,
        theme: 'base',
        flowchart: { htmlLabels: false },
        themeVariables: jasmine.objectContaining({
          nodeTextColor: '#1A1A18',
          primaryTextColor: '#1A1A18',
        }),
      }),
    );
    expect(renderSpy).toHaveBeenCalledOnceWith(jasmine.stringMatching(/^bv-mermaid-/), 'graph TD;A-->B');
    expect(host.querySelector('pre')).toBeNull();
    expect(diagram).not.toBeNull();
    expect(diagram?.textContent).toContain('graph TD;A-->B');
  });

  it('renders literal mermaid fences inside regular code blocks', async () => {
    fixture.componentInstance.content =
      '<pre><code>```mermaid\nflowchart TD\nA--&gt;B\n```</code></pre>';
    fixture.detectChanges();

    await flushRenderer();

    const host = fixture.nativeElement as HTMLElement;

    expect(renderSpy).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(/^bv-mermaid-/),
      'flowchart TD\nA-->B',
    );
    expect(host.querySelector('pre')).toBeNull();
    expect(host.querySelector('.mermaid-diagram svg')).not.toBeNull();
  });

  it('ignores regular code blocks', async () => {
    fixture.componentInstance.content = '<pre><code class="language-ts">const value = 1;</code></pre>';
    fixture.detectChanges();

    await flushRenderer();

    const host = fixture.nativeElement as HTMLElement;

    expect(initializeSpy).not.toHaveBeenCalled();
    expect(renderSpy).not.toHaveBeenCalled();
    expect(host.querySelector('pre code.language-ts')?.textContent).toBe('const value = 1;');
  });

  it('keeps invalid mermaid code visible and adds an error message', async () => {
    renderSpy.and.callFake(async () => {
      throw new Error('Parse error');
    });

    fixture.componentInstance.content =
      '<pre><code class="language-mermaid">broken diagram</code></pre>';
    fixture.detectChanges();

    await flushRenderer();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('pre code.language-mermaid')?.textContent).toBe('broken diagram');
    expect(host.querySelector('.mermaid-error')?.textContent).toContain(
      'Mermaid-Diagramm konnte nicht gerendert werden.',
    );
  });
});

async function flushRenderer(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
