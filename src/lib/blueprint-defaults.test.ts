import { describe, expect, it } from 'vitest';
import { blueprintDefaults, blueprintFromEvent, canEditBlueprint } from './blueprint-defaults';
import type { Template } from './templates';
import type { Gathering } from './gatherings';
const blueprint = { title: 'Walking club', category: 'walk', category_label: null, description_en: 'Walk together', description_es: 'Caminemos', default_duration_minutes: 45, default_capacity: 20, default_mode: 'online', default_price_cents: 1500, visibility_default: 'public', cover_url: 'owner/cover.webp', cover_style: 2 } as Template;
const event = { title: 'Another walk', category: 'walk', category_label: null, description_en: 'A friendly walk', description_es: null, starts_at: '2026-11-01T10:00:00Z', ends_at: '2026-11-01T10:45:00Z', capacity: 20, online_url: 'https://example.com/room', price_cents: 1500, visibility: 'public', cover_url: 'owner/cover.webp', cover_style: 2 } as Gathering;
describe('Event Blueprints', () => {
 it('prefills title, type, description, length, capacity, mode, price and cover without date or place', () => {
  expect(blueprintDefaults(blueprint)).toEqual({ title:'Walking club',category:'walk',categoryLabel:'',descriptionEn:'Walk together',descriptionEs:'Caminemos',duration:45,capacity:20,mode:'online',priceCents:1500,visibility:'public',cover:'owner/cover.webp',coverStyle:2 });
  expect(blueprintDefaults(blueprint)).not.toHaveProperty('starts_at');
 });
 it('saves an event as a blueprint with reusable defaults rather than its date and room', () => {
  expect(blueprintFromEvent(event)).toMatchObject({ title:'Another walk',category:'walk',default_duration_minutes:45,default_capacity:20,default_mode:'online',default_price_cents:1500,cover_url:'owner/cover.webp',is_published:true });
  expect(blueprintFromEvent(event)).not.toHaveProperty('online_url');
 });
 it('keeps team-only event blueprints free', () => {
  expect(blueprintDefaults({...blueprint,visibility_default:'team'}).priceCents).toBe(0);
  expect(blueprintFromEvent({...event,visibility:'team'}).default_price_cents).toBe(0);
 });
 it('allows hosts to edit their own blueprints, not another hosts blueprint', () => {
  expect(canEditBlueprint({team_id:'team',created_by:'host'},'host',[])).toBe(true);
  expect(canEditBlueprint({team_id:'team',created_by:'other'},'host',[])).toBe(false);
  expect(canEditBlueprint({team_id:null,created_by:null},'host',[])).toBe(false);
 });
});
