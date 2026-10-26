import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrandImage } from './brand-image';

describe('BrandImage markup', () => {
  it('emits sizes before srcset so server-rendered images pick the right rendition', () => {
    const html = renderToString(<QueryClientProvider client={new QueryClient()}><BrandImage src={{ src: 'https://x.test/o.webp', srcSet: 'https://x.test/a.webp 480w, https://x.test/b.webp 960w' }} sizes="(min-width: 768px) 720px, 100vw" alt="" /></QueryClientProvider>);
    const img = html.slice(html.indexOf('<img'));
    expect(img.indexOf('sizes=')).toBeGreaterThan(-1);
    expect(img.indexOf('sizes=')).toBeLessThan(img.indexOf('srcSet=') === -1 ? img.indexOf('srcset=') : img.indexOf('srcSet='));
  });
  it('shows grain only on the fallback, never over a real photo', () => {
    const html = renderToString(<QueryClientProvider client={new QueryClient()}><BrandImage src="https://x.test/o.webp" alt="" /></QueryClientProvider>);
    expect(html).not.toContain('brand-image-grain');
  });
});
