import en from '@/locales/en.json';
import es from '@/locales/es.json';

export function renderErrorPage(language = 'en'): string {
  const spanish = language.toLowerCase().startsWith('es');
  const copy = (spanish ? es : en).error;
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return `<!doctype html>
<html lang="${spanish ? 'es' : 'en'}">
  <head>
    <meta charset="utf-8" />
    <title>${escape(copy.title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.55 Inter, system-ui, sans-serif; background: #F7F7F9; color: #1C1726; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { min-height:48px; box-sizing:border-box; display:inline-flex; align-items:center; padding: 0.5rem 1rem; border-radius: 12px; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      :focus-visible { outline:2px solid #71569C; outline-offset:3px; }
      .primary { background: #2F2340; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escape(copy.title)}</h1>
      <p>${escape(copy.message)}</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">${escape(copy.retry)}</button>
        <a class="secondary" href="/">${escape(copy.home)}</a>
      </div>
    </div>
  </body>
</html>`;
}
