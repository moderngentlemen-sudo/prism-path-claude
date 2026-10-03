import {puzzleFor} from './content.ts';
import {startRun,apply,rate,MAX_ACTIONS,type Action} from './run.ts';
import {verifyFinish as legacyFinish,type Action as LegacyAction} from './legacy/ranked.ts';
import {enrich} from './legacy/journey.ts';
import {dailyIndex} from './legacy/game.ts';
import legacyBank from './legacy/puzzles.json' with {type:'json'};

export function cleanActions(raw:unknown):Action[]{
 if(!Array.isArray(raw)||raw.length<1||raw.length>MAX_ACTIONS)throw Error('Invalid puzzle history');
 return raw.map(a=>{
  if(!a||typeof a!=='object')throw Error('Invalid action');
  const v=a as {k?:unknown;i?:unknown;d?:unknown};
  if(v.k==='undo')return {k:'undo'};
  if(!Number.isInteger(v.i))throw Error('Invalid tile');
  if(v.k==='hint')return {k:'hint',i:v.i as number};
  if(v.k==='turn'&&(v.d===1||v.d===-1))return {k:'turn',i:v.i as number,d:v.d};
  throw Error('Invalid action');
 });
}
// Replays a history against the canonical puzzle; the final board must light every target.
export function verifyRun(key:string,raw:unknown){
 const p=puzzleFor(key);if(!p)throw Error('Unknown puzzle');
 let r=startRun(key,p);for(const a of cleanActions(raw))r=apply(r,p,a);
 const result=rate(r,p);if(!result.light.solved)throw Error('Puzzle is not solved');
 return {stars:result.stars,radiant:result.radiant,perfect:result.perfect,turns:result.turns,hints:r.hints};
}
// Results and guest receipts recorded before version 3 verify against the puzzles they were played on.
export function verifyLegacy(key:string,actions:unknown,elapsed:number,calm:boolean){
 const daily=/^daily-(\d{4}-\d{2}-\d{2})$/.exec(key);
 const base=daily?legacyBank.daily[dailyIndex(new Date(daily[1]+'T00:00:00Z'))]:/^(?:[1-9]|[1-8][0-9]|90)$/.test(key)?legacyBank.campaign[Number(key)-1]:null;
 if(!base)throw Error('Unknown puzzle');
 return legacyFinish(enrich(base),actions as LegacyAction[],elapsed,calm);
}
