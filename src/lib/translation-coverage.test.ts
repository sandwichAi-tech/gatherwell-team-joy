// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import ts from 'typescript';
import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { PLANS, PRO_FEATURES } from '@/lib/billing';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path)
      : /\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [path] : [];
  });
}

function literalKeys(expression: ts.Expression): string[] {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return [expression.text];
  if (ts.isParenthesizedExpression(expression)) return literalKeys(expression.expression);
  if (ts.isConditionalExpression(expression)) return [...literalKeys(expression.whenTrue), ...literalKeys(expression.whenFalse)];
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.flatMap(e => ts.isExpression(e) ? literalKeys(e) : []);
  return [];
}

function callsIn(text: string, file: string) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const calls: { key: string; plural: boolean }[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && (
      ts.isIdentifier(node.expression) && node.expression.text === 't'
      || ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 't'
    )) {
      const first = node.arguments[0];
      const options = node.arguments[1];
      const plural = !!options && ts.isObjectLiteralExpression(options) && options.properties.some(p =>
        p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === 'count');
      if (first) for (const key of literalKeys(first)) calls.push({ key, plural });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return calls;
}

describe('source translation coverage', () => {
  const files = sourceFiles(resolve('src'));
  const calls = files.flatMap(file => callsIn(readFileSync(file, 'utf8'), file).map(call => ({ ...call, file })));
  for (const [language, dictionary] of Object.entries({ en, es })) {
    it(`${language}: every literal t() key exists without language or default-text fallback`, async () => {
      const translator = createInstance();
      await translator.init({ lng: language, fallbackLng: false, resources: { [language]: { translation: dictionary } } });
      const missing = calls.flatMap(({ key, plural, file }) => {
        const counts = plural ? [0, 1, 2] : [undefined];
        return counts.some(count => !translator.exists(key, { count })) ? [`${file}: ${key}`] : [];
      });
      expect(missing).toEqual([]);
    });

    it(`${language}: finite billing, marketing and progress variable keys exist`, async () => {
      const translator = createInstance();
      await translator.init({ lng: language, fallbackLng: false, resources: { [language]: { translation: dictionary } } });
      const keys = [
        ...PLANS.flatMap(plan => [`billing.name_${plan.id}`, `billing.tag_${plan.id}`]),
        ...PRO_FEATURES.map(feature => `billing.pro_${feature}`),
        ...en.marketing.benefits.flatMap((_, index) => ['title', 'body', 'demo'].map(field => `marketing.benefits.${index}.${field}`)),
        ...['attended', 'streak', 'best', 'lessons'].map(key => `progress.stat.${key}`),
        ...['gatherings', 'streak', 'people', 'goals'].map(key => `progress.recap.${key}`),
        ...['distance', 'time', 'reps', 'lifted'].map(key => `progress.kind.${key}`),
        ...['km', 'mi', 'min', 'reps', 'kg', 'lb'].map(key => `progress.unit.${key}`),
      ];
      expect(keys.filter(key => !translator.exists(key))).toEqual([]);
    });
  }

  it('extracts quoted, multiline, member and conditional calls but not comments or concatenated prefixes', () => {
    expect(callsIn(`// t('not.a.key')
      t('progress.add'); i18n.t("common.loading");
      t(on ? 'progress.sharedOn' : 'progress.sharedOff');
      t(\n'progress.checks', { count: 2 }); t('billing.name_' + id);`, 'fixture.ts')).toEqual([
      { key: 'progress.add', plural: false }, { key: 'common.loading', plural: false },
      { key: 'progress.sharedOn', plural: false }, { key: 'progress.sharedOff', plural: false },
      { key: 'progress.checks', plural: true },
    ]);
  });
});