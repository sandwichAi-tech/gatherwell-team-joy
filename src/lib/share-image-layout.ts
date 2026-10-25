export type ShareFormat = 'square' | 'story' | 'wide';
export const SHARE_SIZES: Record<ShareFormat, readonly [number, number]> = { square: [1080, 1080], story: [1080, 1920], wide: [1200, 675] };
export function shareLayout(format: ShareFormat) {
 const [width,height]=SHARE_SIZES[format]; const wide=format==='wide';
 const margin=wide?48:72; const textX=wide?600:margin; const textTop=wide?96:format==='story'?1120:500;
 return {width,height,margin,textX,textTop,textWidth:width-textX-margin,footerTop:height-margin-40,titleSize:wide?52:format==='story'?80:62,titleHeight:wide?205:format==='story'?290:190,dateSize:wide?25:32,photoWidth:wide?780:width,photoHeight:wide?height:format==='story'?1320:720};
}
export function coverCrop(iw:number,ih:number,w:number,h:number,focal='50% 50%') {
 const parts=focal.split(' ').map(x=>{const n=parseFloat(x);return Math.min(1,Math.max(0,(Number.isFinite(n)?n:50)/100));});
 const scale=Math.max(w/iw,h/ih);const sw=w/scale,sh=h/scale;
 return {sx:Math.max(0,Math.min(iw-sw,iw*(parts[0]??.5)-sw/2)),sy:Math.max(0,Math.min(ih-sh,ih*(parts[1]??.5)-sh/2)),sw,sh};
}
export function displayShareUrl(link:string) {
 try { const url=new URL(link); return /^\/(e|o|h)\/[^/]+$/.test(url.pathname) ? `zoheewell.com${url.pathname}` : 'zoheewell.com'; } catch {return 'zoheewell.com';}
}
/** Word and character wrapping with an explicit ellipsis inside the measured width. */
export function fitLines(text:string,maxWidth:number,maxLines:number,measure:(s:string)=>number) {
 const lines:string[]=[];let current='';
 for(const word of text.trim().split(/\s+/)) {
  if(measure(current?`${current} ${word}`:word)<=maxWidth){current=current?`${current} ${word}`:word;continue;}
  if(current){lines.push(current);current='';}
  for(const char of word){if(measure(current+char)>maxWidth&&current){lines.push(current);current='';}current+=char;}
 }
 if(current)lines.push(current);
 if(lines.length>maxLines){lines.length=maxLines;let last=lines[maxLines-1]??'';while(last&&measure(last+'…')>maxWidth)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}
 return lines;
}
