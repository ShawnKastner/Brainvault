import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import type { PageResponse } from '../../core/models/page.model';
import { sanitizePageHtml } from '../utils/page-html-sanitizer';

@Pipe({
  name: 'pageContent',
  standalone: true,
})
export class PageContentPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(page: PageResponse | null): SafeHtml {
    if (!page?.content) return '';

    const html =
      page.contentFormat === 'markdown'
        ? marked.parse(page.content, { async: false })
        : page.content;

    return this.sanitizer.bypassSecurityTrustHtml(sanitizePageHtml(html));
  }
}
