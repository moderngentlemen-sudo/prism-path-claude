import {getPlayerUser} from '@/app/player-auth';
import {database} from '@/db/client';
import {verifyRun,verifyLegacy} from '@/lib/verify';
import {grantsFor,unlocks,redemptionSql,walletGrantSql,guestClaimSql,guestCreditSql,type Clear} from '@/lib/rewards';
import {dailyStreak} from '@/lib/streaks';
import {finishSql,bestSql,activitySql,pulseSql,starBoardSql,dailyBoardSql,pulseBoardSql,friendsSql,communitySql,rankParts} from '@/lib/sql';
import {verifyPulse,weekOf,PULSE_SECONDS} from '@/lib/pulse';
import {guestGrants as legacyGuestGrants} from '@/lib/legacy/guest-dust';
import {streaks as legacyStreaks} from '@/lib/legacy/streaks';
import {dustForStreak as legacyDust,constellationGrantSql as legacyConstellationSql} from '@/lib/legacy/currency';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const today=()=>new Date().toISOString().slice(0,10);
const campaignKey=/^(?:[1-9]|[1-8][0-9]|90)$/,dailyKey=/^daily-\d{4}-\d{2}-\d{2}$/;
const DAY=86400000;
// Daily results may sync for seven days after their date, never before it.
function dailyOpen(key:string){const date=Date.parse(key.slice(6)+'T00:00:00Z'),age=(Date.parse(today())-date)/DAY;return Number.isFinite(age)&&age>=0&&age<=7&&new Date(date).toISOString().slice(0,10)===key.slice(6);}
const codeAlphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>codeAlphabet[b%codeAlphabet.length]).join('');

async function history(db:D1Database,uid:string):Promise<Clear[]>{
 const [bests,claims]=await Promise.all([
  db.prepare('SELECT puzzle AS key,stars FROM best WHERE uid=?').bind(uid).all<{key:string;stars:number}>(),
  db.prepare('SELECT puzzle AS key,target FROM guest_claims WHERE uid=?').bind(uid).all<{key:string;target:number}>(),
 ]);
 return [...bests.results,...claims.results.map(c=>({key:c.key,stars:c.target?3:1}))];
}
async function snapshot(){
 const user=await getPlayerUser(),db=database(),daily='daily-'+today(),week=weekOf();
 const weekStart=new Date((week*7-3)*DAY).toISOString().slice(0,10);
 const [stars,dailyBoard,pulseBoard,community]=await Promise.all([
  db.prepare(starBoardSql).all(),
  db.prepare(dailyBoardSql).bind(daily).all<{name:string;rank:number;stars:number}>(),
  db.prepare(pulseBoardSql).bind(week).all(),
  db.prepare(communitySql).bind(weekStart).first<{tiles:number}>(),
 ]);
 const boards={stars:stars.results,daily:dailyBoard.results.map(r=>({name:r.name,...rankParts(r.rank),stars:r.stars})),pulse:pulseBoard.results,community:community?.tiles||0,week};
 if(!user)return {signedIn:false,profile:null,...boards};
 const uid=user.userId,profile=await db.prepare('SELECT name,listed,code FROM players WHERE uid=?').bind(uid).first<{name:string;listed:number;code:string|null}>();
 const wallet=await db.prepare('SELECT COALESCE(SUM(amount),0) AS balance FROM wallet_entries WHERE uid=?').bind(uid).first<{balance:number}>();
 const owned=await db.prepare('SELECT reason FROM wallet_entries WHERE uid=? AND amount<0').bind(uid).all<{reason:string}>();
 const base={signedIn:true,provider:user.provider,accountId:uid,wallet:wallet?.balance||0,owned:owned.results.map(r=>r.reason.slice(5)),...boards};
 if(!profile)return {...base,profile:null};
 const [scores,dailies,stats,mates]=await Promise.all([
  db.prepare('SELECT puzzle,stars,radiant,perfect,moves FROM best WHERE uid=?').bind(uid).all(),
  db.prepare(`SELECT DISTINCT substr(puzzle,7) AS day FROM best WHERE uid=? AND puzzle LIKE 'daily-%' AND stars>0`).bind(uid).all<{day:string}>(),
  db.prepare('SELECT COUNT(*) AS completions,COALESCE(SUM(moves),0) AS turns,COALESCE(SUM(hints),0) AS hints FROM finishes WHERE uid=?').bind(uid).first(),
  db.prepare(friendsSql).bind(daily,uid).all<{name:string;code:string;rank:number|null}>(),
 ]);
 return {...base,profile,scores:scores.results,stats,streak:dailyStreak(dailies.results.map(r=>r.day),today()),
  friends:mates.results.map(f=>({name:f.name,code:f.code,today:f.rank===null?null:rankParts(f.rank)}))};
}
export async function GET(){try{return json(await snapshot());}catch(e){console.error('Player data unavailable',e);return json({error:'Player data is temporarily unavailable. Please retry.'},503);}}
function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}

export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'Invalid request origin'},403);
 const user=await getPlayerUser();if(!user)return json({error:'Please sign in.'},401);
 try{
  const raw=await request.text();if(raw.length>150000)return json({error:'History too large'},413);
  const body=JSON.parse(raw),db=database(),uid=user.userId;
  const hasProfile=async()=>!!await db.prepare('SELECT uid FROM players WHERE uid=?').bind(uid).first();
  if(body.action==='profile'){
   if(typeof body.name!=='string'||!/^[\p{L}\p{N} _-]{2,24}$/u.test(body.name.trim())||typeof body.listed!=='boolean')return json({error:'Use 2–24 letters, numbers, spaces, hyphens or underscores.'},400);
   await db.prepare('INSERT INTO players(uid,name,listed) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,listed=excluded.listed').bind(uid,body.name.trim(),body.listed?1:0).run();
   for(let k=0;k<5;k++){try{await db.prepare('UPDATE players SET code=? WHERE uid=? AND code IS NULL').bind(newCode(),uid).run();break;}catch{}}
  }else if(body.action==='finish'){
   if(body.accountId!==uid)return json({error:'This result belongs to a different signed-in account. Sign back in to sync it.'},403);
   if(!await hasProfile())return json({error:'Create your player profile first.'},400);
   if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id)||typeof body.key!=='string')return json({error:'Invalid completion'},400);
   const id=uid+':'+body.id,daily=dailyKey.test(body.key);
   if(await db.prepare('SELECT id FROM finishes WHERE id=?').bind(id).first())return json(await snapshot());
   if(daily?!dailyOpen(body.key):!campaignKey.test(body.key))return json({error:'This puzzle result is no longer eligible. Daily results can sync for seven days after play.'},400);
   if(body.v===3){
    let result;try{result=verifyRun(body.key,body.actions);}catch{return json({error:'The puzzle history could not be verified. Restart this puzzle to record a new attempt.'},400);}
    const grants=grantsFor({key:body.key,stars:result.stars},await history(db,uid));
    await db.batch([
     db.prepare(finishSql).bind(id,uid,body.key,result.stars,result.turns,result.hints,today(),result.radiant?1:0,result.perfect?1:0),
     db.prepare(bestSql).bind(uid,body.key,result.stars,result.turns,result.radiant?1:0,result.perfect?1:0),
     db.prepare(activitySql).bind(uid,today()),
     ...grants.map(g=>db.prepare(walletGrantSql).bind(uid,g.reason,g.amount)),
    ]);
   }else{
    // A result recorded by version 2 keeps the rules it was earned under.
    if(typeof body.calm!=='boolean')return json({error:'Invalid completion'},400);
    let result;try{result=verifyLegacy(body.key,body.actions,body.elapsed,body.calm);}catch{return json({error:'The puzzle history could not be verified. Restart this puzzle to record a new attempt.'},400);}
    const days=await db.prepare('SELECT day FROM activity WHERE uid=?').bind(uid).all<{day:string}>(),earned=legacyStreaks([...days.results.map(r=>r.day),today()],today()),index=Number(body.key)-1;
    await db.batch([
     db.prepare('INSERT OR IGNORE INTO finishes(id,uid,puzzle,points,stars,moves,hints,seconds,day) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,uid,body.key,result.points,result.stars,result.moves,result.hints,body.elapsed,today()),
     db.prepare('INSERT INTO best(uid,puzzle,points,stars,moves) VALUES(?,?,?,?,?) ON CONFLICT(uid,puzzle) DO UPDATE SET points=MAX(best.points,excluded.points),stars=MAX(best.stars,excluded.stars),moves=MIN(best.moves,excluded.moves)').bind(uid,body.key,result.points,result.stars,result.moves),
     db.prepare('INSERT OR IGNORE INTO activity(uid,day) VALUES(?,?)').bind(uid,today()),
     ...[{reason:'puzzle:'+body.key,amount:10},...(result.target?[{reason:'target:'+body.key,amount:5}]:[]),...earned.map(s=>({reason:`streak:${s.kind}:${s.period}`,amount:legacyDust(s.kind,s.count)}))].map(g=>db.prepare(walletGrantSql).bind(uid,g.reason,g.amount)),
     ...(!daily?[db.prepare(legacyConstellationSql).bind(uid,'constellation:'+Math.floor(index/10),uid,uid,...Array.from({length:10},(_,i)=>String(Math.floor(index/10)*10+i+1)))]:[]),
    ]);
   }
  }else if(body.action==='guest'){
   if(body.accountId!==uid)return json({error:'Sign back into the account receiving these local rewards.'},403);
   const r=body.receipt;
   if(!r||typeof r.id!=='string'||!/^[a-f0-9-]{36}$/.test(r.id)||typeof r.key!=='string'||typeof r.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||r.day<'2026-09-12'||r.day>today())return json({error:'This local reward record is invalid.'},400);
   const claimed=await db.prepare('SELECT uid FROM guest_claims WHERE id=?').bind(r.id).first<{uid:string}>();
   if(claimed)return claimed.uid===uid?json(await snapshot()):json({error:'These local rewards already belong to another account.'},409);
   if(!dailyKey.test(r.key)&&!campaignKey.test(r.key))return json({error:'Invalid puzzle record.'},400);
   let grants,radiant=0;
   if(r.v===3){
    let result;try{result=verifyRun(r.key,r.actions);}catch{return json({error:'Could not verify this local puzzle. Its Stardust stays on this device.'},400);}
    radiant=result.stars>=3?1:0;grants=grantsFor({key:r.key,stars:result.stars},await history(db,uid));
   }else{
    if(typeof r.calm!=='boolean')return json({error:'This local reward record is invalid.'},400);
    let result;try{result=verifyLegacy(r.key,r.actions,r.elapsed,r.calm);}catch{return json({error:'Could not verify this local puzzle. Its Stardust stays on this device.'},400);}
    const [past,accountDays,bests]=await Promise.all([
     db.prepare('SELECT puzzle AS key,day,target FROM guest_claims WHERE uid=?').bind(uid).all<{key:string;day:string;target:number}>(),
     db.prepare('SELECT day FROM activity WHERE uid=?').bind(uid).all<{day:string}>(),
     db.prepare('SELECT puzzle AS key FROM best WHERE uid=?').bind(uid).all<{key:string}>()]);
    radiant=result.target?1:0;
    grants=legacyGuestGrants({key:r.key,day:r.day,target:result.target},[...past.results.map(h=>({...h,target:!!h.target})),...accountDays.results.map(h=>({key:'',day:h.day,target:false})),...bests.results.map(h=>({key:h.key,day:'',target:false}))]);
   }
   await db.batch([db.prepare(guestClaimSql).bind(r.id,uid,r.key,r.day,radiant),...grants.map(g=>db.prepare(guestCreditSql).bind(uid,g.reason,g.amount,r.id,uid))]);
   const owner=await db.prepare('SELECT uid FROM guest_claims WHERE id=?').bind(r.id).first<{uid:string}>();
   if(owner?.uid!==uid)return json({error:'These local rewards already belong to another account.'},409);
  }else if(body.action==='redeem'){
   if(!await hasProfile())return json({error:'Create your player profile first.'},400);
   const item=unlocks.find(u=>u.id===body.product);if(!item)return json({error:'This item cannot be unlocked with Stardust.'},400);
   const reason='shop:'+item.id;
   await db.prepare(redemptionSql).bind(uid,reason,-item.cost,uid,item.cost).run();
   if(!await db.prepare('SELECT reason FROM wallet_entries WHERE uid=? AND reason=?').bind(uid,reason).first())return json({error:'You need more Stardust for this unlock.'},400);
  }else if(body.action==='pulse'){
   if(!await hasProfile())return json({error:'Create your player profile first.'},400);
   if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id)||!Number.isFinite(body.seconds)||body.seconds<0||body.seconds>PULSE_SECONDS+30)return json({error:'Invalid Pulse run'},400);
   const week=weekOf();if(body.week!==week&&body.week!==week-1)return json({error:'This Pulse week has closed.'},400);
   let run;try{run=verifyPulse(body.week,body.boards);}catch{return json({error:'This Pulse run could not be verified.'},400);}
   await db.prepare(pulseSql).bind(uid+':'+body.id,uid,body.week,run.score,run.solved,run.turns,body.seconds,today()).run();
  }else if(body.action==='friend'||body.action==='unfriend'){
   if(!await hasProfile())return json({error:'Create your player profile first.'},400);
   const code=typeof body.code==='string'?body.code.trim().toUpperCase():'';
   if(!/^[A-Z2-9]{6}$/.test(code))return json({error:'Friend codes have six letters and numbers.'},400);
   const mate=await db.prepare('SELECT uid FROM players WHERE code=?').bind(code).first<{uid:string}>();
   if(!mate||mate.uid===uid)return json({error:'No other player has that code.'},404);
   await db.prepare(body.action==='friend'?'INSERT OR IGNORE INTO friends(uid,friend) VALUES(?,?)':'DELETE FROM friends WHERE uid=? AND friend=?').bind(uid,mate.uid).run();
  }else return json({error:'Unknown action'},400);
  return json(await snapshot());
 }catch(e){console.error('Could not save player',e);return json({error:'Could not save. Your local game is safe; please retry.'},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return json({error:'Invalid request origin'},403);
 const user=await getPlayerUser();if(!user)return json({error:'Please sign in.'},401);
 try{const db=database();await db.batch(['finishes','best','activity','rewards'].map(table=>db.prepare(`DELETE FROM ${table} WHERE uid=?`).bind(user.userId)));return json(await snapshot());}catch{return json({error:'Could not reset account progress. Please retry.'},503);}
}
