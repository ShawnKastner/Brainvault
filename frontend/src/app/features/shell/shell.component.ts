import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { UpdatePageRequest } from '../../core/models/page.model';
import type { CreateSpaceRequest } from '../../core/models/space.model';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { PageEditorComponent } from '../pages/components/page-editor/page-editor.component';
import { PageViewComponent } from '../pages/components/page-view/page-view.component';
import { KnowledgeBaseStore } from '../pages/services/knowledge-base.store';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';

@Component({
  selector: 'bv-shell',
  standalone: true,
  imports: [
    EmptyStateComponent,
    PageEditorComponent,
    PageViewComponent,
    ReactiveFormsModule,
    SidebarComponent,
    TopbarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly store = inject(KnowledgeBaseStore);
  protected readonly openSpaces = signal<Partial<Record<string, boolean>>>({});
  protected readonly editMode = signal(false);
  protected readonly showNewPage = signal(false);

  protected readonly newPageForm = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    spaceId: ['', Validators.required],
  });

  @ViewChild(PageEditorComponent) private pageEditor?: PageEditorComponent;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const pageId = params.get('pageId');
      this.editMode.set(false);
      this.store.selectPage(pageId);
      this.store.loadSpaces(pageId);
    });

    effect(() => {
      const spaceId = this.store.activeSpace()?.id ?? this.store.spaces()[0]?.id;
      if (spaceId && !this.newPageForm.controls.spaceId.value) {
        this.newPageForm.controls.spaceId.setValue(spaceId, { emitEvent: false });
      }
    });
  }

  protected toggleSpace(spaceId: string): void {
    const isFirstSpace = this.store.spaces()[0]?.id === spaceId;
    const currentValue = this.openSpaces()[spaceId] ?? isFirstSpace;
    this.openSpaces.update((spaces) => ({ ...spaces, [spaceId]: !currentValue }));
  }

  protected selectPage(pageId: string): void {
    const spaceId = this.store.spaces().find((space) => space.pages.some((page) => page.id === pageId))?.id;
    if (spaceId) {
      this.openSpaces.update((spaces) => ({ ...spaces, [spaceId]: true }));
    }

    this.editMode.set(false);
    this.showNewPage.set(false);
    void this.router.navigate(['/pages', pageId]);
  }

  protected createSpace(request: CreateSpaceRequest): void {
    this.store.createSpace(request);
  }

  protected submitNewPage(): void {
    if (this.newPageForm.invalid) {
      this.newPageForm.markAllAsTouched();
      return;
    }

    const value = this.newPageForm.getRawValue();
    this.store.createPage(
      {
        title: value.title.trim(),
        spaceId: value.spaceId,
        contentFormat: 'html',
      },
      (page) => {
        this.showNewPage.set(false);
        this.newPageForm.reset({
          title: '',
          spaceId: value.spaceId,
        });
        this.editMode.set(true);
        void this.router.navigate(['/pages', page.id]);
      },
    );
  }

  protected savePage(request: UpdatePageRequest): void {
    const page = this.store.activePage();
    if (!page) return;

    this.store.updatePage(page.id, request, () => this.editMode.set(false));
  }

  protected savePageFromTopbar(): void {
    this.pageEditor?.submit();
  }

  protected deleteActivePage(): void {
    const page = this.store.activePage();
    if (!page) return;
    if (!confirm(`"${page.title}" wirklich loeschen?`)) return;

    this.store.deletePage(page.id, (nextPageId) => {
      this.editMode.set(false);
      void this.router.navigate(nextPageId ? ['/pages', nextPageId] : ['/']);
    });
  }
}
