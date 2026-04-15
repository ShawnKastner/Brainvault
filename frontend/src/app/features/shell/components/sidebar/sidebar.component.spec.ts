import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { SpaceWithPagesResponse } from '../../../../core/models/space.model';
import { SidebarComponent } from './sidebar.component';

const space: SpaceWithPagesResponse = {
  id: 'space-1',
  name: 'Notes',
  description: null,
  color: '#378ADD',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  pages: [],
};

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

  it('emits delete requests without toggling the space', () => {
    const deleted: SpaceWithPagesResponse[] = [];
    const toggled: string[] = [];
    fixture.componentRef.setInput('spaces', [space]);
    fixture.componentInstance.deleteSpace.subscribe((value) => deleted.push(value));
    fixture.componentInstance.toggleSpace.subscribe((value) => toggled.push(value));
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.nav-section-delete') as HTMLButtonElement;
    button.click();

    expect(deleted).toEqual([space]);
    expect(toggled).toEqual([]);
  });
});
