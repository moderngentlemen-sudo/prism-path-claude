import {type Board,type Light,DX,DY,opposite} from './optics.ts';
import {FREE_CHAPTERS} from './content.ts';

// The shape of a solved route, kept so the sky can draw each constellation from it.
export type Route={w:number;h:number;cells:number[]};
export type Save={v:3;stars:Record<string,number>;perfect:Record<string,1>;routes:Record<string,Route>;last:number;story:number[]};
export const blankSave=():Save=>({v:3,stars:{},perfect:{},routes:{},last:0,story:[]});
const keyOk=(k:string)=>/^(?:[1-9]|[1-8][0-9]|90)$/.test(k)||/^daily-\d{4}-\d{2}-\d{2}$/.test(k);
// Version 2 stars carry over by puzzle number, so constellations and unlocks are kept.
export function restoreSave(v3:unknown,v2:unknown):Save{
 const out=blankSave();
 const src=(v3&&typeof v3==='object'&&(v3 as {v?:unknown}).v===3?v3:v2) as {stars?:unknown;perfect?:unknown;routes?:unknown;last?:unknown;story?:unknown}|null;
 if(!src||typeof src!=='object')return out;
 if(src.stars&&typeof src.stars==='object')for(const [k,v] of Object.entries(src.stars))if(keyOk(k)&&Number.isInteger(v)&&(v as number)>=1&&(v as number)<=3)out.stars[k]=v as number;
 if(src.perfect&&typeof src.perfect==='object')for(const k of Object.keys(src.perfect))if(keyOk(k))out.perfect[k]=1;
 if(src.routes&&typeof src.routes==='object')for(const [k,r] of Object.entries(src.routes as Record<string,Route>))if(keyOk(k)&&r&&Number.isInteger(r.w)&&Number.isInteger(r.h)&&Array.isArray(r.cells)&&r.cells.length<=64&&r.cells.every(c=>Number.isInteger(c)&&c>=0&&c<r.w*r.h))out.routes[k]={w:r.w,h:r.h,cells:r.cells};
 if(Number.isInteger(src.last))out.last=Math.max(0,Math.min(89,src.last as number));
 if(Array.isArray(src.story))out.story=[...new Set((src.story as unknown[]).filter((c):c is number=>Number.isInteger(c)&&(c as number)>=0&&(c as number)<9))];
 return out;
}
export const solved=(stars:Record<string,number>,index:number)=>(stars[String(index+1)]??0)>0;
export const chapterOpen=(chapter:number,fullSky:boolean)=>chapter<FREE_CHAPTERS||fullSky;
// Puzzles open one after another; Full Sky opens the six later constellations.
export function canPlay(index:number,stars:Record<string,number>,fullSky:boolean){
 if(index<0||index>89||!chapterOpen(Math.floor(index/10),fullSky))return false;
 return index===0||solved(stars,index)||solved(stars,index-1);
}
export function nextPlayable(stars:Record<string,number>,fullSky:boolean,from=0){
 for(let i=from;i<90;i++)if(canPlay(i,stars,fullSky)&&!solved(stars,i))return i;
 for(let i=0;i<90;i++)if(canPlay(i,stars,fullSky)&&!solved(stars,i))return i;
 return -1;
}
export const solvedCount=(stars:Record<string,number>)=>Object.keys(stars).filter(k=>/^\d+$/.test(k)).length;
export const starTotal=(stars:Record<string,number>)=>Object.entries(stars).filter(([k])=>/^\d+$/.test(k)).reduce((s,[,v])=>s+v,0);
// The lit path from the first inlet to the first outlet, following light across shared sides.
export function routeOf(b:Board,light:Light):Route|null{
 const start=b.ports.find(p=>!p.out),end=b.ports.find(p=>p.out);if(!start||!end)return null;
 const from=new Map<number,number>([[start.i,-1]]),queue=[start.i];
 for(let k=0;k<queue.length;k++){
  const i=queue[k];if(i===end.i)break;
  for(let s=0;s<4;s++){
   if(!light.side[i*4+s])continue;
   const x=i%b.w+DX[s],y=Math.floor(i/b.w)+DY[s];if(x<0||y<0||x>=b.w||y>=b.h)continue;
   const j=y*b.w+x;if(from.has(j)||!light.side[j*4+opposite(s)])continue;from.set(j,i);queue.push(j);
  }
 }
 if(!from.has(end.i))return null;
 const cells:number[]=[];for(let at=end.i;at>=0;at=from.get(at)!)cells.unshift(at);
 return {w:b.w,h:b.h,cells:cells.slice(0,64)};
}
