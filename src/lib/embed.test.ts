import { describe, expect, it } from 'vitest';
import { embedSnippet, embedUrl } from './embed';
describe('coach page embed', () => {
  it('points the iframe at the live public embed route for that coach', () => {
    expect(embedUrl('https://zoheewell.com', 'maria-runs')).toBe('https://zoheewell.com/embed/h/maria-runs');
  });
  it('refuses slugs that could break out of the URL', () => {
    expect(embedUrl('https://zoheewell.com', '../admin')).toBeNull();
    expect(embedSnippet('https://zoheewell.com', 'a"><script>', 'x')).toBeNull();
  });
  it('escapes the coach name and includes a title plus an open-on-ZoheeWell fallback link', () => {
    const s = embedSnippet('https://zoheewell.com', 'maria', 'Maria "M" <Runs>')!;
    expect(s).toContain('title="Maria &quot;M&quot; &lt;Runs&gt;"');
    expect(s).toContain('href="https://zoheewell.com/h/maria" target="_blank"');
    expect(s).not.toContain('<Runs>');
  });
});
