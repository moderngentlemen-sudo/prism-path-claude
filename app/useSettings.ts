'use client';
import {useSyncExternalStore} from 'react';
import type {InstrumentId} from '@/lib/music';
export type Settings={effects:boolean;music:boolean;volume:number;instrument:InstrumentId;track:string;haptics:boolean;still:boolean;colours:'standard'|'contrast';patterns:boolean;stats:boolean;theme:'mint'|'sunset'|'aurora'};
const KEY='prism-settings-v3';
export const defaults:Settings={effects:true,music:true,volume:.35,instrument:'piano',track:'quiet-orbit',haptics:true,still:false,colours:'standard',patterns:false,stats:true,theme:'mint'};
function restore(raw:unknown):Settings{
 const v=(raw&&typeof raw==='object'?raw:{}) as Partial<Settings>,s={...defaults};
 for(const k of ['effects','music','haptics','still','patterns','stats'] as const)if(typeof v[k]==='boolean')s[k]=v[k];
 if(typeof v.volume==='number'&&v.volume>=0&&v.volume<=1)s.volume=v.volume;
 if(['piano','sfx','kalimba','glass'].includes(v.instrument as string))s.instrument=v.instrument!;
 if(typeof v.track==='string'&&/^[a-z-]{2,20}$/.test(v.track))s.track=v.track;
 if(v.colours==='contrast')s.colours='contrast';
 if(v.theme==='sunset'||v.theme==='aurora')s.theme=v.theme;
 return s;
}
// Settings live in localStorage and are shared by every component (and every open tab).
let cache:Settings|null=null;
const listeners=new Set<()=>void>();
function read(){
 if(cache)return cache;
 let s=defaults;
 try{
  const stored=localStorage.getItem(KEY);s=restore(JSON.parse(stored||'null'));
  if(!stored){
   // Earlier preferences carry over: music on/off, volume and calm motion; otherwise follow the system.
   if(localStorage.getItem('prism-music-enabled')==='false')s={...s,music:false};
   const v=Number(localStorage.getItem('prism-volume-v2'));if(localStorage.getItem('prism-volume-v2')!==null&&v>=0&&v<=1)s={...s,volume:v};
   if(localStorage.getItem('prism-relax-still')==='true'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)s={...s,still:true};
  }
 }catch{}
 cache=s;return s;
}
function subscribe(changed:()=>void){
 const storage=(e:StorageEvent)=>{if(e.key===KEY){cache=null;changed();}};
 listeners.add(changed);window.addEventListener('storage',storage);
 return()=>{listeners.delete(changed);window.removeEventListener('storage',storage);};
}
function update(patch:Partial<Settings>){
 cache={...read(),...patch};try{localStorage.setItem(KEY,JSON.stringify(cache));}catch{}
 for(const l of listeners)l();
}
export function useSettings(){
 const settings=useSyncExternalStore(subscribe,read,()=>defaults);
 return {settings,update};
}
