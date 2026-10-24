import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('wraps every value in quotes and doubles inner quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
  it('renders null/undefined as empty cells', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
  it.each(['=CMD()', '+1+2', '-2-3', '@SUM(A1)', '\t=1', '\r=1'])('neutralizes formula injection for %s', v => {
    const out = csvCell(v);
    expect(out.startsWith('"\'')).toBe(true);
  });
  it('does not alter ordinary values', () => {
    expect(csvCell('Ana García')).toBe('"Ana García"');
    expect(csvCell(3)).toBe('"3"');
  });
});

describe('toCsv', () => {
  it('joins headers and rows with CRLF', () => {
    const csv = toCsv(['name', 'status'], [['Ana', 'going'], ['Bo, Jr', 'waitlist']]);
    expect(csv).toBe('"name","status"\r\n"Ana","going"\r\n"Bo, Jr","waitlist"');
  });
  it('preserves UTF-8 content', () => {
    expect(toCsv(['n'], [['José — mañana']])).toContain('José — mañana');
  });
});
