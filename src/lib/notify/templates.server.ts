// Bilingual message templates for email, text and push. Server-only.
export const APP_URL = 'https://gatherwell-team-joy.lovable.app';

type Lang = 'en' | 'es';
type P = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function when(p: P, lang: Lang) {
  const iso = s(p['starts_at']); if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: s(p['timezone']) || 'UTC' }).format(new Date(iso));
  } catch { return new Date(iso).toUTCString(); }
}
const bi = (lang: Lang, p: P, key: string) => s(p[`${key}_${lang}`]) || s(p[`${key}_en`]);
const eventLink = (p: P) => `${APP_URL}/e/${s(p['event_id'])}`;
const manageLink = (p: P) => (p['code'] ? `${APP_URL}/r/${s(p['code'])}` : eventLink(p));

type Copy = { subject: string; heading: string; body: string[]; cta?: { label: string; url: string }; push: string };

function copy(template: string, lang: Lang, p: P): Copy | null {
  const es = lang === 'es';
  const title = s(p['title']); const date = when(p, lang); const place = s(p['location']) || (p['online'] ? (es ? 'En línea' : 'Online') : '');
  const hi = s(p['name']) ? (es ? `Hola, ${s(p['name'])}:` : `Hi ${s(p['name'])},`) : (es ? 'Hola:' : 'Hi there,');
  const details = [date, place].filter(Boolean).join(' · ');
  switch (template) {
    case 'rsvp_confirmed': return { subject: es ? `Estás en la lista: ${title}` : `You're in: ${title}`, heading: es ? 'Te esperamos' : "You're in", body: [hi, es ? `Tu lugar en ${title} está confirmado.` : `Your spot at ${title} is confirmed.`, details], cta: { label: es ? 'Ver mi confirmación' : 'View my RSVP', url: manageLink(p) }, push: es ? `Confirmado: ${title}` : `Confirmed: ${title}` };
    case 'first_timer_welcome': { const host = s(p['host']) || (es ? 'tu anfitriona' : 'your host'); return { subject: es ? `Tu primera vez: ${title}` : `Your first time: ${title}`, heading: es ? 'Qué esperar' : 'What to expect', body: [hi, es ? `Qué gusto que vengas por primera vez. ${host} te va a recibir al llegar.` : `So glad you're coming for the first time. ${host} will greet you when you arrive.`, details, s(p['note']), es ? 'Llega unos minutos antes, trae agua y ropa cómoda, y ven tal como eres. Todos empezamos alguna vez.' : 'Arrive a few minutes early, bring water and comfy clothes, and come as you are. Everyone starts somewhere.'].filter(Boolean), cta: { label: es ? 'Ver mi lugar' : 'View my spot', url: manageLink(p) }, push: es ? `Qué esperar en ${title}` : `What to expect at ${title}` }; }
    case 'buddy_intro': return { subject: es ? `Tu compañera para ${title}: ${s(p['buddy'])}` : `Meet your buddy for ${title}: ${s(p['buddy'])}`, heading: es ? 'Ya tienes compañía' : 'Meet your buddy', body: [hi, p['first_timer'] ? (es ? `${s(p['buddy'])} viene seguido y te va a acompañar en ${title}. Búscala al llegar.` : `${s(p['buddy'])} comes often and will keep you company at ${title}. Look for them when you arrive.`) : (es ? `${s(p['buddy'])} viene por primera vez a ${title}. Gracias por darle la bienvenida.` : `${s(p['buddy'])} is new to ${title}. Thanks for making them feel welcome.`), details], cta: { label: es ? 'Ver mi lugar' : 'View my spot', url: manageLink(p) }, push: es ? `Tu compañera: ${s(p['buddy'])}` : `Your buddy: ${s(p['buddy'])}` };
    case 'retreat_balance': {
      const amt = new Intl.NumberFormat(es ? 'es-MX' : 'en-US', { style: 'currency', currency: 'USD' }).format(Number(p['amount_cents'] ?? 0) / 100);
      const dueIso = s(p['due']); const due = dueIso ? new Intl.DateTimeFormat(es ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric' }).format(new Date(dueIso)) : '';
      const part = p['installment'] ? (es ? ` (pago ${s(p['installment'])} de ${s(p['installments'])})` : ` (payment ${s(p['installment'])} of ${s(p['installments'])})`) : '';
      return { subject: es ? `Próximo pago: ${title}` : `Payment coming up: ${title}`, heading: es ? 'Un recordatorio amable' : 'A friendly reminder', body: [hi, es ? `Tu próximo pago para ${title} es de ${amt}${part}, el ${due}.` : `Your next payment for ${title} is ${amt}${part}, due ${due}.`, details], cta: { label: es ? 'Ver mi lugar' : 'View my spot', url: manageLink(p) }, push: es ? `Pago de ${amt} el ${due}` : `${amt} due ${due}` };
    }
    case 'rsvp_waitlisted': return { subject: es ? `Lista de espera: ${title}` : `On the waitlist: ${title}`, heading: es ? 'Estás en lista de espera' : "You're on the waitlist", body: [hi, es ? `${title} está lleno por ahora. Si se libera un lugar, te avisamos.` : `${title} is full for now. If a spot opens, we'll let you know.`, details], cta: { label: es ? 'Ver mi lugar' : 'View my spot', url: manageLink(p) }, push: es ? `En lista de espera: ${title}` : `Waitlisted: ${title}` };
    case 'reminder_24h': return { subject: es ? `Mañana: ${title}` : `Tomorrow: ${title}`, heading: es ? 'Nos vemos mañana' : 'See you tomorrow', body: [hi, es ? `Un recordatorio amable de ${title}.` : `A friendly reminder about ${title}.`, details], cta: { label: es ? 'Ver detalles' : 'See details', url: manageLink(p) }, push: es ? `Mañana: ${title} · ${date}` : `Tomorrow: ${title} · ${date}` };
    case 'reminder_2h': return { subject: es ? `En 2 horas: ${title}` : `In 2 hours: ${title}`, heading: es ? 'Ya casi' : 'Almost time', body: [hi, es ? `${title} empieza pronto.` : `${title} starts soon.`, details], cta: { label: es ? 'Cómo llegar' : 'Get details', url: manageLink(p) }, push: es ? `En 2 horas: ${title}` : `In 2 hours: ${title}` };
    case 'waitlist_promoted': return { subject: es ? `¡Se liberó un lugar! ${title}` : `A spot opened up: ${title}`, heading: es ? 'Ya tienes lugar' : "You're in now", body: [hi, es ? `Se liberó un lugar en ${title} y ahora es tuyo.` : `A spot opened at ${title} and it's yours.`, details], cta: { label: es ? 'Ver mi confirmación' : 'View my RSVP', url: manageLink(p) }, push: es ? `Ya tienes lugar en ${title}` : `You're in: ${title}` };
    case 'gathering_updated': return { subject: es ? `Cambio en ${title}` : `Update: ${title}`, heading: es ? 'Hubo un cambio' : 'Something changed', body: [hi, es ? `Los detalles de ${title} cambiaron. Así queda:` : `The details for ${title} changed. Here's the latest:`, details], cta: { label: es ? 'Ver detalles' : 'See details', url: manageLink(p) }, push: es ? `Cambio en ${title}` : `Updated: ${title}` };
    case 'gathering_cancelled': return { subject: es ? `Cancelado: ${title}` : `Cancelled: ${title}`, heading: es ? 'Esta reunión se canceló' : 'This gathering is cancelled', body: [hi, es ? `Lo sentimos, ${title} (${date}) se canceló. Gracias por apuntarte.` : `We're sorry — ${title} (${date}) has been cancelled. Thank you for signing up.`], push: es ? `Cancelado: ${title}` : `Cancelled: ${title}` };
    case 'welcome_to_team': return { subject: es ? `Bienvenida a ${s(p['team'])}` : `Welcome to ${s(p['team'])}`, heading: es ? 'Qué gusto tenerte' : 'Glad you are here', body: [es ? `Ya eres parte de ${s(p['team'])} en Gatherwell. Aquí verás reuniones, retos y entrenamientos del equipo.` : `You're now part of ${s(p['team'])} on Gatherwell. Gatherings, challenges and trainings from your team live here.`], cta: { label: es ? 'Abrir Gatherwell' : 'Open Gatherwell', url: `${APP_URL}/team` }, push: es ? `Bienvenida a ${s(p['team'])}` : `Welcome to ${s(p['team'])}` };
    case 'badge_earned': return { subject: es ? `Nueva insignia: ${bi(lang, p, 'name')}` : `New badge: ${bi(lang, p, 'name')}`, heading: bi(lang, p, 'name'), body: [es ? 'Obtuviste una insignia nueva.' : 'You earned a new badge.', bi(lang, p, 'description')], cta: { label: es ? 'Ver mis insignias' : 'See my badges', url: `${APP_URL}/me` }, push: es ? `Insignia obtenida: ${bi(lang, p, 'name')}` : `Badge earned: ${bi(lang, p, 'name')}` };
    case 'live_session_reminder': case 'live_lesson_reminder': return { subject: es ? `En vivo pronto: ${bi(lang, p, 'title')}` : `Live soon: ${bi(lang, p, 'title')}`, heading: es ? 'La sesión en vivo está por empezar' : 'Your live session is starting', body: [bi(lang, p, 'title') || s(p['title'])], cta: { label: es ? 'Abrir la sesión' : 'Open the session', url: `${APP_URL}/learn/lesson/${s(p['lesson_id'])}` }, push: es ? `En vivo pronto: ${bi(lang, p, 'title')}` : `Live soon: ${bi(lang, p, 'title')}` };
    case 'team_announcement': return { subject: es ? `Aviso de ${s(p['team'])}` : `From ${s(p['team'])}`, heading: es ? `Aviso de ${s(p['author']) || s(p['team'])}` : `A note from ${s(p['author']) || s(p['team'])}`, body: [s(p['body'])], cta: { label: es ? 'Abrir el equipo' : 'Open your team', url: `${APP_URL}/team` }, push: `${s(p['team'])}: ${s(p['body']).slice(0, 120)}` };
    case 'host_followup': return { subject: es ? `Un mensaje de ${s(p['host']) || 'tu anfitriona'}` : `A note from ${s(p['host']) || 'your host'}`, heading: s(p['title']) || (es ? 'Gracias' : 'Thank you'), body: [s(p['body'])], push: s(p['body']).slice(0, 120) };
    case 'payment_receipt': return { subject: es ? `Recibo: ${title}` : `Receipt: ${title}`, heading: es ? 'Gracias por tu pago' : 'Thanks for your payment', body: [hi, es ? `Pagaste ${s(p['amount'])} por ${title}. Tu lugar está confirmado.` : `You paid ${s(p['amount'])} for ${title}. Your spot is confirmed.`, details], cta: { label: es ? 'Ver mi confirmación' : 'View my RSVP', url: manageLink(p) }, push: es ? `Pago recibido: ${title}` : `Payment received: ${title}` };
    case 'payment_refunded': return { subject: es ? `Reembolso: ${title}` : `Refund: ${title}`, heading: es ? 'Tu reembolso está en camino' : 'Your refund is on its way', body: [hi, es ? `Reembolsamos ${s(p['amount'])} de ${title}. Puede tardar unos días en aparecer.` : `We refunded ${s(p['amount'])} for ${title}. It can take a few days to appear.`], push: es ? `Reembolso: ${title}` : `Refunded: ${title}` };
    case 'payment_failed': return { subject: es ? 'No pudimos cobrar tu plan' : "We couldn't charge your plan", heading: es ? 'Revisa tu método de pago' : 'Please check your payment method', body: [es ? 'Tu último pago del plan no se completó. Tus reuniones y datos siguen igual. Actualiza tu tarjeta para mantener tu plan.' : "Your latest plan payment didn't go through. Your gatherings and data are unchanged. Update your card to keep your plan."], cta: { label: es ? 'Abrir mi plan' : 'Open my plan', url: `${APP_URL}/plan` }, push: es ? 'Revisa tu método de pago' : 'Please check your payment method' };
    case 'plan_waitlist': { const n = Number(p['waiting'] ?? 0); return { subject: es ? `Hay personas esperando: ${title}` : `Guests are waiting: ${title}`, heading: es ? 'Tu reunión está creciendo' : 'Your gathering is growing', body: [es ? `${n} ${n === 1 ? 'persona está' : 'personas están'} en lista de espera para ${title} porque llegaste al límite de invitados de tu plan.` : `${n} ${n === 1 ? 'guest is' : 'guests are'} waiting for ${title} because your plan's guest limit was reached.`, es ? 'Mejora tu plan para darles la bienvenida.' : 'Upgrade to welcome them.'], cta: { label: es ? 'Ver planes' : 'See plans', url: `${APP_URL}/plan` }, push: es ? `${n} en espera: ${title}` : `${n} waiting: ${title}` }; }
    case 'broadcast': return { subject: bi(lang, p, 'title'), heading: bi(lang, p, 'title'), body: bi(lang, p, 'body').split(/\n+/).filter(Boolean), cta: { label: es ? 'Abrir Gatherwell' : 'Open Gatherwell', url: `${APP_URL}/home` }, push: bi(lang, p, 'title') };
    case 'comment_reply': return { subject: es ? `${s(p['name'])} te respondió` : `${s(p['name'])} replied to you`, heading: es ? 'Nueva respuesta' : 'New reply', body: [es ? `${s(p['name'])} respondió en ${title}:` : `${s(p['name'])} replied in ${title}:`, s(p['snippet'])], cta: { label: es ? 'Ver conversación' : 'View conversation', url: `${APP_URL}${s(p['url'])}` }, push: es ? `${s(p['name'])} te respondió en ${title}` : `${s(p['name'])} replied in ${title}` };
    case 'comment_mention': return { subject: es ? `${s(p['name'])} te mencionó` : `${s(p['name'])} mentioned you`, heading: es ? 'Te mencionaron' : 'You were mentioned', body: [es ? `${s(p['name'])} te mencionó en ${title}:` : `${s(p['name'])} mentioned you in ${title}:`, s(p['snippet'])], cta: { label: es ? 'Ver conversación' : 'View conversation', url: `${APP_URL}${s(p['url'])}` }, push: es ? `${s(p['name'])} te mencionó en ${title}` : `${s(p['name'])} mentioned you in ${title}` };
    case 'followed_gathering': { const who = s(p['host']) || s(p['team']); return { subject: es ? `Nueva reunión de ${who}: ${title}` : `New from ${who}: ${title}`, heading: es ? `${who} publicó una reunión` : `${who} posted a gathering`, body: [es ? `Sigues a ${who}. Esta es su nueva reunión:` : `You follow ${who}. Here's their new gathering:`, title, details], cta: { label: es ? 'Ver y confirmar' : 'See and RSVP', url: eventLink(p) }, push: es ? `${who}: ${title} · ${date}` : `${who}: ${title} · ${date}` }; }
    case 'rsvp_requested': return { subject: es ? `Solicitud recibida: ${title}` : `Request received: ${title}`, heading: es ? 'Recibimos tu solicitud' : 'We got your request', body: [hi, es ? `El anfitrión de ${title} revisará tu confirmación y te avisaremos.` : `The host of ${title} will review your RSVP and we'll let you know.`, details], cta: { label: es ? 'Ver mi solicitud' : 'View my request', url: manageLink(p) }, push: es ? `Solicitud enviada: ${title}` : `Request sent: ${title}` };
    case 'rsvp_declined': return { subject: es ? `Sobre tu solicitud: ${title}` : `About your request: ${title}`, heading: es ? 'Esta vez no hubo lugar' : "Not this time", body: [hi, es ? `El anfitrión de ${title} no pudo darte lugar esta vez. Esperamos verte en otra reunión.` : `The host of ${title} couldn't fit you in this time. We hope to see you at another gathering.`], push: es ? `Sin lugar esta vez: ${title}` : `Not this time: ${title}` };
    case 'rsvp_request': return { subject: es ? `Nueva solicitud: ${title}` : `New request: ${title}`, heading: es ? 'Alguien quiere unirse' : 'Someone wants to join', body: [es ? `${s(p['guest'])} pidió unirse a ${title}.` : `${s(p['guest'])} asked to join ${title}.`], cta: { label: es ? 'Revisar' : 'Review', url: `${APP_URL}/event/${s(p['event_id'])}/guests` }, push: es ? `${s(p['guest'])} pidió unirse a ${title}` : `${s(p['guest'])} asked to join ${title}` };
    default: return null;
  }
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderEmail(template: string, lang: Lang, p: P, unsubscribeUrl: string | null) {
  const c = copy(template, lang, p); if (!c) return null;
  const foot = lang === 'es' ? 'Recibes este correo por tu actividad en Gatherwell.' : 'You are receiving this because of your activity on Gatherwell.';
  const unsub = lang === 'es' ? 'Cambiar o dejar de recibir correos' : 'Change or stop these emails';
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(c.subject)}</title></head>
<body style="margin:0;background:#F7F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif;color:#2F2340">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F9;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E8E5EE;border-radius:16px;overflow:hidden">
<tr><td style="height:4px;background:#2F2340;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 8px"><span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#2F2340;color:#F3C6A5;text-align:center;font-weight:600;font-size:20px;line-height:26px">g</span><span style="font-weight:700;font-size:16px;vertical-align:top;line-height:28px;margin-left:10px">Gatherwell</span></td></tr>
<tr><td style="padding:16px 32px 8px"><h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:#2F2340">${esc(c.heading)}</h1></td></tr>
<tr><td style="padding:8px 32px 8px;font-size:15px;line-height:1.65;color:#4A4255">${c.body.filter(Boolean).map(b => `<p style="margin:0 0 12px">${esc(b).replace(/\n/g, '<br>')}</p>`).join('')}</td></tr>
${c.cta ? `<tr><td style="padding:8px 32px 28px"><a href="${esc(c.cta.url)}" style="display:inline-block;background:#2F2340;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:12px">${esc(c.cta.label)}</a></td></tr>` : '<tr><td style="padding:0 0 20px"></td></tr>'}
</table>
<p style="max-width:520px;font-size:12px;line-height:1.6;color:#8A8296;margin:16px auto 0">${esc(foot)}${unsubscribeUrl ? ` <a href="${esc(unsubscribeUrl)}" style="color:#7A5FA8">${esc(unsub)}</a>` : ''}</p>
</td></tr></table></body></html>`;
  const text = [c.heading, '', ...c.body.filter(Boolean), '', c.cta ? `${c.cta.label}: ${c.cta.url}` : '', '', foot, unsubscribeUrl ? `${unsub}: ${unsubscribeUrl}` : ''].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { subject: c.subject, html, text };
}

export function renderSms(template: string, lang: Lang, p: P) {
  const es = lang === 'es'; const title = s(p['title']); const date = when(p, lang);
  const stop = es ? 'Responde STOP para no recibir más' : 'Reply STOP to opt out';
  const link = manageLink(p);
  const page = p['path'] ? `${APP_URL}${s(p['path'])}` : eventLink(p);
  const pass = p['code'] ? `${APP_URL}/r/${s(p['code'])}` : page;
  const hi = s(p['name']) ? (es ? `Hola, ${s(p['name'])}. ` : `Hi ${s(p['name'])}, `) : '';
  const host = s(p['host']);
  const lines: Record<string, string> = {
    reminder_24h: es ? `Gatherwell: mañana es ${title}, ${date}. ${link}` : `Gatherwell: ${title} is tomorrow, ${date}. ${link}`,
    reminder_2h: es ? `Gatherwell: ${title} empieza en 2 horas. ${link}` : `Gatherwell: ${title} starts in 2 hours. ${link}`,
    waitlist_promoted: es ? `Gatherwell: ¡se liberó un lugar en ${title}! Ya es tuyo. ${link}` : `Gatherwell: a spot opened at ${title} — you're in. ${link}`,
    gathering_cancelled: es ? `Gatherwell: ${title} (${date}) se canceló. Lo sentimos.` : `Gatherwell: ${title} (${date}) is cancelled. Sorry about that.`,
    gathering_invite: es
      ? `Gatherwell: ${hi}${host ? `${host} te invita a` : 'Te invitamos a'} ${title}, ${date}. ${page} Responde SI para reservar tu lugar.`
      : `Gatherwell: ${hi}${host ? `${host} invited you to` : "You're invited to"} ${title}, ${date}. ${page} Reply IN to save your spot.`,
    text_rsvp_going: es ? `Gatherwell: ¡listo! Tu lugar en ${title} está reservado. Detalles: ${page} Tu pase de entrada: ${pass} Responde NO si ya no puedes ir.` : `Gatherwell: you're in for ${title}. Details: ${page} Your check-in pass: ${pass} Reply OUT if you can't make it.`,
    text_rsvp_waitlist: es ? `Gatherwell: ${title} está lleno, así que estás en lista de espera. Te avisamos si se libera un lugar. ${pass}` : `Gatherwell: ${title} is full, so you're on the waitlist. We'll text you if a spot opens. ${pass}`,
    text_rsvp_requested: es ? `Gatherwell: recibimos tu solicitud para ${title}. El anfitrión la revisará pronto. ${pass}` : `Gatherwell: we got your request for ${title}. The host will review it soon. ${pass}`,
    text_rsvp_finish: es ? `Gatherwell: casi listo. Termina tu reservación para ${title} aquí: ${page}` : `Gatherwell: almost there. Finish your RSVP for ${title} here: ${page}`,
    text_rsvp_out: es ? `Gatherwell: cancelamos tu lugar en ${title}. Si cambias de idea: ${page}` : `Gatherwell: your spot at ${title} is cancelled. Changed your mind? ${page}`,
    text_rsvp_closed: es ? `Gatherwell: ${title} ya no acepta reservaciones.` : `Gatherwell: ${title} is no longer taking RSVPs.`,
  };
  if (template === 'host_followup') return `${s(p['body'])} ${stop}`;
  const line = lines[template]; if (!line) return null;
  return `${line} ${stop}`;
}

export function renderPush(template: string, lang: Lang, p: P) {
  const c = copy(template, lang, p); if (!c) return null;
  const url = template === 'team_announcement' ? '/team' : template === 'badge_earned' ? '/me' : p['event_id'] ? `/event/${s(p['event_id'])}` : p['lesson_id'] ? `/learn/lesson/${s(p['lesson_id'])}` : '/';
  return { title: 'Gatherwell', body: c.push, url };
}

export function smsHelp(lang: Lang) {
  return lang === 'es'
    ? 'Gatherwell: recordatorios de reuniones de tu equipo. Responde STOP para no recibir más o START para volver. Ayuda: help@gatherwell.app'
    : 'Gatherwell: reminders for your team gatherings. Reply STOP to opt out or START to opt back in. Help: help@gatherwell.app';
}
