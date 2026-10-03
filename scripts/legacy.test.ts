import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enrich,illuminate} from '../lib/legacy/journey.ts';
import {rotate} from '../lib/legacy/game.ts';
import {verifyFinish,type Action} from '../lib/legacy/ranked.ts';
import {guestGrants} from '../lib/legacy/guest-dust.ts';
import {streaks} from '../lib/legacy/streaks.ts';
import {verifyLegacy} from '../lib/verify.ts';
const bank=JSON.parse(readFileSync(new URL('../lib/legacy/puzzles.json',import.meta.url),'utf8'));

// Version 2 results and guest receipts still verify after the version 3 content change,
// so nothing already earned is lost.
function legacyActions(raw:unknown){
 const p=enrich(raw as Parameters<typeof enrich>[0]),board=[...p.initial],actions:Action[]=[];
 for(let i=0;i<board.length&&!illuminate(board,p).solved;i++){if(p.locked.includes(i))continue;while(board[i]!==p.solution[i]&&!illuminate(board,p).solved){board[i]=rotate(board[i]);actions.push({kind:'rotate',index:i});}}
 return actions;
}
void test('Every version 2 campaign result still verifies with its original rules',()=>{
 bank.campaign.forEach((raw:unknown,k:number)=>{
  const actions=legacyActions(raw),result=verifyLegacy(String(k+1),actions,10,false);
  assert.deepEqual(result,verifyFinish(enrich(raw as Parameters<typeof enrich>[0]),actions,10,false));
  assert.throws(()=>verifyLegacy(String(k+1),actions.slice(0,-1),10,false));
 });
 assert.throws(()=>verifyLegacy('91',[],0,false));
});
void test('Version 2 daily results verify against the daily they were played on',()=>{
 const raw=bank.daily[0],actions=legacyActions(raw);
 // dailyIndex counts days since 1970 modulo 365; this date maps to index 0.
 const date=new Date(365*86400000*56).toISOString().slice(0,10);
 const index=Math.floor(Date.parse(date+'T00:00:00Z')/86400000)%365;
 assert.ok(verifyLegacy('daily-'+date,legacyActions(bank.daily[index]),5,true));
 assert.ok(actions.length>0);
});
void test('Version 2 guest receipts keep their reward rules and deduplicate',()=>{
 const event={key:'1',day:'2026-09-12',target:true};
 assert.equal(guestGrants(event,[]).reduce((s,g)=>s+g.amount,0),145);
 assert.deepEqual(guestGrants(event,[event]),[]);
 assert.equal(streaks(['2026-01-01'],'2026-01-03')[0].count,0);
});
