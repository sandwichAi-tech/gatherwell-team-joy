import { addDays, MESSAGE_KINDS, STARTER_DAYS, type ChallengeActivity, type ChallengeMessage, type ChallengeModel, type Starter } from './challenges';
import { validHttps, addonDescriptionValid, type Addon } from './event-builder';

export type ChallengeAddon = Addon & { description?: string; max_quantity: number; inventory: number | null; available: boolean };
export type ChallengeBasics = {
  title_en: string; title_es: string; description_en: string; description_es: string;
  daily_prompt_en: string; daily_prompt_es: string; starts_on: string; ends_on: string;
  cover_url: string | null; cover_style: number; timezone: string;
  model: ChallengeModel; goal_target: string; goal_unit: string; frequency: 'daily' | 'weekly';
  enrollment: 'open' | 'invite' | 'public'; capacity: string; leaderboard_on: boolean;
};
export const CHALLENGE_STEPS = ['basics', 'model', 'activities', 'messages', 'review'] as const;
export type ChallengeStep = typeof CHALLENGE_STEPS[number];
export const blankActivity = (sort: number): ChallengeActivity => ({ title_en: '', title_es: '', instructions_en: '', instructions_es: '', day_offset: null, sort_order: sort, requires_checkin: true, requires_note: false, due_hour: null, link_url: null, resource_kind: null, resource_id: null, file_path: null });
export const blankMessages = (): ChallengeMessage[] => MESSAGE_KINDS.map((kind, i) => ({ kind, send_offset_days: kind === 'start_reminder' ? -1 : 0, send_hour: 9, title_en: '', title_es: '', body_en: '', body_es: '', channel: 'in_app', enabled: false, paused: false, sort_order: i }));

/** Complete fresh configuration; translations are editable content, not automatic host-content translation. */
export function challengeTemplate(starter: Starter | 'scratch', starts: string, lang: 'en' | 'es', text: (key: string) => string, timezone: string) {
  const days = starter === 'scratch' ? 21 : STARTER_DAYS[starter];
  const content = (field: string) => starter === 'scratch' ? '' : text(`challenges.starter.${starter}.${field}`);
  const f: ChallengeBasics = { title_en: lang === 'en' ? content('title') : '', title_es: lang === 'es' ? content('title') : '', description_en: lang === 'en' ? content('description') : '', description_es: lang === 'es' ? content('description') : '', daily_prompt_en: lang === 'en' ? content('prompt') : '', daily_prompt_es: lang === 'es' ? content('prompt') : '', starts_on: starts, ends_on: addDays(starts, days - 1), cover_url: null, cover_style: 0, timezone, model: starter === 'walk' ? 'goal' : starter === 'hydration' ? 'points' : 'streak', goal_target: starter === 'walk' ? String(days) : '', goal_unit: starter === 'walk' ? text('challenges.walksUnit') : '', frequency: 'daily', enrollment: 'open', capacity: '', leaderboard_on: false };
  const activities = starter === 'scratch' ? [] : [null, days].map((day, i) => ({ ...blankActivity(i), day_offset: day, title_en: lang === 'en' ? content(i ? 'reflectionTitle' : 'activityTitle') : '', title_es: lang === 'es' ? content(i ? 'reflectionTitle' : 'activityTitle') : '', instructions_en: lang === 'en' ? content(i ? 'reflection' : 'instructions') : '', instructions_es: lang === 'es' ? content(i ? 'reflection' : 'instructions') : '', requires_checkin: i === 0 }));
  const messages = blankMessages().map(m => ({ ...m, title_en: lang === 'en' && starter !== 'scratch' ? text(`challenges.templateMessage.${m.kind}.title`) : '', title_es: lang === 'es' && starter !== 'scratch' ? text(`challenges.templateMessage.${m.kind}.title`) : '', body_en: lang === 'en' && starter !== 'scratch' ? text(`challenges.templateMessage.${m.kind}.body`) : '', body_es: lang === 'es' && starter !== 'scratch' ? text(`challenges.templateMessage.${m.kind}.body`) : '' }));
  return { f, activities, messages, addons: [] as ChallengeAddon[], paid: false, price: '' };
}

export const challengePrice = (value: string) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0.5 && Number(value) <= 1000 ? Math.round(Number(value) * 100) : null;

export function challengeStepIssues(step: ChallengeStep, f: ChallengeBasics, acts: ChallengeActivity[], msgs: ChallengeMessage[], paid: boolean, price: string, addons: ChallengeAddon[]) {
  const out: string[] = [];
  const hasTitle = (en: string, es: string) => !!(en.trim() || es.trim());
  if (step === 'basics' || step === 'review') {
    if (!hasTitle(f.title_en, f.title_es)) out.push('title');
    if (!f.starts_on || !Number.isFinite(Date.parse(f.starts_on))) out.push('start');
    const days = (Date.parse(f.ends_on) - Date.parse(f.starts_on)) / 864e5 + 1;
    if (!Number.isFinite(days) || days < 1 || days > 366) out.push('end');
    if (paid && challengePrice(price) == null) out.push('price');
    if (addons.length > 8 || addons.some(a => !a.name.trim() || a.name.length > 60 || !Number.isInteger(a.price_cents) || a.price_cents < 0 || a.price_cents > 100000 || (a.description ?? '').length > 500 || !addonDescriptionValid(a) || !Number.isInteger(a.max_quantity) || a.max_quantity < 1 || a.max_quantity > 20 || a.inventory != null && (!Number.isInteger(a.inventory) || a.inventory < 0))) out.push('addons');
  }
  if (step === 'model' || step === 'review') {
    const possible = challengePeriods((Date.parse(f.ends_on) - Date.parse(f.starts_on)) / 864e5 + 1, f.frequency);
    if (f.model === 'goal' && (!Number.isInteger(Number(f.goal_target)) || Number(f.goal_target) < 1 || Number(f.goal_target) > Math.min(1000, possible))) out.push('goal');
    if (f.capacity && (!Number.isInteger(Number(f.capacity)) || Number(f.capacity) < 1 || Number(f.capacity) > 10000)) out.push('capacity');
  }
  const len = (Date.parse(f.ends_on) - Date.parse(f.starts_on)) / 864e5 + 1;
  if (step === 'activities' || step === 'review') {
    if (acts.length > 30 || acts.some(a => !hasTitle(a.title_en, a.title_es) || a.day_offset != null && (!Number.isInteger(a.day_offset) || a.day_offset < 1 || a.day_offset > len) || a.due_hour != null && (!Number.isInteger(a.due_hour) || a.due_hour < 0 || a.due_hour > 23) || !!a.link_url && !validHttps(a.link_url))) out.push('activities');
  }
  if (step === 'messages' || step === 'review') {
    if (msgs.some(m => !Number.isInteger(m.send_hour) || m.send_hour < 0 || m.send_hour > 23 || !Number.isInteger(m.send_offset_days) || m.send_offset_days < -7 || m.send_offset_days > len || m.enabled && (!hasTitle(m.body_en, m.body_es) || m.kind !== 'welcome' || m.send_offset_days !== 0))) out.push('messages');
  }
  return out;
}

/** Day-specific final reflections follow the end date; out-of-range custom days remain errors, never silently dropped. */
export function resizeChallengeSchedule(acts: ChallengeActivity[], oldLength: number, newLength: number) {
  return acts.map(a => a.day_offset === oldLength ? { ...a, day_offset: newLength } : a);
}
export const challengeScore = (model: ChallengeModel, total: number, current: number, target?: number | null) => model === 'streak' ? current : model === 'goal' ? Math.min(total, target ?? total) : total;
export const challengePeriods = (length: number, frequency: string) => frequency === 'weekly' ? Math.ceil(length / 7) : length;
export const checkedInPeriod = (dates: string[], today: string, starts: string, frequency: string) => frequency === 'weekly' ? dates.some(d => Math.floor((Date.parse(d) - Date.parse(starts)) / (7 * 864e5)) === Math.floor((Date.parse(today) - Date.parse(starts)) / (7 * 864e5))) : dates.includes(today);

export function challengeExtrasTotal(addons: ChallengeAddon[], selections: Record<string, number>) {
  return addons.reduce((sum, a) => sum + (a.available ? a.price_cents * (selections[a.id] ?? 0) : 0), 0);
}