import { describe, expect, it } from 'vitest';
import { directionsUrl } from './guest';
const location = { address: '10 Main Street, Austin', location_name: 'Park', lat: null, lng: null };
describe('attendee directions', () => {
  it('uses the saved address by default', () => {
    expect(directionsUrl(location)).toContain('10%20Main%20Street%2C%20Austin');
  });
  it('uses a valid custom override', () => {
    expect(directionsUrl({ ...location, map_url: 'https://example.com/meeting' })).toBe('https://example.com/meeting');
  });
  it.each(['javascript:alert(1)', 'http://example.com', 'not a URL', 'https://u:p@example.com'])('falls back for unsafe override %s', map_url => {
    expect(directionsUrl({ ...location, map_url })).toContain('10%20Main%20Street%2C%20Austin');
  });
});