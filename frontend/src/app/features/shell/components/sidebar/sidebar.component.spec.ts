import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidebarComponent } from './sidebar.component';

describe(SidebarComponent.name, () => {
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('spaces', []);
    fixture.detectChanges();
  });

  it('emits create requests from the new space form', () => {
    const emitted: unknown[] = [];
    fixture.componentInstance.createSpace.subscribe((value) => emitted.push(value));

    fixture.componentInstance.spaceForm.setValue({ name: ' Notes ', color: '#378ADD' });
    fixture.componentInstance.submitSpace();

    expect(emitted).toEqual([{ name: 'Notes', color: '#378ADD' }]);
  });
});
