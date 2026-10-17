import { describe, it, expect } from 'vitest';
import { featureOn } from './feature-flags';
describe('launch mode flags', () => {
  it('hides a parked feature from non-admins when off or missing', () => {
    expect(featureOn({ feature_learn: { enabled: false } }, 'feature_learn', false)).toBe(false);
    expect(featureOn({}, 'feature_team_map', false)).toBe(false);
  });
  it('shows it to everyone when switched on', () => { expect(featureOn({ feature_learn: { enabled: true } }, 'feature_learn', false)).toBe(true); });
  it('admins always see parked features', () => { expect(featureOn({ feature_network: { enabled: false } }, 'feature_network', true)).toBe(true); });
});
