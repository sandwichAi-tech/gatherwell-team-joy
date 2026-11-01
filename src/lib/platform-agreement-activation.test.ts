import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseLegalMarkdown } from './legal-markdown';

const dir = 'docs/legal/active/platform-agreement-v2.0/';
const en = readFileSync(dir + 'ZoheeWell_Platform_Agreement.v2.0.en.md', 'utf8');
const es = readFileSync(dir + 'ZoheeWell_Platform_Agreement.v2.0.es-english-fallback.md', 'utf8');
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('active platform agreement v2.0', () => {
  it('drops the draft banner and attorney notes', () => {
    expect(en).not.toMatch(/DRAFT|NOT YET IN EFFECT|Notes for Attorney Review|@Nick Coromelas/);
  });
  it('keeps owner-confirmed facts', () => {
    expect(en).toContain('Zoheewell LLC');
    expect(en).toContain('Effective date: November 1, 2026');
    expect(en).toContain('(currently 5% on all plans)');
    expect(en).toContain('laws of the State of Wyoming');
    expect(en).toContain('Sheridan County, Wyoming');
  });
  it('Spanish row is the exact English text behind a labeled notice', () => {
    expect(es.endsWith(en)).toBe(true);
    expect(es.startsWith('> **Versión en inglés.**')).toBe(true);
  });
  it('matches the hashes stored with the activated versions', () => {
    expect(sha(en)).toBe('fb052fb7ddba4ce8dc92fb62218c72abde2370cf50e53cae1c6015154840ace4');
    expect(sha(es)).toBe('4bc00b48a0140ea8cc84d7785e5209e8e280fc09e1c2e2831cc93b165dad22ff');
  });
  it('renders headings, Schedule A table and the Spanish notice', () => {
    const blocks = parseLegalMarkdown(es);
    expect(blocks[0]?.type).toBe('quote');
    expect(blocks.some(b => b.type === 'table' && b.rows.length === 7)).toBe(true);
    expect(blocks.filter(b => b.type === 'h' && b.level === 2).length).toBeGreaterThanOrEqual(27);
  });
});

import { agreementViewUrl } from './event-agreements';
describe('agreement viewer url', () => {
  it('opens our legal page on the current site', () => {
    expect(agreementViewUrl('https://zoheewell.com/legal/platform-agreement?lang=es', 'http://localhost:8080')).toBe('http://localhost:8080/legal/platform-agreement?lang=es');
  });
  it('leaves other hosts untouched', () => {
    expect(agreementViewUrl('https://files.example.org/a.pdf', 'http://localhost:8080')).toBe('https://files.example.org/a.pdf');
  });
});
