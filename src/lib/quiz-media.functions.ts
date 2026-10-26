import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Signs question, answer, outcome and cover images of one quiz for a caller who may open it
 * (its editor, or a participant the database lets in). Paths are read server-side from the quiz
 * itself and must sit in the quiz creator's own media folder; no path is accepted from the client.
 */
export const quizImageUrls = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quizId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
    const [{ data: canEdit }, { data: taker }] = await Promise.all([
      sb.rpc('can_edit_quiz', { _quiz: data.quizId }),
      sb.rpc('get_quiz_for_taker', { _quiz: data.quizId }),
    ]);
    const allowed = canEdit === true || (!!taker && !(taker as { error?: string }).error);
    if (!allowed) return {} as Record<string, string>;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: quiz } = await supabaseAdmin.from('quizzes').select('host_id, cover_path').eq('id', data.quizId).maybeSingle();
    if (!quiz?.host_id) return {} as Record<string, string>;
    const { data: qs } = await supabaseAdmin.from('quiz_questions').select('id, image_path').eq('quiz_id', data.quizId);
    const qids = (qs ?? []).map(q => q.id);
    const [{ data: opts }, { data: outs }] = await Promise.all([
      qids.length ? supabaseAdmin.from('quiz_options').select('image_path').in('question_id', qids) : Promise.resolve({ data: [] as { image_path: string | null }[] }),
      supabaseAdmin.from('quiz_outcomes').select('image_path').eq('quiz_id', data.quizId),
    ]);
    const prefix = `${quiz.host_id}/`;
    const paths = [...new Set([quiz.cover_path, ...(qs ?? []).map(q => q.image_path), ...(opts ?? []).map(o => o.image_path), ...(outs ?? []).map(o => o.image_path)]
      .filter((p): p is string => !!p && p.startsWith(prefix) && !p.includes('..')))].slice(0, 200);
    if (!paths.length) return {} as Record<string, string>;
    const { data: signed } = await supabaseAdmin.storage.from('media').createSignedUrls(paths, 3600);
    const out: Record<string, string> = {};
    for (const s of signed ?? []) if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
    return out;
  });
