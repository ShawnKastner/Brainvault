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
import { DOCUMENT } from '@angular/common';
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
  element: HTMLElement;
  definition: string;
}

const DEFAULT_THEME_VARIABLES: MermaidRendererConfig['themeVariables'] = {
  arrowheadColor: '#888780',
  background: 'transparent',
  edgeLabelBackground: '#FFFFFF',
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
  tertiaryBorderColor: '#888780',
  tertiaryColor: '#EFEDE8',
  tertiaryTextColor: '#1A1A18',
};

const MERMAID_CONFIG_BASE: Omit<MermaidRendererConfig, 'themeVariables'> = {
  startOnLoad: false,
  securityLevel: 'strict',
  htmlLabels: false,
  theme: 'base',
  flowchart: {
    htmlLabels: false,
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
  private readonly document = inject(DOCUMENT);

  @Input('bvRenderMermaid') renderTrigger: unknown;

  private destroyed = false;
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
        blocks.forEach(({ element }) => this.showRenderError(element));
      }
      return;
    }

    if (!this.isCurrentRun(runId)) return;

    mermaid.initialize(this.buildMermaidConfig());
    await Promise.all(blocks.map((block) => this.renderBlock(block, mermaid, runId)));
  }

  private findMermaidBlocks(): MermaidBlock[] {
    const sourceBlocks = Array.from(this.host.nativeElement.querySelectorAll('pre > code'))
      .map((code) => this.toMermaidBlock(code))
      .filter((block): block is MermaidBlock => block !== null);

    const renderedBlocks = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.mermaid-diagram[data-mermaid-definition]'),
    ).map((element) => ({
      element,
      definition: element.dataset['mermaidDefinition'] ?? '',
    })).filter((block) => block.definition.trim().length > 0);

    return [...sourceBlocks, ...renderedBlocks];
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
      element: block as HTMLPreElement,
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
    return this.mermaidPromise;
  }

  private async renderBlock(
    mermaidBlock: MermaidBlock,
    mermaid: MermaidRendererApi,
    runId: number,
  ): Promise<void> {
    const { element, definition } = mermaidBlock;

    this.removeExistingError(element);

    try {
      const diagramId = `bv-mermaid-${Date.now()}-${nextDiagramId}`;
      nextDiagramId += 1;

      const result = await mermaid.render(diagramId, definition);
      if (!this.isCurrentRun(runId) || !element.isConnected) return;

      const svg = DOMPurify.sanitize(result.svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
      });
      if (!svg.trim()) throw new Error('Mermaid rendered an empty diagram.');

      const wrapper = this.document.createElement('figure');
      wrapper.className = 'mermaid-diagram';
      wrapper.setAttribute('aria-label', 'Mermaid-Diagramm');
      wrapper.dataset['mermaidDefinition'] = definition;

      const viewport = this.document.createElement('div');
      viewport.className = 'mermaid-diagram__viewport';
      viewport.innerHTML = svg;

      wrapper.appendChild(viewport);
      element.replaceWith(wrapper);
      result.bindFunctions?.(wrapper);
    } catch {
      if (!this.isCurrentRun(runId) || !element.isConnected) return;
      this.showRenderError(element);
    }
  }

  private buildMermaidConfig(): MermaidRendererConfig {
    const styles = this.document.defaultView?.getComputedStyle(this.document.documentElement);
    const cssVar = (name: string, fallback: string) => {
      const value = styles?.getPropertyValue(name).trim();
      return value || fallback;
    };

    const text = cssVar('--color-text', DEFAULT_THEME_VARIABLES.nodeTextColor);
    const textMuted = cssVar('--color-text-muted', DEFAULT_THEME_VARIABLES.lineColor);
    const surface = cssVar('--color-surface', DEFAULT_THEME_VARIABLES.edgeLabelBackground);
    const surfaceSubtle = cssVar('--color-surface-subtle', DEFAULT_THEME_VARIABLES.mainBkg);
    const surfaceApp = cssVar('--color-surface-app', DEFAULT_THEME_VARIABLES.tertiaryColor);
    const accent = cssVar('--color-accent', DEFAULT_THEME_VARIABLES.nodeBorder);
    const accentStrong = cssVar('--color-accent-strong', DEFAULT_THEME_VARIABLES.secondaryBorderColor);
    const accentSoft = cssVar('--color-accent-soft', DEFAULT_THEME_VARIABLES.secondaryColor);

    return {
      ...MERMAID_CONFIG_BASE,
      themeVariables: {
        arrowheadColor: textMuted,
        background: 'transparent',
        edgeLabelBackground: surface,
        fontFamily: cssVar('--font-sans', DEFAULT_THEME_VARIABLES.fontFamily),
        labelTextColor: text,
        lineColor: textMuted,
        mainBkg: surfaceSubtle,
        nodeBorder: accent,
        nodeTextColor: text,
        primaryBorderColor: accent,
        primaryColor: surfaceSubtle,
        primaryTextColor: text,
        secondaryBorderColor: accentStrong,
        secondaryColor: accentSoft,
        secondaryTextColor: text,
        tertiaryBorderColor: textMuted,
        tertiaryColor: surfaceApp,
        tertiaryTextColor: text,
      },
    };
  }

  private showRenderError(element: HTMLElement): void {
    element.classList.add('mermaid-source', 'mermaid-source--error');

    const error = this.document.createElement('p');
    error.className = 'mermaid-error';
    error.textContent = 'Mermaid-Diagramm konnte nicht gerendert werden.';

    this.removeExistingError(element);
    element.insertAdjacentElement('afterend', error);
  }

  private removeExistingError(element: HTMLElement): void {
    const nextElement = element.nextElementSibling;
    if (nextElement?.classList.contains('mermaid-error')) {
      nextElement.remove();
    }
  }

  private isCurrentRun(runId: number): boolean {
    return !this.destroyed && this.renderRun === runId;
  }
}
