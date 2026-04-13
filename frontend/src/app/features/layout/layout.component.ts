import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SpacesService } from '../../core/services/spaces.service';
import { PagesService } from '../../core/services/pages.service';
import type { SpaceWithPages } from '../../core/models/space.model';
import type { Page, UpdatePageDto } from '../../core/models/page.model';

@Component({
  selector: 'bv-layout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit {
  private spacesService = inject(SpacesService);
  private pagesService = inject(PagesService);
  private sanitizer = inject(DomSanitizer);

  // ── Reactive state (signals) ──────────────────────────────────
  spaces        = signal<SpaceWithPages[]>([]);
  activePage    = signal<Page | null>(null);
  openSpaces    = signal<Record<string, boolean>>({});
  editMode      = signal(false);
  loading       = signal(true);
  saving        = signal(false);
  showNewPage   = signal(false);
  showNewSpace  = signal(false);

  activeSpace = computed(() => {
    const page = this.activePage();
    if (!page) return null;
    return this.spaces().find((s) => s.id === page.spaceId) ?? null;
  });

  safeContent = computed((): SafeHtml => {
    const page = this.activePage();
    const html = page?.content ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  // ── Form fields (plain props for ngModel) ─────────────────────
  editTitle       = '';
  editDescription = '';
  editContent     = '';
  editTags        = '';

  newPageTitle   = '';
  newPageSpaceId = '';

  newSpaceName  = '';
  newSpaceColor = '#378ADD';

  ngOnInit(): void {
    this.loadSpaces();
  }

  loadSpaces(): void {
    this.loading.set(true);
    this.spacesService.getAll().subscribe({
      next: (spaces) => {
        this.spaces.set(spaces);
        this.loading.set(false);
        const open: Record<string, boolean> = {};
        if (spaces.length > 0) {
          open[spaces[0].id] = true;
          const firstPages = spaces[0].pages ?? [];
          if (firstPages.length > 0) this.activePage.set(firstPages[0]);
        }
        this.openSpaces.set(open);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleSpace(spaceId: string): void {
    this.openSpaces.update((s) => ({ ...s, [spaceId]: !s[spaceId] }));
  }

  selectPage(page: Page): void {
    this.activePage.set(page);
    this.editMode.set(false);
    this.showNewPage.set(false);
  }

  startEdit(): void {
    const page = this.activePage();
    if (!page) return;
    this.editTitle       = page.title;
    this.editDescription = page.description ?? '';
    this.editContent     = page.content ?? '';
    this.editTags        = page.tags.join(', ');
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

  savePage(): void {
    const page = this.activePage();
    if (!page) return;
    this.saving.set(true);
    const dto: UpdatePageDto = {
      title:       this.editTitle,
      description: this.editDescription || undefined,
      content:     this.editContent || undefined,
      tags:        this.editTags.split(',').map((t) => t.trim()).filter((t) => t.length > 0),
    };
    this.pagesService.update(page.id, dto).subscribe({
      next: (updated) => {
        this.activePage.set(updated);
        this.editMode.set(false);
        this.saving.set(false);
        this.loadSpaces();
      },
      error: () => this.saving.set(false),
    });
  }

  deletePage(page: Page): void {
    if (!confirm(`"${page.title}" wirklich loeschen?`)) return;
    this.pagesService.remove(page.id).subscribe(() => {
      this.activePage.set(null);
      this.loadSpaces();
    });
  }

  createPage(): void {
    const title   = this.newPageTitle.trim();
    const spaceId = this.newPageSpaceId;
    if (!title || !spaceId) return;
    this.pagesService.create({ title, spaceId }).subscribe({
      next: (page) => {
        this.newPageTitle = '';
        this.showNewPage.set(false);
        this.loadSpaces();
        this.activePage.set(page);
        setTimeout(() => this.startEdit(), 150);
      },
    });
  }

  createSpace(): void {
    const name = this.newSpaceName.trim();
    if (!name) return;
    this.spacesService.create({ name, color: this.newSpaceColor }).subscribe({
      next: () => {
        this.newSpaceName = '';
        this.showNewSpace.set(false);
        this.loadSpaces();
      },
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }
}
