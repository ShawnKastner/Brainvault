import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TopbarComponent } from './topbar.component';

describe(TopbarComponent.name, () => {
  let fixture: ComponentFixture<TopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TopbarComponent);
    fixture.detectChanges();
  });

  it('does not render the mobile navigation button outside compact layout', () => {
    expect(fixture.nativeElement.querySelector('.mobile-nav-button')).toBeNull();
  });

  it('renders the mobile navigation button in compact layout and emits toggle events', () => {
    let toggled = 0;
    fixture.componentRef.setInput('compactLayout', true);
    fixture.componentRef.setInput('mobileNavOpen', true);
    fixture.componentInstance.toggleMobileNav.subscribe(() => {
      toggled += 1;
    });
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.mobile-nav-button') as HTMLButtonElement;
    button.click();

    expect(button.getAttribute('aria-controls')).toBe('app-sidebar');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(toggled).toBe(1);
  });

  it('renders the PDF export button for active pages and disables it while exporting', () => {
    let exported = 0;
    fixture.componentRef.setInput('activePage', {
      id: 'page-1',
      title: 'Roadmap',
      description: null,
      content: null,
      contentFormat: 'html',
      tags: [],
      spaceId: 'space-1',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    fixture.componentInstance.exportPdf.subscribe(() => {
      exported += 1;
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const exportButton = Array.from(host.querySelectorAll<HTMLButtonElement>('.topbar-actions .button')).find(
      (button) => button.textContent?.includes('PDF exportieren'),
    );
    exportButton?.click();

    expect(exportButton).toBeDefined();
    expect(exported).toBe(1);

    fixture.componentRef.setInput('exportingPdf', true);
    fixture.detectChanges();

    const disabledButton = Array.from(
      host.querySelectorAll<HTMLButtonElement>('.topbar-actions .button'),
    ).find((button) => button.textContent?.includes('Exportiert'));

    expect(disabledButton?.disabled).toBeTrue();
  });
});
