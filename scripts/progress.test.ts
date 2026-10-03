import {test} from 'node:test';
import assert from 'node:assert/strict';
import {campaign,dailyFor,puzzleFor,dayKey,weekdayIdeas} from '../lib/content.ts';
import {startRun,apply,rate,turnsOf,serializeRun,restoreRun,correct,type Action,type Run} from '../lib/run.ts';
import {turnsTo,stateOf,shine} from '../lib/optics.ts';
import {verifyRun,cleanActions} from '../lib/verify.ts';
import {grantsFor,pendingDust,mergeReceipts,unlockProgress,unlocks,palettes,constellationDone,type Clear} from '../lib/rewards.ts';
import {dailyStreak,chainTo} from '../lib/streaks.ts';
import {pulseBoard,verifyPulse,boardPoints,weekOf} from '../lib/pulse.ts';
import {cleanEvents,statBucket} from '../lib/analytics.ts';
import {hintFor,whereLightStops} from '../lib/hints.ts';
import type {Puzzle} from '../lib/puzzle.ts';

// The fewest-turn solution: each tile turns the short way round.
function solve(p:{tiles:Puzzle['tiles'];start:number[];goal:number[]}):Action[]{
 const out:Action[]=[];
 p.tiles.forEach((t,i)=>{const cw=turnsTo(t,p.start[i],p.goal[i],1),ccw=turnsTo(t,p.start[i],p.goal[i],-1);const d:1|-1=cw<=ccw?1:-1;for(let n=Math.min(cw,ccw);n>0;n--)out.push({k:'turn',i,d});});
 return out;
}
const play=(p:Puzzle,actions:Action[])=>actions.reduce((r:Run,a)=>apply(r,p,a),startRun(p.key,p));

void test('Fewest-turn solutions earn three stars and Perfect on every campaign puzzle',()=>{
 for(const p of campaign){
  const actions=solve(p),r=play(p,actions),score=rate(r,p);
  assert.equal(actions.length,p.minTurns,`turns ${p.key}`);
  assert.equal(score.stars,3,`stars ${p.key}`);assert.ok(score.perfect);assert.ok(score.radiant);
  assert.deepEqual(verifyRun(p.key,actions),{stars:3,radiant:true,perfect:true,turns:p.minTurns,hints:0});
 }
});
void test('Undo is free, hints cost stars, and fixed tiles never move',()=>{
 const p=campaign[14],actions=solve(p),first=actions[0] as {i:number};
 const wobble:Action[]=[{k:'turn',i:first.i,d:1},{k:'undo'},...actions];
 const r=play(p,wobble);assert.equal(turnsOf(r),p.minTurns);assert.equal(rate(r,p).perfect,true);
 const hinted:Action[]=[{k:'hint',i:first.i},...actions.filter(a=>a.k==='turn'&&a.i!==first.i)];
 assert.equal(rate(play(p,hinted),p).stars,1);
 const hintedUndone:Action[]=[{k:'hint',i:first.i},{k:'undo'},...actions];
 assert.equal(rate(play(p,hintedUndone),p).stars,1,'an undone hint still counts');
 const pinned=p.fixed.findIndex(Boolean);if(pinned>=0)assert.throws(()=>apply(startRun(p.key,p),p,{k:'turn',i:pinned,d:1}));
 assert.throws(()=>apply(startRun(p.key,p),p,{k:'undo'}));
 assert.throws(()=>verifyRun(p.key,[actions[0]]),/not solved/);
});
void test('Two stars for lighting every target; the third once the board is sealed',()=>{
 let found=false;
 for(const p of campaign.slice(3,30)){
  const actions=solve(p);
  for(const i of new Set(actions.map(a=>(a as {i:number}).i))){
   const s=rate(play(p,actions.filter(a=>(a as {i:number}).i!==i)),p);
   if(s.light.solved&&!s.radiant){assert.equal(s.stars,2);assert.equal(rate(play(p,actions),p).stars,3);found=true;break;}
  }
  if(found)break;
 }
 assert.ok(found);
});
void test('Saved runs restore by replay and refuse changed puzzles',()=>{
 const p=campaign[20],actions=solve(p).slice(0,3),r=play(p,actions);
 const saved=serializeRun(r,p);assert.deepEqual(restoreRun(saved,p.key,p)?.rot,r.rot);
 assert.equal(restoreRun({...saved,fp:'other'},p.key,p),null);
 assert.equal(restoreRun({...saved,key:'22'},p.key,p),null);
 assert.equal(restoreRun({...saved,actions:[{k:'turn',i:999,d:1}]},p.key,p),null);
 assert.equal(restoreRun(JSON.parse(JSON.stringify(saved)),p.key,p)?.rot.length,p.tiles.length);
});
void test('Server replay rejects malformed histories',()=>{
 assert.throws(()=>cleanActions([]));assert.throws(()=>cleanActions([{k:'turn',i:0,d:2}]));assert.throws(()=>cleanActions([{k:'spin',i:0}]));
 assert.throws(()=>cleanActions(Array(3001).fill({k:'undo'})));
 assert.throws(()=>verifyRun('91',[{k:'undo'}]));
});
void test('Hints aim at the light frontier and explain the target',()=>{
 for(const p of campaign.slice(0,40)){
  let rot=[...p.start];const seen=new Set<number>();
  for(let k=0;k<200&&!shine(p,rot).radiant;k++){const h=hintFor(p,rot);assert.ok(h,`hint ${p.key}`);assert.ok(!seen.has(h.at)||!correct(p,rot,h.at));seen.add(h.at);assert.ok(!p.fixed[h.at]);rot=rot.map((v,i)=>i===h.at?p.goal[i]:v);}
  assert.ok(shine(p,rot).radiant,`hints finish ${p.key}`);assert.equal(hintFor(p,rot),null);
 }
 const p=campaign[44];assert.match(hintFor(p,p.start)!.text,/Try row \d+, column \d+/);
 assert.ok(whereLightStops(p,p.start).length>0);
});

void test('Stardust: steady first-clear, radiant, constellation and streak rewards, never twice',()=>{
 assert.deepEqual(grantsFor({key:'5',stars:2},[]),[{reason:'puzzle:5',amount:10}]);
 assert.deepEqual(grantsFor({key:'5',stars:3},[{key:'5',stars:2}]),[{reason:'radiant:5',amount:5}]);
 assert.deepEqual(grantsFor({key:'5',stars:3},[{key:'5',stars:3}]),[]);
 const nine:Clear[]=Array.from({length:9},(_,i)=>({key:String(i+1),stars:1}));
 assert.ok(grantsFor({key:'10',stars:1},nine).some(g=>g.reason==='constellation:0'&&g.amount===25));
 assert.ok(!grantsFor({key:'10',stars:1},[...nine,{key:'10',stars:1}]).some(g=>g.reason.startsWith('constellation')));
 const week=['2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06'].map(d=>({key:'daily-'+d,stars:1}));
 assert.ok(grantsFor({key:'daily-2026-10-07',stars:1},week).some(g=>g.reason==='streak:2026-10-07'&&g.amount===25));
 assert.ok(!grantsFor({key:'daily-2026-10-06',stars:1},week.slice(0,5)).some(g=>g.reason.startsWith('streak')));
 assert.equal(grantsFor({key:'1',stars:1},[]).reduce((s,g)=>s+g.amount,0),10,'no burst of currency on the first puzzle');
 assert.ok(unlocks.every(u=>u.cost>0)&&!unlocks.some(u=>(u.id as string)==='pack'),'Stardust never buys chapters');
 assert.deepEqual(palettes.map(p=>p.chapter),[-1,2,8]);
 assert.equal(constellationDone(Object.fromEntries(Array.from({length:10},(_,i)=>[String(i+1),1])),0),true);
});
void test('Guest receipts and unlock progress',()=>{
 const g=[{reason:'puzzle:1',amount:10}];
 assert.equal(pendingDust([{grants:g},{grants:g}]),10);
 assert.equal(pendingDust([{grants:g,synced:true},{grants:g}]),0);
 assert.equal(mergeReceipts([{id:'a'}],[{id:'a',synced:true,owner:'x'}])[0].synced,true);
 const p=unlockProgress(150,100,60);assert.equal(p.needsSync,true);assert.equal(p.affordable,false);
});
void test('Daily streak freeze covers one missed day a week',()=>{
 const run=['2026-10-01','2026-10-02','2026-10-04','2026-10-05'];
 assert.deepEqual(chainTo(run,'2026-10-05'),{count:4,frozen:['2026-10-03']});
 assert.equal(chainTo(['2026-10-01','2026-10-03','2026-10-05'],'2026-10-05').count,2,'two misses in a week break the chain');
 assert.equal(dailyStreak(run,'2026-10-05').active,true);
 assert.equal(dailyStreak(run,'2026-10-06').count,4,'today is still open');
 assert.equal(dailyStreak(['2026-10-01','2026-10-02'],'2026-10-04').count,2,'a missed yesterday can still be frozen');
 assert.equal(dailyStreak(['2026-10-01'],'2026-10-05').count,0);
 assert.equal(dailyStreak([],'2026-10-05').count,0);
});
void test('Daily puzzles follow the UTC weekday and are stable for a date',()=>{
 const sat=dailyFor('daily-2026-10-03')!,sun=dailyFor('daily-2026-10-04')!;
 assert.equal(sat.idea,weekdayIdeas[6]);assert.equal(sun.idea,weekdayIdeas[0]);
 assert.deepEqual(dailyFor('daily-2026-10-03'),sat);assert.equal(dailyFor('daily-2026-02-30'),null);assert.equal(puzzleFor('nope'),null);
 assert.equal(dayKey(new Date('2026-10-03T23:59:00-05:00')),'daily-2026-10-04');
 const p=sat;assert.equal(verifyRun(p.key,solve(p)).stars,3);
});
void test('Pulse boards are shared by week and verified board by board',()=>{
 const week=weekOf(new Date('2026-10-03T12:00:00Z'));
 assert.deepEqual(pulseBoard(week,0),pulseBoard(week,0));assert.notDeepEqual(pulseBoard(week,0),pulseBoard(week+1,0));
 const boards=[0,1,2].map(k=>solve(pulseBoard(week,k)));
 const run=verifyPulse(week,boards);assert.equal(run.solved,3);assert.equal(run.score,450);
 assert.equal(boardPoints(20,10),100);assert.equal(boardPoints(10,10),150);
 assert.throws(()=>verifyPulse(week,[boards[1]]));
});
void test('Anonymous statistics accept only small, known counters',()=>{
 assert.deepEqual(cleanEvents([{p:'12',k:'solve',n:1},{p:'daily',k:'hint',n:3},{p:'c4',k:'feel-2',n:1}]).length,3);
 for(const bad of [[{p:'91',k:'solve',n:1}],[{p:'1',k:'email',n:1}],[{p:'1',k:'solve',n:500}],[{p:'1',k:'solve',n:1,uid:'x'}].map(e=>({...e,p:'user-1'}))])assert.throws(()=>cleanEvents(bad));
 assert.equal(statBucket('daily-2026-10-03'),'daily');assert.equal(statBucket('17'),'17');
});
void test('Campaign chapters introduce one idea at a time',()=>{
 assert.equal(campaign.length,90);
 const has=(c:number,k:string)=>campaign.slice(c*10,c*10+10).some(p=>p.tiles.some(t=>t.k===k));
 assert.ok(!has(0,'bridge')&&!has(0,'prism')&&!has(1,'prism')&&!has(2,'mirror'));
 assert.ok(has(2,'bridge')&&has(3,'mirror')&&has(4,'prism')&&has(7,'filter'));
 assert.ok(campaign.slice(10,20).every(p=>p.fixed.some(Boolean)));
 assert.ok(campaign.slice(60,70).every(p=>p.ports.filter(q=>!q.out).length===2));
 for(let c=0;c<9;c++){const d=campaign.slice(c*10,c*10+10).map(p=>p.difficulty);assert.ok(d[9]>=d[0],`chapter ${c} ends harder than it starts`);}
 assert.ok(campaign.every(p=>p.name&&p.lesson&&p.w<=7&&p.h<=7));
 assert.ok(campaign.slice(0,3).every(p=>p.minTurns<=3));
 assert.equal(stateOf(campaign[0].tiles[1],campaign[0].start[1])===stateOf(campaign[0].tiles[1],campaign[0].goal[1]),false);
});
