import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewEncapsulation,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Editor } from '@tiptap/core';
import type { Range } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type {
  PageResponse,
  UpdatePageRequest,
} from '../../../../core/models/page.model';
import type { SpaceWithPagesResponse } from '../../../../core/models/space.model';

type HeadingLevel = 1 | 2 | 3;
type LinkMode = 'url' | 'document';

interface LinkableDocument {
  id: string;
  title: string;
  description: string | null;
  spacePath: string;
  href: string;
}

const INTERNAL_PAGE_LINK_PATTERN = /^\/pages\/([^/?#]+)$/;

@Component({
  selector: 'bv-page-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './page-editor.component.html',
  styleUrl: './page-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageEditorComponent implements AfterViewInit, OnDestroy {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly changeDetector = inject(ChangeDetectorRef);

  @ViewChild('editorHost', { static: true }) private editorHost?: ElementRef<HTMLElement>;

  readonly page = input.required<PageResponse>();
  readonly linkableSpaces = input<SpaceWithPagesResponse[]>([]);
  readonly saving = input(false);
  readonly save = output<UpdatePageRequest>();
  readonly cancel = output<void>();

  editor: Editor | null = null;

  readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    tags: [''],
  });

  protected readonly linkModalOpen = signal(false);
  protected readonly linkMode = signal<LinkMode>('url');
  protected readonly linkUrl = signal('');
  protected readonly linkSearchQuery = signal('');
  protected readonly selectedDocumentId = signal<string | null>(null);
  protected readonly linkError = signal<string | null>(null);
  protected readonly currentLinkHref = signal<string | null>(null);
  protected readonly linkableDocuments = computed(() => flattenLinkableDocuments(this.linkableSpaces()));
  protected readonly filteredLinkableDocuments = computed(() => {
    const query = normalizeSearch(this.linkSearchQuery());
    const documents = this.linkableDocuments();
    if (!query) return documents;

    return documents.filter((document) =>
      [document.title, document.description, document.spacePath].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  });
  protected readonly selectedDocument = computed(() => {
    const selectedId = this.selectedDocumentId();
    if (!selectedId) return null;
    return this.linkableDocuments().find((document) => document.id === selectedId) ?? null;
  });
  protected readonly linkSubmitLabel = computed(() =>
    this.currentLinkHref() ? 'Aktualisieren' : 'Einfügen',
  );

  private pendingEditorContent = '';
  private linkSelection: Range | null = null;

  constructor() {
    effect(() => {
      const page = this.page();
      this.form.reset(
        {
          title: page.title,
          description: page.description ?? '',
          tags: page.tags.join(', '),
        },
        { emitEvent: false },
      );

      this.pendingEditorContent = this.toEditorHtml(page);
      this.editor?.commands.setContent(this.pendingEditorContent, { emitUpdate: false });
      this.changeDetector.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    if (!this.editorHost) return;

    this.editor = new Editor({
      element: this.editorHost.nativeElement,
      content: this.pendingEditorContent,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          link: {
            autolink: true,
            linkOnPaste: true,
            openOnClick: false,
            HTMLAttributes: {
              rel: 'noopener noreferrer',
              target: '_blank',
            },
          },
        }),
        Placeholder.configure({
          placeholder: 'Schreibe deine Notizen, Entscheidungen oder naechsten Schritte...',
        }),
        TableKit.configure({
          table: {
            resizable: true,
          },
        }),
      ],
      editorProps: {
        attributes: {
          'aria-label': 'Seiteninhalt',
          class: 'editor-document',
        },
      },
      onSelectionUpdate: () => this.changeDetector.markForCheck(),
      onTransaction: () => this.changeDetector.markForCheck(),
    });

    this.changeDetector.detectChanges();
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();
    this.save.emit({
      title: formValue.title.trim(),
      description: formValue.description,
      content: this.readEditorHtml(),
      contentFormat: 'html',
      tags: formValue.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    });
  }

  setParagraph(): void {
    this.editor?.chain().focus().setParagraph().run();
  }

  toggleHeading(level: HeadingLevel): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  toggleCode(): void {
    this.editor?.chain().focus().toggleCode().run();
  }

  toggleCodeBlock(): void {
    this.editor?.chain().focus().toggleCodeBlock().run();
  }

  toggleBlockquote(): void {
    this.editor?.chain().focus().toggleBlockquote().run();
  }

  setLink(): void {
    this.openLinkModal();
  }

  openLinkModal(): void {
    if (!this.editor) return;

    const currentHref = readStringAttribute(this.editor.getAttributes('link')['href']);
    if (currentHref) {
      this.editor.chain().focus().extendMarkRange('link').run();
    }

    const { from, to } = this.editor.state.selection;
    this.linkSelection = { from, to };
    this.currentLinkHref.set(currentHref);
    this.linkError.set(null);

    const internalPageId = currentHref ? readInternalPageId(currentHref) : null;
    if (internalPageId) {
      this.linkMode.set('document');
      this.selectedDocumentId.set(internalPageId);
      this.linkSearchQuery.set('');
      this.linkUrl.set('');
    } else {
      this.linkMode.set('url');
      this.linkUrl.set(currentHref);
      this.selectedDocumentId.set(null);
      this.linkSearchQuery.set('');
    }

    this.linkModalOpen.set(true);
    this.changeDetector.markForCheck();
  }

  closeLinkModal(): void {
    this.linkModalOpen.set(false);
    this.linkError.set(null);
    this.linkSelection = null;
  }

  selectLinkMode(mode: LinkMode): void {
    this.linkMode.set(mode);
    this.linkError.set(null);
  }

  updateLinkUrl(value: string): void {
    this.linkUrl.set(value);
    this.linkError.set(null);
  }

  updateLinkSearch(value: string): void {
    this.linkSearchQuery.set(value);
  }

  selectDocument(document: LinkableDocument): void {
    this.selectedDocumentId.set(document.id);
    this.linkError.set(null);
  }

  applyLink(): void {
    if (!this.editor || !this.linkSelection) return;

    if (this.linkMode() === 'document') {
      const document = this.selectedDocument();
      if (!document) {
        this.linkError.set('Wähle ein Dokument aus.');
        return;
      }

      this.applyLinkAttributes(
        {
          href: document.href,
          rel: null,
          target: null,
        },
        document.title,
      );
      this.closeLinkModal();
      return;
    }

    const normalizedUrl = normalizeExternalUrl(this.linkUrl());
    if (!normalizedUrl) {
      this.linkError.set('Gib eine gültige URL ein.');
      return;
    }

    this.linkUrl.set(normalizedUrl);
    this.applyLinkAttributes(
      {
        href: normalizedUrl,
        rel: 'noopener noreferrer',
        target: '_blank',
      },
      normalizedUrl,
    );
    this.closeLinkModal();
  }

  removeLink(): void {
    if (!this.editor || !this.linkSelection) return;

    this.editor
      .chain()
      .focus()
      .setTextSelection(this.linkSelection)
      .extendMarkRange('link')
      .unsetLink()
      .run();
    this.closeLinkModal();
  }

  insertTable(): void {
    this.editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  addTableRow(): void {
    this.editor?.chain().focus().addRowAfter().run();
  }

  addTableColumn(): void {
    this.editor?.chain().focus().addColumnAfter().run();
  }

  deleteTable(): void {
    this.editor?.chain().focus().deleteTable().run();
  }

  undo(): void {
    this.editor?.chain().focus().undo().run();
  }

  redo(): void {
    this.editor?.chain().focus().redo().run();
  }

  isActive(name: string): boolean {
    return this.editor?.isActive(name) ?? false;
  }

  isHeading(level: HeadingLevel): boolean {
    return this.editor?.isActive('heading', { level }) ?? false;
  }

  isTableActive(): boolean {
    return this.editor?.isActive('table') ?? false;
  }

  canUndo(): boolean {
    return this.editor?.can().undo() ?? false;
  }

  canRedo(): boolean {
    return this.editor?.can().redo() ?? false;
  }

  @HostListener('document:keydown.escape')
  closeLinkModalOnEscape(): void {
    if (this.linkModalOpen()) {
      this.closeLinkModal();
    }
  }

  private applyLinkAttributes(
    attributes: { href: string; target?: string | null; rel?: string | null },
    fallbackText: string,
  ): void {
    if (!this.editor || !this.linkSelection) return;

    const hasSelection = this.linkSelection.from !== this.linkSelection.to;
    const chain = this.editor.chain().focus().setTextSelection(this.linkSelection);

    if (hasSelection) {
      chain.extendMarkRange('link').setLink(attributes).run();
      return;
    }

    chain
      .insertContent({
        type: 'text',
        text: fallbackText,
        marks: [
          {
            type: 'link',
            attrs: attributes,
          },
        ],
      })
      .run();
  }

  private readEditorHtml(): string {
    if (!this.editor || this.editor.isEmpty) return '';
    return this.editor.getHTML();
  }

  private toEditorHtml(page: PageResponse): string {
    if (!page.content) return '';

    const html =
      page.contentFormat === 'markdown'
        ? marked.parse(page.content, { async: false })
        : page.content;

    return DOMPurify.sanitize(html);
  }
}

function flattenLinkableDocuments(spaces: SpaceWithPagesResponse[]): LinkableDocument[] {
  return spaces.flatMap((space) => flattenSpaceDocuments(space));
}

function flattenSpaceDocuments(
  space: SpaceWithPagesResponse,
  ancestors: SpaceWithPagesResponse[] = [],
): LinkableDocument[] {
  const path = [...ancestors, space];
  const spacePath = path.map((entry) => entry.name).join(' / ');
  return [
    ...space.pages.map((page) => ({
      id: page.id,
      title: page.title,
      description: page.description,
      spacePath,
      href: `/pages/${page.id}`,
    })),
    ...space.children.flatMap((child) => flattenSpaceDocuments(child, path)),
  ];
}

function normalizeExternalUrl(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const urlValue = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const url = new URL(urlValue);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function readInternalPageId(href: string): string | null {
  return INTERNAL_PAGE_LINK_PATTERN.exec(href)?.[1] ?? null;
}

function readStringAttribute(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}
