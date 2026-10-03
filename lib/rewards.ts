import {chainTo} from './streaks.ts';
import type {Action} from './run.ts';

// Stardust is the only currency, and it buys cosmetics only. Steady rates:
// 10 for a first clear, 5 for a first radiant board, 25 for a constellation,
// and 25 on every seventh day of a daily streak.
export const unlocks=[
 {id:'sfx',name:'Crystal chimes',kind:'instrument',cost:100,description:'Bell tones for the melody your light plays.'},
 {id:'kalimba',name:'Kalimba',kind:'instrument',cost:150,description:'Warm plucked notes for every connection.'},
 {id:'music',name:'Night music',kind:'music',cost:200,description:'Two more background tracks: Moonrise and Drift.'},
 {id:'glass',name:'Bowed glass',kind:'instrument',cost:200,description:'A slow, singing glass tone for each lit tile.'},
] as const;
export type UnlockId=typeof unlocks[number]['id'];
// Palettes are chapter rewards. Earlier purchases stay owned.
export const palettes=[
 {id:'mint',name:'First light',color:'#c5f17c',chapter:-1},
 {id:'sunset',name:'Sunset',color:'#ffbc7d',chapter:2},
 {id:'aurora',name:'Aurora',color:'#b8a1ff',chapter:8},
] as const;
export function unlockProgress(cost:number,wallet:number,pending:number){
 const safe=(n:number)=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
 const credited=safe(wallet),waiting=safe(pending),earned=credited+waiting;
 return {earned,progress:Math.min(cost,earned),remaining:Math.max(0,cost-earned),affordable:credited>=cost,needsSync:credited<cost&&earned>=cost};
}

export type Clear={key:string;stars:number};
export type Grant={reason:string;amount:number};
const dailyDate=(key:string)=>/^daily-(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1];
export function grantsFor(event:Clear,history:Clear[]):Grant[]{
 const grants:Grant[]=[],before=history.filter(h=>h.key===event.key);
 if(event.stars<1)return grants;
 if(!before.some(h=>h.stars>=1))grants.push({reason:'puzzle:'+event.key,amount:10});
 if(event.stars>=3&&!before.some(h=>h.stars>=3))grants.push({reason:'radiant:'+event.key,amount:5});
 if(/^\d+$/.test(event.key)){
  const chapter=Math.floor((Number(event.key)-1)/10),keys=Array.from({length:10},(_,i)=>String(chapter*10+i+1));
  const solved=(k:string)=>history.some(h=>h.key===k&&h.stars>=1);
  if(!keys.every(solved)&&keys.every(k=>k===event.key||solved(k)))grants.push({reason:'constellation:'+chapter,amount:25});
 }
 const date=dailyDate(event.key);
 if(date&&!before.some(h=>h.stars>=1)){
  const days=history.flatMap(h=>h.stars>=1&&dailyDate(h.key)?[dailyDate(h.key)!]:[]);
  const {count}=chainTo([...days,date],date);
  if(count>0&&count%7===0)grants.push({reason:'streak:'+date,amount:25});
 }
 return grants;
}
export const constellationDone=(stars:Record<string,number>,chapter:number)=>Array.from({length:10},(_,i)=>stars[String(chapter*10+i+1)]>0).every(Boolean);

// Guest receipts keep the replayable history so an account can verify them later.
export type Receipt={v:3;id:string;key:string;day:string;actions:Action[];stars:number;grants:Grant[];owner?:string;synced?:boolean};
export function pendingDust(receipts:{grants:Grant[];synced?:boolean;owner?:string}[],accountId?:string){
 const collected=new Set(receipts.filter(r=>r.synced).flatMap(r=>r.grants.map(g=>g.reason))),pending=new Map<string,number>();
 for(const r of receipts)if(!r.synced&&(!r.owner||r.owner===accountId))for(const g of r.grants)if(!collected.has(g.reason)&&Number.isSafeInteger(g.amount)&&g.amount>0)pending.set(g.reason,g.amount);
 return [...pending.values()].reduce((a,b)=>a+b,0);
}
export function mergeReceipts<T extends {id:string;owner?:string;synced?:boolean}>(local:T[],stored:T[]){
 const map=new Map(stored.map(r=>[r.id,r]));
 for(const r of local){const prior=map.get(r.id);map.set(r.id,{...r,owner:prior?.owner||r.owner,synced:prior?.synced||r.synced});}
 return [...map.values()];
}
export const walletGrantSql='INSERT OR IGNORE INTO wallet_entries(uid,reason,amount) VALUES(?,?,?)';
export const redemptionSql=`INSERT OR IGNORE INTO wallet_entries(uid,reason,amount)
 SELECT ?,?,? WHERE (SELECT COALESCE(SUM(amount),0) FROM wallet_entries WHERE uid=?)>=?`;
export const guestClaimSql='INSERT OR IGNORE INTO guest_claims(id,uid,puzzle,day,target) VALUES(?,?,?,?,?)';
export const guestCreditSql='INSERT OR IGNORE INTO wallet_entries(uid,reason,amount) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM guest_claims WHERE id=? AND uid=?)';
