// Minimal Stripe REST client (fetch-based, Worker-safe). Server-only.
import { createHmac, timingSafeEqual } from 'crypto';

export const stripeKey = () => process.env['STRIPE_SECRET_KEY'] || '';

function encode(obj: Record<string, unknown>, prefix = '', out: string[] = []): string[] {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? encode(item as Record<string, unknown>, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`)));
    else if (typeof v === 'object') encode(v as Record<string, unknown>, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export async function stripe<T = any>(path: string, params?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const key = stripeKey();
  if (!key) throw new Error('not_connected');
  const body = params ? encode(params).join('&') : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && body ? `?${body}` : ''}`, {
    method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' && body ? body : null,
  });
  const json = await res.json() as any;
  if (!res.ok) { console.error('[stripe]', path, json?.error?.message); throw new Error(json?.error?.message || 'stripe_error'); }
  return json as T;
}

export function verifyStripeSignature(body: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=') as [string, string]));
  const t = parts['t']; const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${body}`).digest('hex'));
  return sigs.some(s => { const b = Buffer.from(s); return b.length === expected.length && timingSafeEqual(b, expected); });
}

export const PLAN_PRICES = { growth: { month: 2900, year: 29000 }, pro: { month: 7900, year: 79000 } } as const;
export const LICENSE_PRICES = { team25: { cents: 19900, seats: 25 }, team100: { cents: 49900, seats: 100 } } as const;
export const FEE_PCT = { free: 8, growth: 4, pro: 2 } as const;
