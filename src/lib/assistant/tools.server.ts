import type { SupabaseClient } from '@supabase/supabase-js';
import type { LibrarySource, AssistantCard, GatheringDraft, Lang, RecipeCard, UpcomingItem } from './config';

export type ToolCtx = { supabase: SupabaseClient<any>; userId: string; lang: Lang; origin: string; translate: (text: string, target: 'en' | 'es' | 'pt') => Promise<string> };

/** Tool definitions sent to Claude. Content-generating tools carry the generated text in their inputs. */
export const TOOL_DEFS = [
  { name: 'search_team_library', description: "Search this team's own lessons, templates, announcements and recipes. Use for questions about how the team does things. Answer only from the results.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'create_gathering_draft', description: 'Prepare a gathering draft for the user to review. Never creates anything; the user confirms on the card. Write a short warm description in both English and Spanish with no health, weight-loss or income claims.',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'HH:MM 24h' }, place: { type: 'string' }, capacity: { type: ['integer', 'null'] }, description_en: { type: 'string' }, description_es: { type: 'string' } }, required: ['title', 'date', 'time', 'place', 'capacity', 'description_en', 'description_es'] } },
  { name: 'translate_text', description: 'Translate text into English, natural Latin American Spanish, or Portuguese.',
    input_schema: { type: 'object', properties: { text: { type: 'string' }, target: { type: 'string', enum: ['en', 'es', 'pt'] } }, required: ['text', 'target'] } },
  { name: 'write_invite', description: "Write a ready-to-copy invite for one of the user's gatherings. Get ids from get_my_upcoming_gatherings first; leave gathering_id empty for the next one.",
    input_schema: { type: 'object', properties: { gathering_id: { type: 'string' }, channel: { type: 'string', enum: ['whatsapp', 'instagram', 'text'] } }, required: ['gathering_id', 'channel'] } },
  { name: 'draft_announcement', description: 'Draft a short team announcement (under 80 words) in the user language. The user posts it themselves.',
    input_schema: { type: 'object', properties: { topic: { type: 'string' }, text: { type: 'string' } }, required: ['topic', 'text'] } },
  { name: 'get_my_upcoming_gatherings', description: "List the user's next upcoming gatherings with ids.", input_schema: { type: 'object', properties: {} } },
  { name: 'get_directions', description: 'Map link and a short arrival tip for a gathering.',
    input_schema: { type: 'object', properties: { gathering_id: { type: 'string' } }, required: ['gathering_id'] } },
  { name: 'suggest_recipe', description: 'Suggest a simple recipe. No health, medical or weight-loss claims, no brands.',
    input_schema: { type: 'object', properties: { preferences: { type: 'string' }, time: { type: 'string' }, budget: { type: 'string' }, title_en: { type: 'string' }, title_es: { type: 'string' }, minutes: { type: ['integer', 'null'] }, ingredients: { type: 'array', items: { type: 'string' } }, steps: { type: 'array', items: { type: 'string' } } }, required: ['preferences', 'time', 'budget', 'title_en', 'title_es', 'minutes', 'ingredients', 'steps'] } },
] as const;

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function upcoming(ctx: ToolCtx): Promise<UpcomingItem[]> {
  const { data } = await ctx.supabase.from('events').select('id,title,starts_at,location_name,address,online_url,visibility')
    .eq('status', 'published').gte('starts_at', new Date().toISOString()).order('starts_at').limit(5);
  return (data ?? []).map((e: any) => ({ id: e.id, title: e.title, starts_at: e.starts_at, place: e.location_name || e.address || (e.online_url ? 'Online' : null), visibility: e.visibility }));
}

async function findGathering(ctx: ToolCtx, id: string) {
  const q = ctx.supabase.from('events').select('id,title,starts_at,timezone,location_name,address,lat,lng,meeting_note,online_url,visibility');
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await q.eq('id', id).maybeSingle()
    : await q.eq('status', 'published').gte('starts_at', new Date().toISOString()).order('starts_at').limit(1).maybeSingle();
  return data as any;
}

function when(iso: string, tz: string | null, lang: Lang) {
  return new Date(iso).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz || undefined });
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<{ card?: AssistantCard; result: string }> {
  const es = ctx.lang === 'es';
  switch (name) {
    case 'create_gathering_draft': {
      const cap = Number(input['capacity']);
      const draft: GatheringDraft = { title: str(input['title'], 120) || (es ? 'Reunión' : 'Gathering'), date: str(input['date'], 10), time: str(input['time'], 5) || '08:00', place: str(input['place'], 160), capacity: Number.isFinite(cap) && cap > 0 ? Math.min(99999, Math.round(cap)) : null, description_en: str(input['description_en']), description_es: str(input['description_es']) };
      return { card: { type: 'gathering', draft }, result: 'Draft card shown to the user. It is not created until they tap the confirm button.' };
    }
    case 'translate_text': {
      const target = (['en', 'es', 'pt'] as const).find(x => x === input['target']) ?? (es ? 'en' : 'es');
      const text = await ctx.translate(str(input['text'], 4000), target);
      return { card: { type: 'translation', text, target }, result: `Translation shown: ${text}` };
    }
    case 'write_invite': {
      const g = await findGathering(ctx, str(input['gathering_id']));
      if (!g) return { result: 'No upcoming gathering found. Ask the user to create one first.' };
      const channel = (['whatsapp', 'instagram', 'text'] as const).find(x => x === input['channel']) ?? 'whatsapp';
      const link = `${ctx.origin}${g.visibility === 'public' ? '/e/' : '/event/'}${g.id}`;
      const place = g.location_name || g.address || (es ? 'en línea' : 'online');
      const date = when(g.starts_at, g.timezone, ctx.lang);
      const text = channel === 'instagram'
        ? (es ? `${g.title}\n${date}\n${place}\n\nVen tal como eres. Aparta tu lugar con el enlace en mi perfil o escríbeme.` : `${g.title}\n${date}\n${place}\n\nCome as you are. Save your spot with the link in my bio or send me a message.`)
        : (es ? `Hola, te invito a ${g.title} el ${date} en ${place}. Me encantaría verte ahí. Confirma aquí: ${link}` : `Hi, you're invited to ${g.title} on ${date} at ${place}. I'd love to see you there. RSVP here: ${link}`);
      return { card: { type: 'invite', text, channel, link }, result: `Invite card shown for ${g.title}.` };
    }
    case 'draft_announcement': {
      const text = str(input['text'], 2000) || str(input['topic'], 2000);
      return { card: { type: 'announcement', text }, result: 'Announcement draft shown. The user posts it themselves.' };
    }
    case 'get_my_upcoming_gatherings': {
      const items = await upcoming(ctx);
      return { card: { type: 'upcoming', items }, result: items.length ? JSON.stringify(items) : 'No upcoming gatherings.' };
    }
    case 'get_directions': {
      const g = await findGathering(ctx, str(input['gathering_id']));
      if (!g) return { result: 'Gathering not found.' };
      if (!g.location_name && !g.address && g.online_url) return { result: 'This gathering is online; there are no directions.' };
      const dest = g.lat != null && g.lng != null ? `${g.lat},${g.lng}` : encodeURIComponent(g.address || g.location_name || '');
      const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
      const tip = g.meeting_note || (es ? 'Llega unos 10 minutos antes para saludar y encontrar al grupo.' : 'Arrive about 10 minutes early to say hello and find the group.');
      return { card: { type: 'directions', title: g.title, url, tip }, result: `Directions card shown. Tip: ${tip}` };
    }
    case 'suggest_recipe': {
      const list = (v: unknown) => (Array.isArray(v) ? v.map(x => str(x, 200)).filter(Boolean).slice(0, 20) : []);
      const mins = Number(input['minutes']);
      const recipe: RecipeCard = { title_en: str(input['title_en'], 120), title_es: str(input['title_es'], 120), minutes: Number.isFinite(mins) && mins > 0 ? Math.round(mins) : null, ingredients: list(input['ingredients']), steps: list(input['steps']), lang: ctx.lang };
      return { card: { type: 'recipe', recipe }, result: 'Recipe card shown.' };
    }
    case 'search_team_library': {
      const { data: prof } = await ctx.supabase.from('profiles').select('active_team_id').eq('id', ctx.userId).maybeSingle();
      if (!prof?.active_team_id) return { result: 'No team selected; nothing to search.' };
      const { data } = await ctx.supabase.rpc('search_team_library', { _team: prof.active_team_id, _q: str(input['query'], 300) });
      const hits = ((data ?? []) as { source_type: LibrarySource['type']; source_id: string; title: string; excerpt: string }[]);
      if (!hits.length) return { result: 'NO_MATCH: nothing in the team library matches.' };
      const items: LibrarySource[] = hits.slice(0, 3).map(h => ({ type: h.source_type, id: h.source_id, title: h.title }));
      return { card: { type: 'sources', items }, result: JSON.stringify(hits.map(h => ({ source: `${h.source_type}: ${h.title}`, text: h.excerpt }))) };
    }
    default: return { result: 'Unknown tool.' };
  }
}
