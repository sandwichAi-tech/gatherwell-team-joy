import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { AssistantReply } from '@/lib/assistant/config';

const lang = z.enum(['en', 'es']);

/** The ai-assistant backend function: Claude when ANTHROPIC_API_KEY exists, preview replies otherwise. */
export const askAssistant = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) })).min(1).max(30),
    lang, screen: z.enum(['home', 'events', 'team', 'learn', 'me']), today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tz: z.string().max(64), origin: z.string().url().max(200), name: z.string().max(80),
  }).parse(d))
  .handler(async ({ data, context }): Promise<AssistantReply> => {
    const key = process.env['ANTHROPIC_API_KEY'];
    const base = { supabase: context.supabase, userId: context.userId, lang: data.lang, origin: data.origin };
    const last = data.messages[data.messages.length - 1]!;
    if (!key) {
      const { mockReply, sampleTranslate } = await import('@/lib/assistant/mock.server');
      console.info('[assistant] preview mode — ANTHROPIC_API_KEY not set');
      return mockReply({ text: last.text, lang: data.lang, screen: data.screen, today: data.today, name: data.name }, { ...base, translate: async (t, target) => sampleTranslate(t, target) });
    }
    const { data: usage } = await context.supabase.rpc('ai_usage_status');
    const u = usage as { used: number; limit: number } | null;
    if (u && u.used >= u.limit) return { text: '', cards: [], preview: false, limitReached: true };
    const { claudeReply, ClaudeError } = await import('@/lib/assistant/claude.server');
    try {
      const { reply, input, output } = await claudeReply(key, data.messages, data, base);
      await context.supabase.rpc('record_ai_usage', { _feature: 'assistant', _input: input, _output: output });
      return reply;
    } catch (e) {
      const status = e instanceof ClaudeError ? e.status : 500;
      return { text: '', cards: [], preview: false, error: status === 429 || status === 529 ? 'busy' : status === 401 || status === 403 ? 'config' : 'failed' };
    }
  });

export const translateText = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(4000), target: z.enum(['en', 'es', 'pt']) }).parse(d))
  .handler(async ({ data, context }): Promise<{ text: string; preview: boolean; error?: string }> => {
    const key = process.env['ANTHROPIC_API_KEY'];
    if (!key) {
      const { sampleTranslate } = await import('@/lib/assistant/mock.server');
      return { text: sampleTranslate(data.text, data.target), preview: true };
    }
    const { data: usage } = await context.supabase.rpc('ai_usage_status');
    const u = usage as { used: number; limit: number } | null;
    if (u && u.used >= u.limit) return { text: '', preview: false, error: 'limit' };
    const { claudeTranslate } = await import('@/lib/assistant/claude.server');
    try {
      const r = await claudeTranslate(key, data.text, data.target);
      await context.supabase.rpc('record_ai_usage', { _feature: 'translate', _input: r.input, _output: r.output });
      return { text: r.text, preview: false };
    } catch { return { text: '', preview: false, error: 'failed' }; }
  });

export const assistantStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc('ai_usage_status');
    const u = (data ?? { used: 0, limit: 50, plan: 'free' }) as { used: number; limit: number; plan: string };
    return { ...u, connected: !!process.env['ANTHROPIC_API_KEY'] };
  });
