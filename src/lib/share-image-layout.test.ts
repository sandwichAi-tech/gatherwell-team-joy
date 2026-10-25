import { describe,expect,it } from 'vitest';
import { coverCrop,displayShareUrl,fitLines,shareLayout,SHARE_SIZES } from './share-image-layout';
describe('Event share canvas safe areas',()=>{
 it.each(['square','story','wide'] as const)('reserves nonoverlapping title, details and footer in %s',format=>{
  const l=shareLayout(format);expect([l.width,l.height]).toEqual(SHARE_SIZES[format]);
  expect(l.textTop+70+l.titleHeight+12+l.dateSize*1.35*2+24).toBeLessThan(l.footerTop);
  expect(l.textX+l.textWidth).toBe(l.width-l.margin);expect(l.footerTop+32).toBeLessThan(l.height);
 });
 it('never exposes preview hostnames or token queries',()=>{
  expect(displayShareUrl('https://id-preview--example.lovable.app/e/123?k=secret')).toBe('zoheewell.com/e/123');
  expect(displayShareUrl('https://localhost:8080/anything')).toBe('zoheewell.com');
 });
 it('wraps long words and clamps every line within its measured width',()=>{
  const lines=fitLines('An extraordinarilylongunbrokenword event with many more words',100,3,s=>s.length*10);
  expect(lines.length).toBe(3);expect(lines.at(-1)?.endsWith('…')).toBe(true);lines.forEach(l=>expect(l.length*10).toBeLessThanOrEqual(100));
 });
 it('fills each crop and honors a right-side subject without source overflow',()=>{
  const crop=coverCrop(2000,1000,1000,1000,'100% 50%');expect(crop).toEqual({sx:1000,sy:0,sw:1000,sh:1000});
 });
});