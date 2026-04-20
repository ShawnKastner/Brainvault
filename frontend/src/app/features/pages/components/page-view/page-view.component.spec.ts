import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import type { PageResponse } from '../../../../core/models/page.model';
import { API_URL } from '../../../../core/config/api-url.token';
import { SETTINGS_STORAGE_KEY, SettingsService } from '../../../../core/services/settings.service';
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
  let settings: SettingsService;
  let http: HttpTestingController;
  let router: jasmine.SpyObj<Router>;
  let initializeSpy: jasmine.Spy<MermaidRendererApi['initialize']>;
  let renderSpy: jasmine.Spy<MermaidRendererApi['render']>;

  beforeEach(async () => {
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-nav-density');

    initializeSpy = jasmine.createSpy('initialize');
    renderSpy = jasmine.createSpy('render').and.callFake(async (id: string, definition: string) => ({
      svg: `<svg id="${id}"><text>${definition}</text></svg>`,
    }));
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [PageViewComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
        { provide: Router, useValue: router },
        {
          provide: MERMAID_LOADER,
          useValue: async () => ({
            initialize: initializeSpy,
            render: renderSpy,
          }),
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    settings = TestBed.inject(SettingsService);
    http.expectOne('/api/settings').flush({
      theme: 'classic',
      compactNavigation: false,
      showReadingStats: true,
    });
    fixture = TestBed.createComponent(PageViewComponent);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('space', null);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-nav-density');
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

  it('renders uploaded images and removes unsafe image sources', () => {
    fixture.componentRef.setInput('page', {
      ...page,
      content:
        '<p><img src="/api/assets/images/11111111-1111-4111-8111-111111111111.png" alt="Diagramm"></p><p><img src="data:image/png;base64,abc"></p>',
      contentFormat: 'html',
    });
    fixture.detectChanges();

    const images = fixture.nativeElement.querySelectorAll('.page-body img') as NodeListOf<HTMLImageElement>;

    expect(images.length).toBe(1);
    expect(images[0].getAttribute('src')).toBe('/api/assets/images/11111111-1111-4111-8111-111111111111.png');
    expect(images[0].getAttribute('loading')).toBe('lazy');
  });

  it('renders word count and reading time in the meta row', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('3 Wörter');
    expect(text).toContain('ca. 1 Min. Lesezeit');
  });

  it('hides word count and reading time when reading stats are disabled', () => {
    settings.updateSettings({ showReadingStats: false });
    http.expectOne('/api/settings').flush({
      theme: 'classic',
      compactNavigation: false,
      showReadingStats: false,
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.page-reading-stats')).toBeNull();
    expect(host.textContent).not.toContain('3 Wörter');
    expect(host.textContent).not.toContain('ca. 1 Min. Lesezeit');
  });

  it('navigates internal page links through the router', () => {
    fixture.componentRef.setInput('page', {
      ...page,
      content: '<p><a href="/pages/page-2">Roadmap</a></p>',
      contentFormat: 'html',
    });
    fixture.detectChanges();

    const event = runLinkClick(fixture);

    expect(event.defaultPrevented).toBeTrue();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/pages/page-2');
  });

  it('does not intercept external links', () => {
    fixture.componentRef.setInput('page', {
      ...page,
      content: '<p><a href="https://example.com/">Extern</a></p>',
      contentFormat: 'html',
    });
    fixture.detectChanges();

    const event = runLinkClick(fixture);

    expect(event.defaultPrevented).toBeFalse();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});

async function flushRenderer(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function runLinkClick(fixture: ComponentFixture<PageViewComponent>): MouseEvent {
  const body = fixture.nativeElement.querySelector('.page-body') as HTMLElement;
  const anchor = fixture.nativeElement.querySelector('.page-body a') as HTMLAnchorElement;
  const event = {
    altKey: false,
    button: 0,
    ctrlKey: false,
    currentTarget: body,
    defaultPrevented: false,
    metaKey: false,
    preventDefault: jasmine.createSpy('preventDefault').and.callFake(() => {
      (event as { defaultPrevented: boolean }).defaultPrevented = true;
    }),
    shiftKey: false,
    target: anchor,
  } as unknown as MouseEvent;

  fixture.componentInstance.openContentLink(event);
  fixture.detectChanges();
  return event;
}
