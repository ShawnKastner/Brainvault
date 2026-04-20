import { sanitizePageHtml } from './page-html-sanitizer';

describe(sanitizePageHtml.name, () => {
  it('keeps uploaded images', () => {
    const html = sanitizePageHtml(
      '<p><img src="/api/assets/images/11111111-1111-4111-8111-111111111111.png" alt="Bild"></p>',
    );

    expect(html).toContain('<img');
    expect(html).toContain('src="/api/assets/images/11111111-1111-4111-8111-111111111111.png"');
    expect(html).toContain('loading="lazy"');
  });

  it('removes unsafe image sources', () => {
    const html = sanitizePageHtml('<img src="data:image/png;base64,abc"><img src="javascript:alert(1)">');

    expect(html).not.toContain('<img');
  });
});
