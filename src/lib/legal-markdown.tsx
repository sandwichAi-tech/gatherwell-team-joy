import { Fragment, type ReactNode } from 'react';

/** Renders the small Markdown subset used by stored legal texts (headings, paragraphs, lists, quotes, tables, **bold**). Text only; no HTML is ever interpreted. */
export type LegalBlock =
  | { type: 'h'; level: 1 | 2 | 3; text: string }
  | { type: 'p'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] };

const unescape = (s: string) => s.replace(/\\([\\`*_{}[\]()#+\-.!$|>~])/g, '$1');
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export function parseLegalMarkdown(src: string): LegalBlock[] {
  const out: LegalBlock[] = [];
  for (const raw of src.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(block);
    if (h && !block.includes('\n')) { out.push({ type: 'h', level: h[1].length as 1 | 2 | 3, text: h[2] }); continue; }
    const lines = block.split('\n');
    if (lines[0].startsWith('|') && lines.length >= 2 && /^\|[\s|:-]+\|?$/.test(lines[1])) {
      out.push({ type: 'table', head: cells(lines[0]), rows: lines.slice(2).map(cells) }); continue;
    }
    if (lines.every(l => l.startsWith('>'))) { out.push({ type: 'quote', text: lines.map(l => l.replace(/^>\s?/, '')).join(' ') }); continue; }
    const li = /^(\d+\.|-)\s+/;
    if (li.test(lines[0])) {
      const items: string[] = [];
      for (const l of lines) { if (li.test(l.trimStart())) items.push(l.trimStart().replace(li, '')); else if (items.length) items[items.length - 1] += ' ' + l.trim(); }
      out.push({ type: 'list', ordered: /^\d/.test(lines[0]), items }); continue;
    }
    out.push({ type: 'p', text: lines.join(' ') });
  }
  return out;
}

export function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') && part.length > 4
    ? <strong key={i}>{unescape(part.slice(2, -2))}</strong>
    : <Fragment key={i}>{unescape(part)}</Fragment>);
}

export function LegalMarkdown({ source }: { source: string }) {
  return <>{parseLegalMarkdown(source).map((b, i) => {
    switch (b.type) {
      case 'h': return b.level === 1 ? <h1 key={i}>{inline(b.text)}</h1> : b.level === 2 ? <h2 key={i}>{inline(b.text)}</h2> : <h3 key={i}>{inline(b.text)}</h3>;
      case 'quote': return <aside key={i} className="legal-md-note" role="note"><p>{inline(b.text)}</p></aside>;
      case 'list': { const items = b.items.map((it, j) => <li key={j}>{inline(it)}</li>); return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>; }
      case 'table': return <div key={i} className="legal-md-table" role="region" aria-label={b.head.join(', ')} tabIndex={0}><table><thead><tr>{b.head.map((c, j) => <th key={j} scope="col">{inline(c)}</th>)}</tr></thead><tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody></table></div>;
      default: return <p key={i}>{inline(b.text)}</p>;
    }
  })}</>;
}
