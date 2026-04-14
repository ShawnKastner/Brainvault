import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  PageContentFormat,
  PageResponse,
  UpdatePageRequest,
} from '../../../../core/models/page.model';

@Component({
  selector: 'bv-page-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './page-editor.component.html',
  styleUrl: './page-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageEditorComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly page = input.required<PageResponse>();
  readonly saving = input(false);
  readonly save = output<UpdatePageRequest>();
  readonly cancel = output<void>();

  readonly contentFormats: { value: PageContentFormat; label: string }[] = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'html', label: 'HTML' },
  ];

  readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    contentFormat: this.formBuilder.control<PageContentFormat>('markdown', Validators.required),
    content: [''],
    tags: [''],
  });

  constructor() {
    effect(() => {
      const page = this.page();
      this.form.reset(
        {
          title: page.title,
          description: page.description ?? '',
          contentFormat: page.contentFormat,
          content: page.content ?? '',
          tags: page.tags.join(', '),
        },
        { emitEvent: false },
      );
    });
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
      content: formValue.content,
      contentFormat: formValue.contentFormat,
      tags: formValue.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    });
  }

  contentPlaceholder(): string {
    return this.form.controls.contentFormat.value === 'markdown'
      ? '## Ueberschrift\n\nInhalt mit **Markdown**, Listen und `Code`.'
      : '<h2>Ueberschrift</h2>\n<p>Inhalt...</p>';
  }
}
