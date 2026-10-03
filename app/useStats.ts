'use client';
import {useCallback,useEffect,useRef} from 'react';
import type {StatKind} from '@/lib/analytics';
// Anonymous counters, batched and sent at most every 20 seconds or when the page hides.
const flush=(pending:Map<string,number>)=>{
 if(!pending.size)return;
 const events=[...pending].map(([key,n])=>{const [p,k]=key.split('|');return {p,k,n:Math.min(50,n)};});pending.clear();
 void fetch('/api/events',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(events)}).catch(()=>{});
};
export function useStats(enabled:boolean){
 const pending=useRef(new Map<string,number>()),on=useRef(enabled);
 useEffect(()=>{on.current=enabled;if(!enabled)pending.current.clear();},[enabled]);
 useEffect(()=>{
  const queue=pending.current,send=()=>flush(queue),hide=()=>{if(document.hidden)send();};
  const t=setInterval(send,20000);document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',send);
  return()=>{clearInterval(t);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',send);};
 },[]);
 return useCallback((p:string,k:StatKind,n=1)=>{
  if(!on.current||n<1)return;const key=p+'|'+k,queue=pending.current;queue.set(key,(queue.get(key)||0)+n);if((queue.get(key)||0)>=50)flush(queue);
 },[]);
}
