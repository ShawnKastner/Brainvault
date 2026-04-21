import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Editor } from '@tiptap/core';
import type { Range } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import { marked } from 'marked';
import { firstValueFrom } from 'rxjs';
import { ImagesApiService } from '../../../../core/api/images-api.service';
import type { ImageUploadResponse } from '../../../../core/api/images-api.service';
import type {
  PageResponse,
  UpdatePageRequest,
} from '../../../../core/models/page.model';
import type { SpaceWithPagesResponse } from '../../../../core/models/space.model';
import { sanitizePageHtml } from '../../../../shared/utils/page-html-sanitizer';

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
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

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
  private readonly destroyRef = inject(DestroyRef);
  private readonly imagesApi = inject(ImagesApiService);

  @ViewChild('editorHost', { static: true }) private editorHost?: ElementRef<HTMLElement>;
  @ViewChild('imageInput') private imageInput?: ElementRef<HTMLInputElement>;

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
  protected readonly imageUploading = signal(false);
  protected readonly imageError = signal<string | null>(null);

  private pendingEditorContent = '';
  private linkSelection: Range | null = null;
  private imageInsertPosition: number | null = null;

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
        Image.configure({
          allowBase64: false,
          HTMLAttributes: {
            loading: 'lazy',
          },
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
        handlePaste: (_view, event) => this.handleEditorPaste(event),
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

  openImagePicker(): void {
    if (!this.editor || this.imageUploading()) return;

    this.imageError.set(null);
    this.imageInsertPosition = this.editor.state.selection.from;
    this.imageInput?.nativeElement.click();
  }

  insertSelectedImage(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0] ?? null;
    if (input) input.value = '';
    if (!file || !this.editor) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      this.imageError.set('Nur PNG, JPEG, WebP und GIF Bilder sind erlaubt.');
      this.changeDetector.markForCheck();
      return;
    }

    this.imageUploading.set(true);
    this.imageError.set(null);
    this.imagesApi
      .uploadImage(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (image) => {
          const chain = this.editor?.chain().focus();
          if (!chain) return;

          if (this.imageInsertPosition !== null) {
            chain.setTextSelection(this.imageInsertPosition);
          }

          chain
            .setImage({
              src: image.url,
              alt: image.originalName,
              title: image.originalName,
            })
            .run();
          this.imageUploading.set(false);
          this.imageInsertPosition = null;
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.imageUploading.set(false);
          this.imageError.set('Das Bild konnte nicht hochgeladen werden.');
          this.imageInsertPosition = null;
          this.changeDetector.markForCheck();
        },
      });
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

  removeTableRow(): void {
    this.editor?.chain().focus().deleteRow().run();
  }

  addTableColumn(): void {
    this.editor?.chain().focus().addColumnAfter().run();
  }

  removeTableColumn(): void {
    this.editor?.chain().focus().deleteColumn().run();
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

  private handleEditorPaste(event: ClipboardEvent): boolean {
    if (!this.editor || !event.clipboardData) return false;

    const imageFiles = readClipboardImageFiles(event.clipboardData);
    const html = event.clipboardData.getData('text/html');
    const htmlHasImages = containsImageElements(html);

    if (imageFiles.length === 0 && !htmlHasUploadableImages(html)) {
      return false;
    }

    event.preventDefault();
    const selection = {
      from: this.editor.state.selection.from,
      to: this.editor.state.selection.to,
    };

    void this.insertPastedContent({
      html,
      text: event.clipboardData.getData('text/plain'),
      imageFiles,
      appendLooseFiles: !htmlHasImages,
      selection,
    });

    return true;
  }

  private async insertPastedContent(input: {
    html: string;
    text: string;
    imageFiles: File[];
    appendLooseFiles: boolean;
    selection: Range;
  }): Promise<void> {
    if (!this.editor) return;

    this.imageUploading.set(true);
    this.imageError.set(null);
    this.changeDetector.markForCheck();

    let hadUploadError = false;

    try {
      const parts: string[] = [];

      if (input.html) {
        const htmlResult = await this.replacePastedHtmlImages(input.html, input.imageFiles);
        parts.push(htmlResult.html);
        hadUploadError = hadUploadError || htmlResult.hadUploadError;
      } else if (input.text) {
        parts.push(textToHtml(input.text));
      }

      if (input.appendLooseFiles) {
        const looseImages = await Promise.all(
          input.imageFiles.map(async (file) => {
            try {
              return imageResponseToHtml(await this.uploadImageFile(file));
            } catch {
              hadUploadError = true;
              return '';
            }
          }),
        );
        parts.push(...looseImages);
      }

      const content = sanitizePageHtml(parts.join(''));
      if (content) {
        this.editor.chain().focus().setTextSelection(input.selection).insertContent(content).run();
      }
    } finally {
      this.imageUploading.set(false);
      if (hadUploadError) {
        this.imageError.set('Eingefuegte Bilder konnten nicht vollstaendig hochgeladen werden.');
      }
      this.changeDetector.markForCheck();
    }
  }

  private async replacePastedHtmlImages(
    html: string,
    imageFiles: File[],
  ): Promise<{ html: string; hadUploadError: boolean }> {
    const template = document.createElement('template');
    template.innerHTML = html;
    const images = Array.from(template.content.querySelectorAll<HTMLImageElement>('img'));
    let nextFileIndex = 0;
    let hadUploadError = false;

    await Promise.all(
      images.map(async (image, index) => {
        const source = readPastedImageSource(image);
        const dataUrlFile = source ? dataUrlToImageFile(source, index) : null;
        const clipboardFile =
          !dataUrlFile && shouldReplaceWithClipboardImage(source)
            ? imageFiles[nextFileIndex++]
            : null;
        const file = dataUrlFile ?? clipboardFile;

        if (!file) return;

        try {
          const uploadedImage = await this.uploadImageFile(file);
          image.setAttribute('src', uploadedImage.url);
          if (!image.hasAttribute('alt')) {
            image.setAttribute('alt', uploadedImage.originalName);
          }
          image.setAttribute('title', uploadedImage.originalName);
          image.setAttribute('loading', 'lazy');
        } catch {
          image.remove();
          hadUploadError = true;
        }
      }),
    );

    return {
      html: sanitizePageHtml(template.innerHTML),
      hadUploadError,
    };
  }

  private uploadImageFile(file: File): Promise<ImageUploadResponse> {
    return firstValueFrom(this.imagesApi.uploadImage(file).pipe(takeUntilDestroyed(this.destroyRef)));
  }

  private toEditorHtml(page: PageResponse): string {
    if (!page.content) return '';

    const html =
      page.contentFormat === 'markdown'
        ? marked.parse(page.content, { async: false })
        : page.content;

    return sanitizePageHtml(html);
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

function readClipboardImageFiles(clipboard: DataTransfer): File[] {
  const files: File[] = [];

  for (const item of Array.from(clipboard.items ?? [])) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file && isAllowedImageFile(file)) {
      files.push(file);
    }
  }

  for (const file of Array.from(clipboard.files ?? [])) {
    if (isAllowedImageFile(file)) {
      files.push(file);
    }
  }

  return dedupeFiles(files);
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = `${file.name}:${file.type}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function containsImageElements(html: string): boolean {
  return /<img[\s>]/i.test(html);
}

function htmlHasUploadableImages(html: string): boolean {
  if (!html || !containsImageElements(html)) return false;

  const template = document.createElement('template');
  template.innerHTML = html;

  return Array.from(template.content.querySelectorAll<HTMLImageElement>('img')).some((image) => {
    const source = readPastedImageSource(image);
    return Boolean(dataUrlToImageFile(source, 0) || shouldReplaceWithClipboardImage(source));
  });
}

function readPastedImageSource(image: HTMLImageElement): string {
  return (
    image.getAttribute('src') ??
    image.getAttribute('data-src') ??
    image.getAttribute('data-original-src') ??
    ''
  );
}

function shouldReplaceWithClipboardImage(src: string): boolean {
  if (!src) return true;
  if (/^data:/i.test(src)) return false;
  if (src.startsWith('/api/assets/images/')) return false;
  if (/^(?:https?:)?\/\//i.test(src)) return false;

  try {
    const url = new URL(src);
    return url.protocol !== 'http:' && url.protocol !== 'https:';
  } catch {
    return true;
  }
}

function dataUrlToImageFile(src: string, index: number): File | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(src);
  if (!match) return null;

  const contentType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) return null;

  try {
    const data = match[3].replace(/\s/g, '');
    const raw = match[2]
      ? globalThis.atob(data)
      : decodeURIComponent(data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i);
    }

    return new File([bytes], `pasted-image-${index + 1}${extensionForImageType(contentType)}`, {
      type: contentType,
    });
  } catch {
    return null;
  }
}

function extensionForImageType(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.png';
  }
}

function isAllowedImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type);
}

function imageResponseToHtml(image: ImageUploadResponse): string {
  return `<img src="${escapeHtmlAttribute(image.url)}" alt="${escapeHtmlAttribute(
    image.originalName,
  )}" title="${escapeHtmlAttribute(image.originalName)}" loading="lazy">`;
}

function textToHtml(text: string): string {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return '';

  return blocks
    .map((block) => `<p>${escapeHtmlText(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, '&quot;');
}
