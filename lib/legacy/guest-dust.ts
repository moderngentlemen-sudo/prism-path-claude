import {streaks} from './streaks.ts';
import {dustForStreak} from './currency.ts';
import type {Action} from './ranked.ts';
export type DustGrant={reason:string;amount:number};
export type GuestReceipt={id:string;key:string;day:string;actions:Action[];elapsed:number;calm:boolean;target:boolean;grants:DustGrant[];owner?:string;synced?:boolean};
export type DustHistory={key:string;day:string;target:boolean};
export function guestGrants(event:DustHistory,history:DustHistory[]):DustGrant[]{
 const grants:DustGrant[]=[];
 if(!history.some(r=>r.key===event.key))grants.push({reason:'puzzle:'+event.key,amount:10});
 if(event.target&&!history.some(r=>r.key===event.key&&r.target))grants.push({reason:'target:'+event.key,amount:5});
 const previous=streaks(history.map(r=>r.day),event.day),next=streaks([...history.map(r=>r.day),event.day],event.day);
 next.forEach((s,i)=>{if(!previous[i].active)grants.push({reason:`streak:${s.kind}:${s.period}`,amount:dustForStreak(s.kind,s.count)});});
 if(/^\d+$/.test(event.key)){const group=Math.floor((Number(event.key)-1)/10),keys=Array.from({length:10},(_,i)=>String(group*10+i+1));
  if(!keys.every(k=>history.some(r=>r.key===k))&&keys.every(k=>k===event.key||history.some(r=>r.key===k)))grants.push({reason:'constellation:'+group,amount:25});
 }
 return grants;
}
export const guestClaimSql='INSERT OR IGNORE INTO guest_claims(id,uid,puzzle,day,target) VALUES(?,?,?,?,?)';
export const guestCreditSql='INSERT OR IGNORE INTO wallet_entries(uid,reason,amount) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM guest_claims WHERE id=? AND uid=?)';
export function pendingDust(receipts:GuestReceipt[],accountId?:string){
 const collected=new Set(receipts.filter(r=>r.synced).flatMap(r=>r.grants.map(g=>g.reason))),pending=new Map<string,number>();
 for(const r of receipts)if(!r.synced&&(!r.owner||r.owner===accountId))for(const g of r.grants)if(!collected.has(g.reason)&&Number.isSafeInteger(g.amount)&&g.amount>0)pending.set(g.reason,g.amount);
 return [...pending.values()].reduce((a,b)=>a+b,0);
}
export function mergeReceipts(local:GuestReceipt[],stored:GuestReceipt[]){
 const map=new Map(stored.map(r=>[r.id,r]));
 for(const r of local){const prior=map.get(r.id);map.set(r.id,{...r,owner:prior?.owner||r.owner,synced:prior?.synced||r.synced});}
 return [...map.values()];
}
