// Smart AI features (follow-ups, daily brief, lesson summaries, claim rewrites). Server-only.
// With ANTHROPIC_API_KEY: Claude via the assistant's call(). Without it: realistic preview text.
import { ASSISTANT_MODEL } from '@/lib/assistant/config';

export type Lang = 'en' | 'es';
export type FollowKind = 'first_time' | 'returning' | 'no_show';

const RULES = 'Never make health, medical, weight-loss or income claims. Never mention outside companies or brands. Never use emoji. Warm, short, personal, plain text.';

export const CLAIM_RE = /(weight|lbs?\b|pounds|kilos?\b|\bkg\b|slim|diet pill|fat burn|cure|cures|cured|heal(s|ed)?\b|disease|diabet|cancer|medic|prescription|detox|income|salary|paycheck|commission|earn(ed|ing|s)?\b|\$ ?[0-9]|[0-9]+ ?(usd|dollars|dólares|pesos)|make money|financial freedom|quit (your|my) job|six figures|passive|peso\b|bajar de peso|perder peso|adelgaz|libras|grasa|cura(r|do|ción)?\b|sana(r|do)?\b|enfermedad|medicina|medicament|ingreso|sueldo|salario|comisi[oó]n|ganar dinero|gan[eé] dinero|libertad financiera|dinero)/i;
export const hasClaim = (t: string) => CLAIM_RE.test(t);

export async function claude(key: string, system: string, user: string, maxTokens = 1500) {
  const { call } = await import('@/lib/assistant/claude.server');
  const r = await call(key, { model: ASSISTANT_MODEL, max_tokens: maxTokens, system: `${system}\n${RULES}`, messages: [{ role: 'user', content: user }] });
  const text = r.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
  return { text, input: r.usage?.input_tokens ?? 0, output: r.usage?.output_tokens ?? 0 };
}

export function parseJson<T>(text: string): T | null {
  const m = text.match(/[[{][\s\S]*[\]}]/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

/* ---------- Follow-ups ---------- */

export type FollowGuest = { rsvp_id: string; name: string; lang: Lang; kind: FollowKind };
export type FollowCtx = { host: string; title: string; nextTitle: string | null; nextWhen: { en: string; es: string } | null; script: { en: string | null; es: string | null } };

const first = (n: string) => (n || '').trim().split(/\s+/)[0] || '';

export function sampleFollowup(g: FollowGuest, c: FollowCtx) {
  const n = first(g.name); const es = g.lang === 'es';
  const next = c.nextWhen ? (es ? c.nextWhen.es : c.nextWhen.en) : null;
  const nextT = c.nextTitle ?? c.title;
  if (g.kind === 'first_time') return es
    ? `Hola ${n}, gracias por venir a ${c.title}. Fue un gusto conocerte y que fuera tu primera vez con nosotros.${next ? ` La próxima es ${nextT} el ${next}; nos encantaría verte de nuevo.` : ' Nos encantaría verte de nuevo pronto.'} Un abrazo, ${c.host}`
    : `Hi ${n}, thank you for coming to ${c.title}. It was so good to meet you at your first one with us.${next ? ` The next one is ${nextT} on ${next}, and we'd love to see you again.` : " We'd love to see you again soon."} Warmly, ${c.host}`;
  if (g.kind === 'returning') return es
    ? `Hola ${n}, gracias por acompañarnos otra vez en ${c.title}. Tu energía hace la diferencia en el grupo.${next ? ` ¿Te apunto para ${nextT} el ${next}?` : ' Te aviso de la próxima.'} ${c.host}`
    : `Hi ${n}, thanks for joining us again at ${c.title}. Your energy makes the group better.${next ? ` Want me to save you a spot for ${nextT} on ${next}?` : " I'll let you know about the next one."} ${c.host}`;
  return es
    ? `Hola ${n}, te extrañamos en ${c.title}. Espero que todo esté bien.${next ? ` La próxima es ${nextT} el ${next}, y tienes lugar si quieres venir.` : ' Te aviso de la próxima fecha.'} ${c.host}`
    : `Hi ${n}, we missed you at ${c.title}. Hope all is well.${next ? ` The next one is ${nextT} on ${next}, and there's a spot for you if you'd like to come.` : " I'll let you know the next date."} ${c.host}`;
}

export async function claudeFollowups(key: string, guests: FollowGuest[], c: FollowCtx) {
  const system = 'You write short personal follow-up messages from a gathering host to guests. One message per guest, under 60 words, in the guest\'s language (en = English, es = natural Latin American Spanish). Sign with the host\'s first name. Return only JSON: [{"rsvp_id":"...","message":"..."}].';
  const user = JSON.stringify({
    host_first_name: c.host, gathering: c.title,
    next_gathering: c.nextTitle && c.nextWhen ? { title: c.nextTitle, when_en: c.nextWhen.en, when_es: c.nextWhen.es } : null,
    style_guide: { en: c.script.en, es: c.script.es },
    kinds: { first_time: 'attended for the first time: warm welcome and invitation to come back', returning: 'attended again: thanks and a nudge toward the next gathering', no_show: 'RSVPd but did not come: we missed you, with the next date' },
    guests: guests.map(g => ({ rsvp_id: g.rsvp_id, first_name: first(g.name), language: g.lang, kind: g.kind })),
  });
  const r = await claude(key, system, user, 3000);
  const list = parseJson<{ rsvp_id: string; message: string }[]>(r.text) ?? [];
  return { messages: new Map(list.map(x => [x.rsvp_id, String(x.message ?? '').trim()])), input: r.input, output: r.output };
}

/* ---------- Claim rewrite ---------- */

export function keywordRewrite(text: string, lang: Lang) {
  const parts = text.split(/(?<=[.!?¡¿\n])\s+/);
  const kept = parts.filter(p => !hasClaim(p)).join(' ').trim();
  if (kept) return kept;
  return lang === 'es' ? 'Ven a moverte, conectar y pasarla bien con el grupo. Todos los niveles son bienvenidos.' : 'Come move, connect and have a good time with the group. All levels welcome.';
}

export async function claudeRewrite(key: string, text: string, lang: Lang) {
  const r = await claude(key, `Rewrite the user's text so it keeps its warm meaning but removes every health, medical, weight-loss, income or money claim. Reply in ${lang === 'es' ? 'natural Latin American Spanish' : 'English'} unless the text is clearly in the other language. Output only the rewritten text.`, text, 800);
  return r;
}

/* ---------- Lesson summary ---------- */

export type Summary = { summary_en: string; summary_es: string; points_en: string[]; points_es: string[]; actions_en: string[]; actions_es: string[] };

export function sampleSummary(source: string, title: string): Summary {
  const s = source.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 12 && !hasClaim(x));
  const summary_en = s.slice(0, 2).join(' ') || `This lesson walks through ${title} step by step, with simple ideas you can use at your next gathering.`;
  const pts = s.slice(2, 7);
  const basePts = ['Start on time and greet every person by name.', 'Keep the plan simple and easy to follow.', 'Invite people personally, one by one.', 'Celebrate small wins together.', 'Close with the next date so people can come back.'];
  const basePtsEs = ['Empieza a tiempo y saluda a cada persona por su nombre.', 'Mantén el plan simple y fácil de seguir.', 'Invita a las personas de forma personal, una por una.', 'Celebren juntos los pequeños logros.', 'Cierra con la próxima fecha para que la gente regrese.'];
  const points_en = [...pts, ...basePts].slice(0, 5);
  const points_es = [...pts.map(() => ''), ...basePtsEs].slice(0, 5).map((x, i) => x || basePtsEs[i]!);
  return {
    summary_en, summary_es: `Esta lección repasa ${title} paso a paso, con ideas simples que puedes usar en tu próxima reunión.`,
    points_en, points_es,
    actions_en: ['Pick one idea from this lesson to try this week.', 'Share the lesson with one teammate.', 'Add the next date to your calendar.'],
    actions_es: ['Elige una idea de esta lección para probar esta semana.', 'Comparte la lección con una persona del equipo.', 'Agrega la próxima fecha a tu calendario.'],
  };
}

export async function claudeSummary(key: string, source: string, title: string) {
  const r = await claude(key, 'Summarize a team training lesson. Return only JSON with keys summary_en, summary_es (2-3 sentences each), points_en, points_es (exactly 5 short key points each), actions_en, actions_es (exactly 3 short action items each). Spanish must be natural Latin American Spanish.', `Lesson title: ${title}\n\n${source}`, 2500);
  const j = parseJson<Summary>(r.text);
  return { summary: j, input: r.input, output: r.output };
}

/* ---------- Daily brief ---------- */

export type BriefLine = { key: string; text: string; link: string | null };

export async function claudeBrief(key: string, lines: BriefLine[], lang: Lang, name: string) {
  const r = await claude(key, `Polish each line of a short morning brief for ${name || 'a team member'}. Keep the same number of lines, same facts and order, under 18 words each, in ${lang === 'es' ? 'natural Latin American Spanish' : 'English'}. Calm and encouraging. Return only a JSON array of strings.`, JSON.stringify(lines.map(l => l.text)), 600);
  const arr = parseJson<string[]>(r.text);
  const out = Array.isArray(arr) && arr.length === lines.length && !arr.some(x => hasClaim(String(x))) ? lines.map((l, i) => ({ ...l, text: String(arr[i]) })) : lines;
  return { lines: out, input: r.input, output: r.output };
}
