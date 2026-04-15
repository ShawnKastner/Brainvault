import {
  AfterViewInit,
  Directive,
  ElementRef,
  InjectionToken,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  inject,
} from '@angular/core';
import DOMPurify from 'dompurify';

export interface MermaidRenderResult {
  svg: string;
  bindFunctions?: (element: Element) => void;
}

export interface MermaidRendererConfig {
  startOnLoad: boolean;
  securityLevel: 'strict';
  htmlLabels: false;
  theme: 'base';
  flowchart: {
    htmlLabels: false;
  };
  themeVariables: {
    arrowheadColor: string;
    background: string;
    edgeLabelBackground: string;
    fontFamily: string;
    labelTextColor: string;
    lineColor: string;
    mainBkg: string;
    nodeBorder: string;
    nodeTextColor: string;
    primaryBorderColor: string;
    primaryColor: string;
    primaryTextColor: string;
    secondaryBorderColor: string;
    secondaryColor: string;
    secondaryTextColor: string;
    tertiaryBorderColor: string;
    tertiaryColor: string;
    tertiaryTextColor: string;
  };
}

export interface MermaidRendererApi {
  initialize(config: MermaidRendererConfig): void;
  render(id: string, text: string): Promise<MermaidRenderResult>;
}

export type MermaidLoader = () => Promise<MermaidRendererApi>;

export const MERMAID_LOADER = new InjectionToken<MermaidLoader>('Mermaid loader', {
  providedIn: 'root',
  factory: () => async () => (await import('mermaid')).default,
});

interface MermaidBlock {
  block: HTMLPreElement;
  definition: string;
}

const MERMAID_CONFIG: MermaidRendererConfig = {
  startOnLoad: false,
  securityLevel: 'strict',
  htmlLabels: false,
  theme: 'base',
  flowchart: {
    htmlLabels: false,
  },
  themeVariables: {
    arrowheadColor: '#888780',
    background: 'transparent',
    edgeLabelBackground: '#252522',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    labelTextColor: '#1A1A18',
    lineColor: '#888780',
    mainBkg: '#F7F6F3',
    nodeBorder: '#BA7517',
    nodeTextColor: '#1A1A18',
    primaryBorderColor: '#BA7517',
    primaryColor: '#F7F6F3',
    primaryTextColor: '#1A1A18',
    secondaryBorderColor: '#854F0B',
    secondaryColor: '#FAEEDA',
    secondaryTextColor: '#1A1A18',
    tertiaryBorderColor: '#6A6963',
    tertiaryColor: '#EFEDE8',
    tertiaryTextColor: '#1A1A18',
  },
};

let nextDiagramId = 0;

@Directive({
  selector: '[bvRenderMermaid]',
  standalone: true,
})
export class MermaidRendererDirective implements AfterViewInit, OnChanges, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly loadMermaid = inject(MERMAID_LOADER);
  private readonly zone = inject(NgZone);

  @Input('bvRenderMermaid') renderTrigger: unknown;

  private destroyed = false;
  private initialized = false;
  private mermaidPromise: Promise<MermaidRendererApi> | null = null;
  private renderRun = 0;
  private scheduled = false;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.scheduleRender();
  }

  ngOnChanges(): void {
    this.scheduleRender();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.renderRun += 1;
  }

  private scheduleRender(): void {
    if (!this.viewReady || this.destroyed || this.scheduled) return;

    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.zone.runOutsideAngular(() => {
        void this.renderMermaidBlocks();
      });
    });
  }

  private async renderMermaidBlocks(): Promise<void> {
    const runId = this.renderRun + 1;
    this.renderRun = runId;

    const blocks = this.findMermaidBlocks();
    if (blocks.length === 0) return;

    let mermaid: MermaidRendererApi;
    try {
      mermaid = await this.getMermaid();
    } catch {
      if (this.isCurrentRun(runId)) {
        blocks.forEach(({ block }) => this.showRenderError(block));
      }
      return;
    }

    if (!this.isCurrentRun(runId)) return;

    await Promise.all(blocks.map((block) => this.renderBlock(block, mermaid, runId)));
  }

  private findMermaidBlocks(): MermaidBlock[] {
    return Array.from(this.host.nativeElement.querySelectorAll('pre > code'))
      .map((code) => this.toMermaidBlock(code))
      .filter((block): block is MermaidBlock => block !== null);
  }

  private toMermaidBlock(code: Element): MermaidBlock | null {
    const block = code.parentElement;
    if (block?.tagName.toLowerCase() !== 'pre') return null;

    const source = code.textContent ?? '';
    const definition = code.classList.contains('language-mermaid')
      ? source.trim()
      : this.extractFencedMermaidDefinition(source);

    if (!definition) return null;

    return {
      block: block as HTMLPreElement,
      definition,
    };
  }

  private extractFencedMermaidDefinition(source: string): string {
    const match = source
      .trim()
      .match(/^(?:```|~~~)mermaid[^\n\r]*(?:\r?\n)([\s\S]*?)(?:\r?\n(?:```|~~~)\s*)?$/i);

    return match?.[1]?.trim() ?? '';
  }

  private async getMermaid(): Promise<MermaidRendererApi> {
    this.mermaidPromise ??= this.loadMermaid();
    const mermaid = await this.mermaidPromise;

    if (!this.initialized) {
      mermaid.initialize(MERMAID_CONFIG);
      this.initialized = true;
    }

    return mermaid;
  }

  private async renderBlock(
    mermaidBlock: MermaidBlock,
    mermaid: MermaidRendererApi,
    runId: number,
  ): Promise<void> {
    const { block, definition } = mermaidBlock;

    this.removeExistingError(block);

    try {
      const diagramId = `bv-mermaid-${Date.now()}-${nextDiagramId}`;
      nextDiagramId += 1;

      const result = await mermaid.render(diagramId, definition);
      if (!this.isCurrentRun(runId) || !block.isConnected) return;

      const svg = DOMPurify.sanitize(result.svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
      });
      if (!svg.trim()) throw new Error('Mermaid rendered an empty diagram.');

      const wrapper = document.createElement('figure');
      wrapper.className = 'mermaid-diagram';
      wrapper.setAttribute('aria-label', 'Mermaid-Diagramm');

      const viewport = document.createElement('div');
      viewport.className = 'mermaid-diagram__viewport';
      viewport.innerHTML = svg;

      wrapper.appendChild(viewport);
      block.replaceWith(wrapper);
      result.bindFunctions?.(wrapper);
    } catch {
      if (!this.isCurrentRun(runId) || !block.isConnected) return;
      this.showRenderError(block);
    }
  }

  private showRenderError(block: HTMLPreElement): void {
    block.classList.add('mermaid-source', 'mermaid-source--error');

    const error = document.createElement('p');
    error.className = 'mermaid-error';
    error.textContent = 'Mermaid-Diagramm konnte nicht gerendert werden.';

    this.removeExistingError(block);
    block.insertAdjacentElement('afterend', error);
  }

  private removeExistingError(block: HTMLPreElement): void {
    const nextElement = block.nextElementSibling;
    if (nextElement?.classList.contains('mermaid-error')) {
      nextElement.remove();
    }
  }

  private isCurrentRun(runId: number): boolean {
    return !this.destroyed && this.renderRun === runId;
  }
}
