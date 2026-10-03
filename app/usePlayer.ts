'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {grantsFor,pendingDust,mergeReceipts,type Receipt,type Grant,type Clear} from '@/lib/rewards';
import type {Action} from '@/lib/run';

export type Standing={name:string;stars?:number;radiant?:number;turns?:number;hints?:number;score?:number;boards?:number};
export type PlayerData={signedIn:boolean;provider?:string;accountId?:string;profile:{name:string;listed:number;code:string|null}|null;
 stars:Standing[];daily:Standing[];pulse:Standing[];community:number;week:number;wallet?:number;owned?:string[];
 scores?:{puzzle:string;stars:number;radiant:number;perfect:number;moves:number}[];stats?:{completions:number;turns:number;hints:number};
 streak?:{count:number;active:boolean;frozen:string[];freezeReady:boolean};friends?:{name:string;code:string;today:{turns:number;hints:number}|null}[]};
type LegacyReceipt={id:string;key:string;day:string;grants:Grant[];owner?:string;synced?:boolean;v?:undefined};
type AnyReceipt=Receipt|LegacyReceipt;
const RECEIPTS='prism-guest-dust-v1';
const valid=(r:unknown):r is AnyReceipt=>!!r&&typeof (r as AnyReceipt).id==='string'&&typeof (r as AnyReceipt).key==='string'&&Array.isArray((r as AnyReceipt).grants);
const clears=(rs:AnyReceipt[]):Clear[]=>rs.map(r=>({key:r.key,stars:r.v===3?r.stars:1}));

export function usePlayer(){
 const [data,setData]=useState<PlayerData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(0);
 const [localDust,setLocalDust]=useState(0),[notice,setNotice]=useState<{id:string;amount:number;label:string}|null>(null);
 const current=useRef<PlayerData|null>(null),queue=useRef<object[]>([]),queueKey=useRef(''),sending=useRef(false),receipts=useRef<AnyReceipt[]>([]);
 const readLocal=()=>{try{const stored=JSON.parse(localStorage.getItem(RECEIPTS)||'[]');if(Array.isArray(stored))receipts.current=mergeReceipts(receipts.current,stored.filter(valid));}catch{}};
 const writeLocal=()=>{readLocal();setLocalDust(pendingDust(receipts.current,current.current?.accountId));try{localStorage.setItem(RECEIPTS,JSON.stringify(receipts.current));}catch{setError('Stardust could not be saved in this browser. Keep this page open and connect an account.');}};
 const dust=(amount:number,label='Stardust earned')=>{if(amount>0)setNotice({id:crypto.randomUUID(),amount,label});};
 const persistQueue=()=>{setPending(queue.current.length);try{if(queueKey.current)localStorage.setItem(queueKey.current,JSON.stringify(queue.current));}catch{setError('Pending results cannot be saved on this device. Keep this page open and retry.');}};
 const request=async(method='GET',body?:object)=>{
  setBusy(true);setError('');
  try{
   const res=await fetch('/api/players',body?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{method});
   const out:PlayerData&{error?:string}=await res.json();if(!res.ok)throw Error(out.error||'Player service unavailable');
   current.current=out;setData(out);
   if(out.accountId&&queueKey.current!=='prism-pending-'+out.accountId){queueKey.current='prism-pending-'+out.accountId;try{const saved=JSON.parse(localStorage.getItem(queueKey.current)||'[]');queue.current=Array.isArray(saved)?saved:[];}catch{queue.current=[];}setPending(queue.current.length);}
   return out;
  }catch(e){setError(e instanceof Error?e.message:'Player service unavailable');return null;}finally{setBusy(false);}
 };
 const flush=async()=>{
  if(sending.current||!current.current?.signedIn||!current.current.accountId)return false;sending.current=true;
  try{
   const uid=current.current.accountId;
   for(const r of receipts.current.filter(r=>!r.synced&&(!r.owner||r.owner===uid))){
    r.owner=uid;writeLocal();const before=current.current?.wallet||0;
    const out=await request('POST',{action:'guest',accountId:uid,receipt:r});if(!out||out.accountId!==uid)return false;
    const local=receipts.current.find(x=>x.id===r.id);if(local)local.synced=true;writeLocal();dust((out.wallet||0)-before,'Stardust synced');
   }
   while(current.current?.profile&&queue.current.length){
    const before=current.current.wallet||0,out=await request('POST',queue.current[0]);if(!out)return false;
    queue.current.shift();persistQueue();dust((out.wallet||0)-before);
   }
   return true;
  }finally{sending.current=false;}
 };
 const clearNotice=useCallback(()=>setNotice(null),[]);
 const startUp=useRef(false);
 useEffect(()=>{if(startUp.current)return;startUp.current=true;readLocal();writeLocal();void request();});
 const signedKey=`${data?.accountId}:${!!data?.profile}`,lastKey=useRef('');
 useEffect(()=>{if(lastKey.current===signedKey)return;lastKey.current=signedKey;writeLocal();if(data?.signedIn)void flush();});
 // A finished or improved puzzle: account results queue for the server; guests keep a verifiable receipt.
 const finish=async(key:string,actions:Action[],stars:number)=>{
  if(current.current?.profile){queue.current.push({action:'finish',v:3,accountId:current.current.accountId,id:crypto.randomUUID(),key,actions});persistQueue();return flush();}
  readLocal();const before=pendingDust(receipts.current,current.current?.accountId);
  const grants=grantsFor({key,stars},clears(receipts.current));
  if(grants.length){receipts.current.push({v:3,id:crypto.randomUUID(),key,day:new Date().toISOString().slice(0,10),actions,stars,grants});writeLocal();dust(Math.max(0,pendingDust(receipts.current,current.current?.accountId)-before));}
  if(current.current?.signedIn)void flush();
  return true;
 };
 return {data,error,busy,pending,localDust,notice,clearNotice,finish,refresh:()=>request(),retry:()=>current.current?.signedIn?flush():request(),
  saveProfile:(name:string,listed:boolean)=>request('POST',{action:'profile',name,listed}),redeem:(product:string)=>request('POST',{action:'redeem',product}),
  friend:(code:string,add=true)=>request('POST',{action:add?'friend':'unfriend',code}),
  pulse:(week:number,boards:Action[][],seconds:number)=>request('POST',{action:'pulse',id:crypto.randomUUID(),week,boards,seconds}),
  discardOldest:()=>{if(!sending.current){queue.current.shift();persistQueue();setError('');}},
  reset:async()=>{if(sending.current)return false;const ok=await request('DELETE');if(ok){queue.current=[];persistQueue();}return !!ok;}};
}
export type Player=ReturnType<typeof usePlayer>;
