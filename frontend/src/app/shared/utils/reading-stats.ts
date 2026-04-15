import { marked } from 'marked';
import type { PageContentFormat } from '../../core/models/page.model';

export interface ReadingStats {
  wordCount: number;
  readingTimeMinutes: number;
}

const WORDS_PER_MINUTE = 200;
const WORD_PATTERN = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;

export function calculateReadingStats(
  content: string | null | undefined,
  format: PageContentFormat,
): ReadingStats {
  const text = extractTextContent(content ?? '', format);
  const wordCount = text.match(WORD_PATTERN)?.length ?? 0;

  return {
    wordCount,
    readingTimeMinutes: wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)),
  };
}

function extractTextContent(content: string, format: PageContentFormat): string {
  if (!content.trim()) return '';

  const html =
    format === 'markdown'
      ? marked.parse(content, { async: false })
      : content;

  return htmlToText(String(html));
}

function htmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ');
  }

  const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
  parsedDocument.querySelectorAll('script, style, template, noscript').forEach((element) => element.remove());

  const walker = parsedDocument.createTreeWalker(parsedDocument.body, NodeFilter.SHOW_TEXT);
  const chunks: string[] = [];
  let node = walker.nextNode();

  while (node) {
    const text = node.textContent?.trim();
    if (text) {
      chunks.push(text);
    }
    node = walker.nextNode();
  }

  return chunks.join(' ');
}
