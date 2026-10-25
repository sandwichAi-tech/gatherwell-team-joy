import { COVER_STYLES } from '@/lib/gatherings';
import logoAsset from '@/assets/logos/ZoheeWell_Logo_Warm_Ivory_3000px.png.asset.json';
import { coverCrop, displayShareUrl, fitLines, shareLayout, type ShareFormat } from './share-image-layout';
export const loadShareImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
type Options={title:string;date:string;place:string;link:string;cover:HTMLImageElement|null;coverStyle:number|null;brand:string;focal?:string;host?:string};
/** One bitmap supplies preview, download and native file sharing. */
export async function renderShareImage(format:ShareFormat,o:Options):Promise<Blob|null>{
 await document.fonts.ready;await document.fonts.load('700 64px "Noto Sans"');
 const l=shareLayout(format),c=document.createElement('canvas');c.width=l.width;c.height=l.height;const g=c.getContext('2d');if(!g)return null;
 const style=getComputedStyle(document.documentElement),plum=style.getPropertyValue('--share-plum').trim()||'#302338',ivory=style.getPropertyValue('--share-ivory').trim()||'#F8F5F0',concrete=style.getPropertyValue('--share-concrete').trim()||'#D8D0C6';
 g.fillStyle=plum;g.fillRect(0,0,l.width,l.height);
 g.save();g.beginPath();g.rect(0,0,l.photoWidth,l.photoHeight);g.clip();
 if(o.cover){const r=coverCrop(o.cover.naturalWidth,o.cover.naturalHeight,l.photoWidth,l.photoHeight,o.focal);g.drawImage(o.cover,r.sx,r.sy,r.sw,r.sh,0,0,l.photoWidth,l.photoHeight);}
 else{const colors=(COVER_STYLES[(o.coverStyle??0)%COVER_STYLES.length]??'').match(/#[0-9a-f]{6}/gi)??[plum,concrete];const bg=g.createLinearGradient(0,0,l.photoWidth,l.photoHeight);colors.forEach((col,i)=>bg.addColorStop(i/Math.max(1,colors.length-1),col));g.fillStyle=bg;g.fillRect(0,0,l.photoWidth,l.photoHeight);}
 g.restore();
 const wide=format==='wide',fade=wide?g.createLinearGradient(360,0,l.photoWidth,0):g.createLinearGradient(0,l.photoHeight*.35,0,l.photoHeight);
 const rgb=plum.match(/[a-f\d]{2}/gi)?.map(x=>parseInt(x,16)).join(',')??'48,35,56';
 [[0,0],[.35,.28],[.7,.85],[1,1]].forEach(([p,a])=>fade.addColorStop(p,`rgba(${rgb},${a})`));g.fillStyle=fade;g.fillRect(0,0,l.photoWidth,l.photoHeight);
 const font=(size:number,weight=600)=>`${weight} ${size}px "Noto Sans", sans-serif`;
 let y=l.textTop;g.textBaseline='top';
 const logo=await loadShareImage(logoAsset.url).catch(()=>null);if(logo){const w=wide?195:240;g.drawImage(logo,l.textX,y,w,w*logo.naturalHeight/logo.naturalWidth);}y+=wide?64:70;
 let size=l.titleSize;let lines:string[]=[];for(;size>=32;size-=2){g.font=font(size,700);lines=fitLines(o.title,l.textWidth,3,s=>g.measureText(s).width);if(lines.length*size*1.16<=l.titleHeight)break;}
 g.fillStyle=ivory;lines.forEach((line,i)=>g.fillText(line,l.textX,y+i*size*1.16));y+=l.titleHeight+12;
 const remaining=l.footerTop-y-24;const fields=[o.date,o.place,o.host].filter(Boolean);const lineHeight=l.dateSize*1.35;
 g.font=font(l.dateSize,500);g.fillStyle=concrete;for(const field of fields){const count=Math.min(2,Math.floor((l.footerTop-24-y)/lineHeight));if(count<=0)break;for(const line of fitLines(field,l.textWidth,count,s=>g.measureText(s).width)){g.fillText(line,l.textX,y);y+=lineHeight;}y+=8;}
 g.font=font(wide?22:26);g.fillStyle=ivory;const url=displayShareUrl(o.link);const shown=g.measureText(url).width<=l.textWidth?url:'zoheewell.com';g.fillText(shown,l.textX,l.footerTop);
 return new Promise(resolve=>c.toBlob(resolve,'image/png'));
}
