import { calculateReadingStats } from './reading-stats';

describe(calculateReadingStats.name, () => {
  it('counts visible words from HTML content', () => {
    const stats = calculateReadingStats(
      '<h1>Hallo</h1><script>ignored()</script><p>Zwei&nbsp;Wörter</p>',
      'html',
    );

    expect(stats).toEqual({
      wordCount: 3,
      readingTimeMinutes: 1,
    });
  });

  it('counts rendered markdown text without markdown syntax', () => {
    const stats = calculateReadingStats('# Titel\n\nDas ist **fett** und gut.', 'markdown');

    expect(stats.wordCount).toBe(6);
  });

  it('rounds reading time up from 200 words per minute', () => {
    const content = Array.from({ length: 201 }, (_, index) => `wort${index}`).join(' ');

    expect(calculateReadingStats(content, 'html').readingTimeMinutes).toBe(2);
  });

  it('returns zero minutes for empty content', () => {
    expect(calculateReadingStats('', 'html')).toEqual({
      wordCount: 0,
      readingTimeMinutes: 0,
    });
  });
});
