import DOMPurify from 'dompurify';

const ALLOWED_IMAGE_PREFIX = '/api/assets/images/';
const UPLOADED_IMAGE_PATH_PATTERN = /^\/api\/assets\/images\/[a-f0-9-]{36}\.(?:png|jpe?g|webp|gif)$/i;

export function sanitizePageHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ADD_ATTR: ['height', 'loading', 'width'],
  });

  const template = document.createElement('template');
  template.innerHTML = sanitized;

  for (const image of Array.from(template.content.querySelectorAll<HTMLImageElement>('img'))) {
    const src = image.getAttribute('src') ?? '';
    if (!isSafeImageSrc(src)) {
      image.remove();
      continue;
    }

    if (!image.hasAttribute('loading')) {
      image.setAttribute('loading', 'lazy');
    }
  }

  return template.innerHTML;
}

function isSafeImageSrc(src: string): boolean {
  if (src.startsWith(ALLOWED_IMAGE_PREFIX)) {
    try {
      const url = new URL(src, window.location.origin);
      return url.origin === window.location.origin && UPLOADED_IMAGE_PATH_PATTERN.test(url.pathname);
    } catch {
      return false;
    }
  }

  try {
    const url = new URL(src);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
