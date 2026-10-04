import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { z } from 'zod';

async function clients() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env['SUPABASE_URL']!; const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  const auth = getRequestHeader('authorization');
  const bearer = auth?.startsWith('Bearer ') && auth.slice(7) !== key ? auth : null;
  const asCaller = createClient(url, key, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false }, global: bearer ? { headers: { Authorization: bearer } } : {} });
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return { asCaller, admin: supabaseAdmin, signedIn: !!bearer };
}

const started = (e: { starts_at: string }) => new Date(e.starts_at).getTime() <= Date.now() + 5 * 60 * 1000;

/** Photo roll: visible where the gathering is visible, from its start time. Hosts also see hidden photos. */
export const listEventPhotos = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { asCaller, admin, signedIn } = await clients();
    const { data: canView } = await asCaller.rpc('can_view_event', { _event_id: data.eventId });
    if (!canView) return { photos: [], manage: false, open: false };
    const manage = signedIn ? !!(await asCaller.rpc('can_manage_event', { _event_id: data.eventId })).data : false;
    const { data: ev } = await admin.from('events').select('starts_at').eq('id', data.eventId).maybeSingle();
    if (!ev) return { photos: [], manage, open: false };
    const open = started(ev);
    if (!open && !manage) return { photos: [], manage, open };
    let q = admin.from('event_photos').select('id, path, hidden, created_at').eq('event_id', data.eventId).order('created_at', { ascending: false }).limit(60);
    if (!manage) q = q.eq('hidden', false);
    const { data: rows } = await q;
    const paths = (rows ?? []).map(r => r.path);
    const { data: signed } = paths.length ? await admin.storage.from('event-photos').createSignedUrls(paths, 3600) : { data: [] };
    return { manage, open, photos: (rows ?? []).map((r, i) => ({ id: r.id, hidden: r.hidden, url: signed?.[i]?.signedUrl ?? null })).filter(p => p.url) };
  });

/** Host/leader (signed in) or a checked-in guest (by checkin code) adds a compressed photo once the gathering has started. */
export const uploadEventPhoto = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({
    eventId: z.string().uuid(),
    code: z.string().min(16).max(64).optional(),
    dataUrl: z.string().startsWith('data:image/jpeg;base64,').max(4_000_000),
  }).parse(d))
  .handler(async ({ data }) => {
    const { asCaller, admin, signedIn } = await clients();
    const { data: ev } = await admin.from('events').select('id, starts_at, status').eq('id', data.eventId).maybeSingle();
    if (!ev || ev.status !== 'published') return { ok: false as const, error: 'not_open' };
    if (!started(ev)) return { ok: false as const, error: 'not_started' };
    let uploader: string | null = null; let rsvpId: string | null = null;
    if (signedIn && (await asCaller.rpc('can_manage_event', { _event_id: data.eventId })).data) {
      uploader = (await asCaller.auth.getUser()).data.user?.id ?? null;
    } else if (data.code) {
      const { data: r } = await admin.from('rsvps').select('id, checked_in_at').eq('event_id', data.eventId).eq('checkin_code', data.code).maybeSingle();
      if (!r?.checked_in_at) return { ok: false as const, error: 'not_checked_in' };
      rsvpId = r.id;
    } else return { ok: false as const, error: 'not_allowed' };
    const bytes = Buffer.from(data.dataUrl.split(',')[1] ?? '', 'base64');
    if (bytes.length > 3_000_000) return { ok: false as const, error: 'too_large' };
    const path = `${data.eventId}/${crypto.randomUUID()}.jpg`;
    const { error } = await admin.storage.from('event-photos').upload(path, bytes, { contentType: 'image/jpeg' });
    if (error) { console.error('[photos] upload failed', error.message); return { ok: false as const, error: 'upload_failed' }; }
    await admin.from('event_photos').insert({ event_id: data.eventId, path, uploaded_by: uploader, rsvp_id: rsvpId });
    return { ok: true as const };
  });

/** Day-of weather from Open-Meteo (free, no key). Returns null quietly on any problem. */
export const getWeather = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), at: z.string().datetime({ offset: true }) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${data.lat}&longitude=${data.lng}&hourly=temperature_2m,weather_code&forecast_days=2&timezone=UTC`);
      if (!res.ok) return null;
      const j = await res.json() as { hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[] } };
      if (!j.hourly) return null;
      const target = new Date(data.at).getTime();
      let best = 0, diff = Infinity;
      j.hourly.time.forEach((t, i) => { const d = Math.abs(new Date(`${t}Z`).getTime() - target); if (d < diff) { diff = d; best = i; } });
      if (diff > 3 * 3600 * 1000) return null;
      return { tempC: Math.round(j.hourly.temperature_2m[best] ?? 0), code: j.hourly.weather_code[best] ?? 0 };
    } catch { return null; }
  });
