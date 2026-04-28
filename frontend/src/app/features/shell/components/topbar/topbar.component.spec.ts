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
});
