import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewEncapsulation,
  ViewChild,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Editor } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type {
  PageResponse,
  UpdatePageRequest,
} from '../../../../core/models/page.model';

type HeadingLevel = 1 | 2 | 3;

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
  readonly saving = input(false);
  readonly save = output<UpdatePageRequest>();
  readonly cancel = output<void>();

  editor: Editor | null = null;

  readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    tags: [''],
  });

  private pendingEditorContent = '';

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
    if (!this.editor) return;

    const currentHref = this.editor.getAttributes('link')['href'];
    const href = prompt('Link URL', typeof currentHref === 'string' ? currentHref : 'https://');
    if (href === null) return;

    const trimmedHref = href.trim();
    if (!trimmedHref) {
      this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    this.editor.chain().focus().extendMarkRange('link').setLink({ href: trimmedHref }).run();
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
