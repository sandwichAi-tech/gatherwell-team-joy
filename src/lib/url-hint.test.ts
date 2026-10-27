import { describe, expect, it } from 'vitest';
import { urlHint } from '@/lib/url-hint';
describe('link field feedback', () => {
  it('names the site customers will open', () => expect(urlHint('https://www.example.org/a')).toEqual({ key: 'urlOpens', host: 'example.org' }));
  it('warns on insecure http', () => expect(urlHint('http://example.org').key).toBe('urlHttps'));
  it('rejects non-web addresses', () => { expect(urlHint('javascript:alert(1)').key).toBe('urlInvalid'); expect(urlHint('example').key).toBe('urlInvalid'); });
  it('asks for an address when empty', () => expect(urlHint('  ').key).toBe('urlEmpty'));
});
