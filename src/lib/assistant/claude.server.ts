import { ANTHROPIC_URL, ANTHROPIC_VERSION, ASSISTANT_MODEL, MAX_TOOL_STEPS, type AssistantCard, type AssistantReply, type ChatTurn, type Lang, type Screen } from './config';
import { runTool, TOOL_DEFS, type ToolCtx } from './tools.server';

export class ClaudeError extends Error { constructor(public status: number, message: string) { super(message); } }

export function systemPrompt(o: { lang: Lang; name: string; screen: Screen; today: string; tz: string }) {
  return [
    'You are the Gatherwell Assistant: warm, calm, encouraging and brief.',
    `Always reply in ${o.lang === 'es' ? 'natural Latin American Spanish' : 'English'} unless the user writes in another language.`,
    'Help people plan gatherings, invite guests, run trainings, and celebrate their team.',
    'Never make health, medical, weight-loss or income claims. Never give medical advice; suggest a qualified professional instead.',
    "Never sell products, quote product prices, or mention outside companies or brands. If someone wants to buy something, point them to their host's shop link.",
    'Never use emoji.',
    "For questions about how this team does things (welcome nights, scripts, routines), call search_team_library and answer only from its results. If nothing matches, say so plainly and suggest asking their leader.",
    'Keep replies under 120 words unless asked for more.',
    'Use tools to produce cards. Nothing is ever created, posted or sent by you; the user confirms on each card. After a tool, reply with one or two short sentences.',
    `The user's first name is ${o.name || 'unknown'}. They are on the ${o.screen} screen. Today is ${o.today} (${o.tz}).`,
  ].join('\n');
}

export async function call(key: string, body: unknown) {
  const res = await fetch(ANTHROPIC_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[assistant] claude error', res.status, text.slice(0, 300));
    throw new ClaudeError(res.status, text.slice(0, 300));
  }
  return res.json() as Promise<{ content: any[]; stop_reason: string; usage?: { input_tokens: number; output_tokens: number } }>;
}

export async function claudeTranslate(key: string, text: string, target: 'en' | 'es' | 'pt') {
  const lang = target === 'es' ? 'natural Latin American Spanish' : target === 'pt' ? 'Brazilian Portuguese' : 'English';
  const r = await call(key, { model: ASSISTANT_MODEL, max_tokens: 2000, system: `Translate the user's text into ${lang}. Keep meaning, tone, line breaks and names. Never add emoji. Output only the translation.`, messages: [{ role: 'user', content: text }] });
  const out = r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  return { text: out, input: r.usage?.input_tokens ?? 0, output: r.usage?.output_tokens ?? 0 };
}

export async function claudeReply(key: string, history: ChatTurn[], o: { lang: Lang; name: string; screen: Screen; today: string; tz: string }, ctx: Omit<ToolCtx, 'translate'>) {
  let input = 0, output = 0;
  const translate = async (text: string, target: 'en' | 'es' | 'pt') => { const r = await claudeTranslate(key, text, target); input += r.input; output += r.output; return r.text; };
  const tctx: ToolCtx = { ...ctx, translate };
  const messages: any[] = history.map(m => ({ role: m.role, content: m.text }));
  const cards: AssistantCard[] = [];
  let text = '';
  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const r = await call(key, { model: ASSISTANT_MODEL, max_tokens: 1200, system: systemPrompt(o), tools: TOOL_DEFS, messages });
    input += r.usage?.input_tokens ?? 0; output += r.usage?.output_tokens ?? 0;
    text = r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (r.stop_reason !== 'tool_use') break;
    messages.push({ role: 'assistant', content: r.content });
    const results = [];
    for (const block of r.content.filter(b => b.type === 'tool_use')) {
      const out = await runTool(block.name, block.input ?? {}, tctx).catch(() => ({ result: 'Tool failed.' } as { card?: AssistantCard; result: string }));
      if (out.card) cards.push(out.card);
      results.push({ type: 'tool_result', tool_use_id: block.id, content: out.result });
    }
    messages.push({ role: 'user', content: results });
  }
  const reply: AssistantReply = { text, cards, preview: false };
  return { reply, input, output };
}
