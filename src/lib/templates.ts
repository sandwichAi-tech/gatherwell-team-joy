import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Template = Database['public']['Tables']['templates']['Row'];

/** Everything the caller may read: starters, published templates of their teams and parent teams, and drafts of teams they lead. */
export const templatesQuery = () => queryOptions({
  queryKey: ['templates'],
  queryFn: async (): Promise<Template[]> => {
    const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const checklistOf = (template: Pick<Template, 'checklist'>) =>
  Array.isArray(template.checklist) ? (template.checklist as unknown[]).filter((item): item is string => typeof item === 'string') : [];

export type ChecklistItem = { label: string; done: boolean };

export const eventDetailQuery = (eventId: string) => queryOptions({
  queryKey: ['event', eventId],
  queryFn: async () => {
    const { data: event, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (error) throw error;
    if (!event) return null;
    const [{ data: host }, { data: going }, { data: team }, { data: checklist }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', event.host_id).maybeSingle(),
      supabase.rpc('event_going_count', { _event_id: event.id }),
      supabase.from('teams').select('name').eq('id', event.team_id).maybeSingle(),
      supabase.from('event_checklists').select('items').eq('event_id', event.id).maybeSingle(),
    ]);
    const items: ChecklistItem[] | null = Array.isArray(checklist?.items) ? (checklist.items as unknown as ChecklistItem[]) : null;
    return { event, hostName: host?.full_name ?? null, going: going ?? 0, teamName: team?.name ?? null, checklist: items };
  },
});
