import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

describe('Website Notes translation value contracts', () => {
  it.each(['en', 'es'])('resolves network and resource button keys to nonempty strings in %s', async lng => {
    const instance = createInstance();
    await instance.init({ lng, fallbackLng: 'en', resources: { en: { translation: en }, es: { translation: es } } });
    for (const key of ['home.networkLabel', 'home.networkTitle', 'home.networkText', 'home.networkAction', 'resources.create.button']) {
      expect(instance.exists(key)).toBe(true);
      const value = instance.t(key);
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
      expect(value).not.toContain('returned an object');
    }
    expect(typeof instance.getResource(lng, 'translation', 'resources.create')).toBe('object');
    expect(typeof instance.t('resources.create.types.video.name')).toBe('string');
  });
});