/** Single place to change the Claude model used by the Gatherwell Assistant. */
export const ASSISTANT_MODEL = 'claude-sonnet-4-5';
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const MAX_TOOL_STEPS = 5;

export type Lang = 'en' | 'es';
export type Screen = 'home' | 'events' | 'team' | 'learn' | 'me';

export type GatheringDraft = { title: string; date: string; time: string; place: string; capacity: number | null; description_en: string; description_es: string };
export type RecipeCard = { title_en: string; title_es: string; minutes: number | null; ingredients: string[]; steps: string[]; lang: Lang };
export type UpcomingItem = { id: string; title: string; starts_at: string; place: string | null; visibility: string };

export type AssistantCard =
  | { type: 'gathering'; draft: GatheringDraft }
  | { type: 'translation'; text: string; target: 'en' | 'es' | 'pt' }
  | { type: 'invite'; text: string; channel: 'whatsapp' | 'instagram' | 'text'; link: string }
  | { type: 'announcement'; text: string }
  | { type: 'upcoming'; items: UpcomingItem[] }
  | { type: 'directions'; title: string; url: string; tip: string }
  | { type: 'recipe'; recipe: RecipeCard };

export type ChatTurn = { role: 'user' | 'assistant'; text: string };
export type AssistantReply = { text: string; cards: AssistantCard[]; preview: boolean; limitReached?: boolean; error?: string };
