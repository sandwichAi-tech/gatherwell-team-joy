import { isCategory } from '@/lib/landing';
import type { Template } from '@/lib/templates';
import type { Gathering } from '@/lib/gatherings';

export function blueprintDefaults(template: Template) {
  return {
    title: template.title, category: isCategory(template.category) ? template.category : 'more',
    categoryLabel: template.category_label ?? '', descriptionEn: template.description_en ?? '', descriptionEs: template.description_es ?? '',
    duration: template.default_duration_minutes, capacity: template.default_capacity,
    mode: template.default_mode === 'online' ? 'online' as const : 'person' as const,
    priceCents: template.visibility_default === 'team' ? 0 : template.default_price_cents,
    visibility: template.visibility_default === 'team' ? 'team' as const : 'public' as const,
    cover: template.cover_url, coverStyle: template.cover_style,
  };
}

export function blueprintFromEvent(event: Gathering, checklist: string[] = []) {
  return {
    title: event.title, category: event.category ?? 'more', category_label: event.category_label,
    description_en: event.description_en, description_es: event.description_es,
    cover_url: event.cover_url, cover_style: event.cover_style ?? 0,
    default_duration_minutes: event.ends_at ? Math.min(1440, Math.max(5, Math.round((new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60000))) : 60,
    default_capacity: event.capacity, default_mode: event.online_url ? 'online' : 'person',
    default_price_cents: event.visibility === 'team' ? 0 : event.price_cents ?? 0,
    visibility_default: event.visibility === 'team' ? 'team' : 'public', checklist, is_published: true,
  };
}

export function canEditBlueprint(template: Pick<Template, 'team_id' | 'created_by'>, userId: string, leaderTeamIds: string[]) {
  return !!template.team_id && (template.created_by === userId || leaderTeamIds.includes(template.team_id));
}
