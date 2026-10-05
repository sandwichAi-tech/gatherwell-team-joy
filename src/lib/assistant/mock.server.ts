import type { AssistantCard, AssistantReply, Lang, Screen } from './config';
import { runTool, upcoming, type ToolCtx } from './tools.server';

/** Preview mode: realistic replies and cards built from what the person typed, used until ANTHROPIC_API_KEY exists. */

const DAYS: Record<string, number> = { sunday: 0, sun: 0, domingo: 0, monday: 1, mon: 1, lunes: 1, tuesday: 2, tue: 2, martes: 2, wednesday: 3, wed: 3, 'miércoles': 3, miercoles: 3, thursday: 4, thu: 4, jueves: 4, friday: 5, fri: 5, viernes: 5, saturday: 6, sat: 6, 'sábado': 6, sabado: 6 };

function addDays(today: string, n: number) {
  const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

export function parseGathering(text: string, today: string, lang: Lang) {
  const low = text.toLowerCase();
  const todayDow = new Date(`${today}T12:00:00Z`).getUTCDay();
  let date = addDays(today, 1);
  let cut = text.length;
  const mark = (i: number) => { if (i >= 0 && i < cut) cut = i; };
  if (/\b(today|hoy)\b/.test(low)) { date = today; mark(low.search(/\b(today|hoy)\b/)); }
  else if (/\b(tomorrow|mañana|manana)\b/.test(low)) { date = addDays(today, 1); mark(low.search(/\b(tomorrow|mañana|manana)\b/)); }
  else {
    const m = low.match(/(?:this |next |este |el |próximo |proximo )?\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat|domingo|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado)\b/);
    if (m) { const dow = DAYS[m[1]!]!; let diff = (dow - todayDow + 7) % 7; if (diff === 0) diff = 7; if (/next|próximo|proximo/.test(m[0]) && diff < 7) diff += 0; date = addDays(today, diff); mark(m.index!); }
  }
  let time = '08:00';
  const t = low.match(/(?:a las\s+)?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|hrs|h)?\b/);
  const tm = t && (t[3] || t[2] || /a las/.test(t[0])) ? t : null;
  if (tm) { let h = Number(tm[1]); const mm = tm[2] ?? '00'; const ap = tm[3] ?? ''; if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0; if (h < 24) time = `${String(h).padStart(2, '0')}:${mm}`; mark(tm.index!); }
  let place = '';
  const p = text.match(/\b(?:at|en)\s+([^,.;]+?)(?=\s*(?:,|\.|;|$|\d+\s*(?:spots|people|lugares|cupos|personas)))/i);
  if (p) { place = p[1]!.trim(); mark(p.index!); }
  const c = low.match(/(\d{1,5})\s*(spots|people|places|lugares|cupos|personas)/);
  const capacity = c ? Number(c[1]) : null;
  if (c) mark(c.index!);
  let title = text.slice(0, cut).replace(/\b(plan|create|crear|organiza|organizar|haz)\b\s*(a|an|una|un)?/i, '').replace(/[,\s]+$/, '').replace(/\b(this|next|este|el|on)\s*$/i, '').trim();
  if (!title) title = lang === 'es' ? 'Reunión' : 'Gathering';
  title = title.charAt(0).toUpperCase() + title.slice(1);
  const where = place || (lang === 'es' ? 'el punto de encuentro' : 'the meeting spot');
  return {
    title: title.slice(0, 120), date, time, place, capacity,
    description_en: `Join us for ${title.toLowerCase()} at ${place || 'the meeting spot'}. All levels welcome. Bring water and come as you are.`,
    description_es: `Acompáñanos a ${title.toLowerCase()} en ${where}. Todos los niveles son bienvenidos. Trae agua y ven tal como eres.`,
  };
}

const WORDS: Record<string, string> = {
  welcome: 'bienvenidos', everyone: 'todos', all: 'todos', levels: 'niveles', join: 'únete', us: 'a nosotros', for: 'para', a: 'una', the: 'el', and: 'y', with: 'con', at: 'en', in: 'en', of: 'de', to: 'a', our: 'nuestro', your: 'tu', you: 'tú', bring: 'trae', water: 'agua', mat: 'tapete', friends: 'amigos', friend: 'amigo', family: 'familia', morning: 'mañana', evening: 'tarde', sunrise: 'amanecer', sunset: 'atardecer', park: 'parque', walk: 'caminata', run: 'carrera', yoga: 'yoga', class: 'clase', team: 'equipo', together: 'juntos', community: 'comunidad', fun: 'divertido', easy: 'fácil', gentle: 'suave', music: 'música', come: 'ven', as: 'como', are: 'eres', is: 'es', we: 'nosotros', will: '', meet: 'nos vemos', near: 'cerca de', entrance: 'entrada', saturday: 'sábado', sunday: 'domingo', monday: 'lunes', friday: 'viernes', week: 'semana', weekly: 'semanal', every: 'cada', new: 'nuevo', first: 'primer', time: 'vez', minutes: 'minutos', stretch: 'estiramiento', snacks: 'botanas', shoes: 'tenis', comfortable: 'cómodos', clothes: 'ropa', see: 'ver', there: 'ahí', thank: 'gracias', thanks: 'gracias', hosts: 'anfitriones', gathering: 'reunión', gatherings: 'reuniones', training: 'capacitación', lesson: 'lección', recipe: 'receta', hello: 'hola', hi: 'hola',
};
const REVERSE = Object.fromEntries(Object.entries(WORDS).filter(([, v]) => v && !v.includes(' ')).map(([k, v]) => [v, k]));

/** Word-level sample translation so preview mode shows the flow; real translation arrives with the key. */
export function sampleTranslate(text: string, target: 'en' | 'es' | 'pt') {
  const dict = target === 'en' ? REVERSE : WORDS;
  return text.replace(/[A-Za-zÀ-ÿ]+/g, w => {
    const tr = dict[w.toLowerCase()];
    if (tr === undefined || tr === '') return tr === '' ? '' : w;
    return w[0] === w[0]!.toUpperCase() ? tr.charAt(0).toUpperCase() + tr.slice(1) : tr;
  }).replace(/\s{2,}/g, ' ').trim();
}

const RECIPES = [
  { title_en: 'Overnight oats with berries', title_es: 'Avena remojada con frutos rojos', minutes: 10, ing: { en: ['1 cup rolled oats', '1 cup milk of choice', '1/2 cup berries', '1 tbsp honey', 'Pinch of cinnamon'], es: ['1 taza de avena en hojuelas', '1 taza de leche a tu gusto', '1/2 taza de frutos rojos', '1 cda de miel', 'Una pizca de canela'] }, steps: { en: ['Mix oats, milk, honey and cinnamon in a jar.', 'Top with berries.', 'Cover and chill overnight.'], es: ['Mezcla la avena, la leche, la miel y la canela en un frasco.', 'Agrega los frutos rojos encima.', 'Tapa y refrigera toda la noche.'] } },
  { title_en: 'Chickpea and veggie bowl', title_es: 'Tazón de garbanzos y verduras', minutes: 20, ing: { en: ['1 can chickpeas, rinsed', '1 cup cooked rice', '1 cucumber', '1 tomato', 'Lemon and olive oil'], es: ['1 lata de garbanzos enjuagados', '1 taza de arroz cocido', '1 pepino', '1 jitomate', 'Limón y aceite de oliva'] }, steps: { en: ['Chop the cucumber and tomato.', 'Warm the chickpeas in a pan for 5 minutes.', 'Serve over rice with lemon and olive oil.'], es: ['Pica el pepino y el jitomate.', 'Calienta los garbanzos en un sartén 5 minutos.', 'Sirve sobre el arroz con limón y aceite de oliva.'] } },
];

export async function mockReply(input: { text: string; lang: Lang; screen: Screen; today: string; name: string }, ctx: ToolCtx): Promise<AssistantReply> {
  const { text, lang } = input; const es = lang === 'es'; const low = text.toLowerCase();
  const cards: AssistantCard[] = [];
  const add = async (name: string, args: Record<string, unknown>) => { const r = await runTool(name, args, ctx); if (r.card) cards.push(r.card); return r; };
  const reply = (en: string, sp: string): AssistantReply => ({ text: es ? sp : en, cards, preview: true });

  if (/how (do|should|can) we|what('s| is) our|our (script|routine|way)|c[oó]mo (hacemos|organizamos|se hace|hago)|nuestr[oa] (guion|guía|forma)|library|biblioteca/.test(low)) {
    const r = await add('search_team_library', { query: text });
    if (r.result.startsWith('NO_MATCH') || !cards.length) return reply("I couldn't find that in your team's library yet. Your leader is the best person to ask.", 'Todavía no encontré eso en la biblioteca de tu equipo. Tu líder es la mejor persona para preguntarle.');
    const hits = JSON.parse(r.result) as { source: string; text: string }[];
    const excerpt = hits[0]!.text.replace(/\s+/g, ' ').trim().slice(0, 320);
    return reply(`From your team's library: ${excerpt}${excerpt.length >= 320 ? '…' : ''}`, `De la biblioteca de tu equipo: ${excerpt}${excerpt.length >= 320 ? '…' : ''}`);
  }
  if (/translat|tradu/.test(low)) {
    const quoted = text.match(/["“«](.+?)["”»]/)?.[1] ?? text.split(/:\s*/).slice(1).join(': ');
    const target = /english|inglés|ingles/.test(low) ? 'en' : /portug/.test(low) ? 'pt' : 'es';
    if (!quoted.trim()) return reply('Paste the text after a colon and tell me the language, for example: Translate to Spanish: See you Saturday.', 'Pega el texto después de dos puntos y dime el idioma, por ejemplo: Traduce al inglés: Nos vemos el sábado.');
    await add('translate_text', { text: quoted, target });
    return reply('Here is a quick translation.', 'Aquí tienes una traducción rápida.');
  }
  if (/invite|invitaci|invitar/.test(low)) {
    const channel = /insta/.test(low) ? 'instagram' : /\btext\b|sms|mensaje de texto/.test(low) ? 'text' : 'whatsapp';
    const r = await add('write_invite', { gathering_id: '', channel });
    return cards.length ? reply('Here is an invite for your next gathering, ready to copy.', 'Aquí tienes una invitación para tu próxima reunión, lista para copiar.') : reply('You have no upcoming gatherings yet. Want to plan one? Try: Fit camp this Saturday 8am at Citrus Ranch Park, 30 spots.', `Todavía no tienes reuniones próximas. ¿Planeamos una? Prueba: Fit camp este sábado 8am en Citrus Ranch Park, 30 lugares.${r ? '' : ''}`);
  }
  if (/thank|agradec/.test(low)) {
    await add('draft_announcement', { topic: 'thanks', text: es ? 'Gracias a cada anfitrión que abrió espacio esta semana. Su energía hace que más personas se sientan bienvenidas. Nos vemos en la próxima reunión.' : 'Thank you to every host who opened up space this week. Your energy helps more people feel welcome. See you at the next gathering.' });
    return reply('Here is a thank-you note for your hosts. Post it when it feels right.', 'Aquí tienes un mensaje de agradecimiento para tus anfitriones. Publícalo cuando quieras.');
  }
  if (/announce|anuncio|anunciar/.test(low)) {
    const topic = text.replace(/.*?(announcement|anuncio)\s*(about|sobre|de)?\s*/i, '').trim();
    await add('draft_announcement', { topic, text: es ? `Hola equipo. ${topic ? `${topic.charAt(0).toUpperCase()}${topic.slice(1)}. ` : ''}Gracias por todo lo que hacen. Revisen el calendario y elijan una reunión para esta semana.` : `Hi team. ${topic ? `${topic.charAt(0).toUpperCase()}${topic.slice(1)}. ` : ''}Thank you for everything you do. Check the calendar and pick one gathering to join this week.` });
    return reply('Here is a draft. You can edit it before posting.', 'Aquí tienes un borrador. Puedes editarlo antes de publicar.');
  }
  if (/direction|how do i get|get there|cómo llego|como llego|indicaciones/.test(low)) {
    await add('get_directions', { gathering_id: '' });
    return cards.length ? reply('Here is how to get to your next gathering.', 'Así llegas a tu próxima reunión.') : reply('I could not find an upcoming in-person gathering.', 'No encontré una reunión presencial próxima.');
  }
  if (/recipe|receta|snack|botana/.test(low)) {
    const r = /bowl|lunch|comida|tazón|garbanzo/.test(low) ? RECIPES[1]! : RECIPES[0]!;
    await add('suggest_recipe', { preferences: text, time: '', budget: '', title_en: r.title_en, title_es: r.title_es, minutes: r.minutes, ingredients: r.ing[lang], steps: r.steps[lang] });
    return reply('Here is a quick one you can make ahead.', 'Aquí tienes una receta rápida que puedes preparar con anticipación.');
  }
  if (/summar|resum/.test(low)) return reply('Open a lesson and ask again, and I will pull out the three key ideas and one thing to try this week.', 'Abre una lección y vuelve a preguntar; te daré las tres ideas clave y algo para practicar esta semana.');
  if (/today|week|upcoming|my gatherings|hoy|semana|próxim|proxim|mis reuniones/.test(low) && !/\d/.test(low)) {
    const items = await upcoming(ctx); cards.push({ type: 'upcoming', items });
    return items.length ? reply(`You have ${items.length} coming up. A good next step: send an invite for the first one.`, `Tienes ${items.length} próximas. Un buen siguiente paso: envía una invitación para la primera.`)
      : reply('Nothing on your calendar yet. A simple start: plan one gathering for this weekend.', 'Aún no hay nada en tu calendario. Un buen comienzo: planea una reunión para este fin de semana.');
  }
  if (/\d\s*(am|pm|a\.m|p\.m)|a las \d|spots|lugares|cupos|\b(gathering|reunión|fit camp|run club|yoga|walk|caminata|hike|class|clase)\b|plan a|planea/.test(low)) {
    if (/^(plan a gathering|planear una reunión|planea una reunión)\.?$/i.test(text.trim())) return reply('Tell me what, when and where, for example: Fit camp this Saturday 8am at Citrus Ranch Park, 30 spots.', 'Dime qué, cuándo y dónde, por ejemplo: Fit camp este sábado 8am en Citrus Ranch Park, 30 lugares.');
    await add('create_gathering_draft', parseGathering(text, input.today, lang));
    return reply('Here is your gathering. Take a look, then create it when it looks right.', 'Aquí está tu reunión. Revísala y créala cuando se vea bien.');
  }
  return reply(`Happy to help, ${input.name || 'there'}. I can plan a gathering, write an invite, draft an announcement, translate, or suggest a quick recipe.`, `Con gusto te ayudo${input.name ? `, ${input.name}` : ''}. Puedo planear una reunión, escribir una invitación, redactar un anuncio, traducir o sugerir una receta rápida.`);
}
