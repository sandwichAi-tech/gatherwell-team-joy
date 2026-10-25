import { describe, it, expect } from 'vitest';
import { createInstance } from 'i18next';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { insightsNavigationLabel, navigationPathActive, showInsightsNavigation } from './insights-navigation';

describe('Insights primary navigation', () => {
  it('shows existing own-host or team analytics roles', () => {
    for (const role of ['owner', 'admin', 'host', 'analyst'] as const) expect(showInsightsNavigation(role, false, false)).toBe(true);
    expect(showInsightsNavigation('member', true, false)).toBe(true);
  });
  it('hides it from guests and roles without access', () => {
    for (const role of ['content_editor', 'checkin', 'moderator', 'member', null] as const) expect(showInsightsNavigation(role, false, false)).toBe(false);
    expect(showInsightsNavigation('owner', true, true)).toBe(false);
  });
  it('selects the real route and nested routes, not similar unrelated paths', () => {
    expect(navigationPathActive('/insights', '/insights')).toBe(true);
    expect(navigationPathActive('/insights/events', '/insights')).toBe(true);
    expect(navigationPathActive('/events', '/insights')).toBe(false);
    expect(navigationPathActive('/insights-other', '/insights')).toBe(false);
  });
  it('uses scalar bilingual resources with safe missing-key/object fallbacks', async () => {
    const i18n = createInstance();
    await i18n.init({ resources: { en: { translation: en }, es: { translation: es } }, lng: 'en' });
    for (const language of ['en', 'es']) {
      await i18n.changeLanguage(language);
      expect(typeof insightsNavigationLabel(language, i18n.t)).toBe('string');
      for (const invalid of ['nav.insights', {}, undefined, '']) expect(insightsNavigationLabel(language, () => invalid)).toBe(insightsNavigationLabel(language, i18n.t));
    }
  });
});