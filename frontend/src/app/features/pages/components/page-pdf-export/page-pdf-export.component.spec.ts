import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { API_URL } from '../../../../core/config/api-url.token';
import {
  MERMAID_LOADER,
  MermaidRendererApi,
} from '../../../../shared/directives/mermaid-renderer.directive';
import { PagePdfExportComponent } from './page-pdf-export.component';

describe(PagePdfExportComponent.name, () => {
  let fixture: ComponentFixture<PagePdfExportComponent>;
  let http: HttpTestingController;
  let renderSpy: jasmine.Spy<MermaidRendererApi['render']>;

  beforeEach(async () => {
    renderSpy = jasmine.createSpy('render').and.callFake(async (id: string, definition: string) => ({
      svg: `<svg id="${id}"><text>${definition}</text></svg>`,
    }));

    await TestBed.configureTestingModule({
      imports: [PagePdfExportComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'pageId' ? 'page-1' : null),
              },
            },
          },
        },
        {
          provide: MERMAID_LOADER,
          useValue: async () => ({
            initialize: jasmine.createSpy('initialize'),
            render: renderSpy,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PagePdfExportComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    delete window.__brainvaultPdfReady;
  });

  it('renders a page and marks the export ready after Mermaid rendering completes', async () => {
    expect(window.__brainvaultPdfReady).toBeFalse();

    http.expectOne('/api/pages/page-1').flush({
      id: 'page-1',
      title: 'Roadmap',
      description: 'Beschreibung',
      content: '```mermaid\ngraph TD;A-->B\n```',
      contentFormat: 'markdown',
      tags: ['planung'],
      spaceId: 'space-1',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    fixture.detectChanges();

    await flushRenderer();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Roadmap');
    expect(host.querySelector('.mermaid-diagram svg')).not.toBeNull();
    expect(renderSpy).toHaveBeenCalledOnceWith(jasmine.stringMatching(/^bv-mermaid-/), 'graph TD;A-->B');
    expect(window.__brainvaultPdfReady).toBeTrue();
  });

  it('marks the export ready when loading fails so Gotenberg can finish', () => {
    http.expectOne('/api/pages/page-1').flush('missing', {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Seite konnte nicht geladen werden.',
    );
    expect(window.__brainvaultPdfReady).toBeTrue();
  });
});

async function flushRenderer(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
