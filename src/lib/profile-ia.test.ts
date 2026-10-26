import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { inviteLanding, legacyCategories, mePanelFromSearch, normalizeCategories, PROFILE_FIELDS, teamEditIssues, toggleCategory, MAX_HOST_CATEGORIES } from '@/lib/profile-ia';
import { safeReturnPath } from '@/lib/return-to';

describe('row 66 invite routing', () => {
  it('signed-out visitors get sign-up with a safe return to discover', () => expect(inviteLanding('ABC123', false)).toEqual({ valid: true, primary: '/discover', signup: { to: '/login', search: { next: '/discover' } } }));
  it('signed-in visitors are not sent to sign-up', () => expect(inviteLanding('ABC123', true).signup).toBeNull());
  it('malformed codes are marked invalid but still offer browsing', () => { const r = inviteLanding('<script>', false); expect(r.valid).toBe(false); expect(r.primary).toBe('/discover'); });
  it('return path is on the safe allowlist', () => expect(safeReturnPath('/discover')).toBe('/discover'));
  it('open redirects are refused', () => { expect(safeReturnPath('//evil.com')).toBeNull(); expect(safeReturnPath('https://evil.com')).toBeNull(); });
});

describe('row 67 multiple categories', () => {
  it('keeps several allowed categories in order', () => expect(normalizeCategories(['yoga', 'hike', 'pilates'])).toEqual(['yoga', 'hike', 'pilates']));
  it('removes duplicates and maps legacy labels', () => expect(normalizeCategories(['Yoga', 'yoga', 'Sound bath', 'Hiking'])).toEqual(['yoga', 'soundbath', 'hike']));
  it('drops arbitrary values', () => expect(normalizeCategories(['shake', 'yoga', ''])).toEqual(['yoga']));
  it('reports legacy values that will be dropped', () => expect(legacyCategories(['shake', 'Yoga'])).toEqual(['shake']));
  it('legacy single category stays selected', () => expect(normalizeCategories(['Pickleball'])).toEqual(['pickleball']));
  it('toggle adds and removes', () => { expect(toggleCategory(['yoga'], 'hike')).toEqual(['yoga', 'hike']); expect(toggleCategory(['yoga', 'hike'], 'yoga')).toEqual(['hike']); });
  it(`caps at ${MAX_HOST_CATEGORIES}`, () => { const full = normalizeCategories(['run', 'fitcamp', 'yoga', 'pilates', 'soundbath', 'hike', 'walk', 'pickleball']); expect(toggleCategory(full, 'more')).toEqual(full); });
  it('every category has EN and ES labels', () => { for (const c of ['run', 'fitcamp', 'yoga', 'pilates', 'soundbath', 'hike', 'walk', 'pickleball', 'more']) { expect((en.landing.cat as Record<string, string>)[c]).toBeTruthy(); expect((es.landing.cat as Record<string, string>)[c]).toBeTruthy(); } });
});

describe('row 68 canonical profile editors', () => {
  it('no field is edited in two places', () => expect(PROFILE_FIELDS.account.filter(f => (PROFILE_FIELDS.publicPage as readonly string[]).includes(f))).toEqual([]));
  it('categories belong to the public-page editor', () => expect(PROFILE_FIELDS.publicPage).toContain('host_categories'));
  it('Me deep links accept only known panels', () => { expect(mePanelFromSearch('hostProfile')).toBe('hostProfile'); expect(mePanelFromSearch('edit')).toBe('edit'); expect(mePanelFromSearch('admin')).toBeUndefined(); });
});

describe('row 69 team editing validation', () => {
  it('accepts a normal name and description', () => expect(teamEditIssues('Sunrise Run Club', 'We meet Saturdays.')).toEqual([]));
  it('rejects short or long names', () => { expect(teamEditIssues('A', '')).toEqual(['name']); expect(teamEditIssues('x'.repeat(81), '')).toEqual(['name']); });
  it('rejects descriptions over 500 characters', () => expect(teamEditIssues('Team', 'x'.repeat(501))).toEqual(['description']));
});

describe('EN/ES copy', () => {
  it('new keys exist in both languages', () => {
    for (const k of Object.keys(en.welcome.landing)) expect((es.welcome.landing as Record<string, string>)[k]).toBeTruthy();
    for (const k of ['description', 'descriptionTooLong', 'nameInvalid', 'coverUploadFailed'] as const) expect(es.teamSpace[k]).toBeTruthy();
    for (const k of ['identityNote', 'categoriesPick', 'categoriesLegacy', 'categoriesMax'] as const) expect(es.hostProfile[k]).toBeTruthy();
    expect(es.profile.editHelp).toBeTruthy();
  });
  it('invite copy never mentions rewards or commissions', () => { expect(en.welcome.landing.body).not.toMatch(/earn|commission|\$/i); });
});

import { buildToolSections as __bts } from '@/lib/tools-inventory';
describe('Tools public profile shortcut', () => {
  it('opens the public host profile editor directly', () => {
    const tools = __bts({ isLeader: true, workspaceRole: 'owner', isAdmin: false, learnOn: true, teamMapOn: false, canSellPaid: false }).flatMap(s => s.tools);
    const hp = tools.find(t => t.id === 'hostProfile');
    expect(hp?.to).toBe('/me');
    expect(hp?.search).toEqual({ panel: 'hostProfile' });
  });
});

describe('Cover upload error copy', () => {
  it('has matched EN/ES messages for a non-image file', () => {
    expect((en as any).profile.photoNotImage).toMatch(/image/i);
    expect((es as any).profile.photoNotImage).toMatch(/imagen/i);
  });
});
