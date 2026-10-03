import { rotate } from './game.ts';
import { canPlay, type JourneyPuzzle } from './journey.ts';
import type {Action} from './ranked.ts';

export type Run = { puzzle:JourneyPuzzle; board:number[]; moves:number; hints:number; undo:number[][]; daily:boolean; key:string; elapsed:number;actions?:Action[] };
export const startRun = (puzzle:JourneyPuzzle,daily=false,key=String(puzzle.id)):Run => ({puzzle,board:[...puzzle.initial],moves:0,hints:0,undo:[],daily,key,elapsed:0,actions:[]});
export function restoreRun(raw:unknown,puzzle:JourneyPuzzle,daily=false,key=String(puzzle.id)):Run|null {
 if(!raw||typeof raw!=='object')return null;
 const r=raw as Record<string,unknown>;
 if(r.key!==key||r.daily!==daily)return null;
 if(r.fingerprint!==JSON.stringify([puzzle.initial,puzzle.solution,puzzle.locked,puzzle.filters,puzzle.receivers]))return puzzle.legacy?restoreRun(raw,puzzle.legacy,daily,key):null;
 const validBoard=(b:unknown):b is number[]=>Array.isArray(b)&&b.length===puzzle.initial.length&&b.every((mask,i)=>{
  if(!Number.isInteger(mask))return false;
  if(puzzle.locked.includes(i))return mask===puzzle.initial[i];
  let m=puzzle.initial[i];for(let n=0;n<4;n++){if(m===mask)return true;m=rotate(m);}return false;
 });
 if(!validBoard(r.board)||!Number.isSafeInteger(r.moves)||Number(r.moves)<0||!Number.isSafeInteger(r.hints)||Number(r.hints)<0||Number(r.hints)>Number(r.moves))return null;
 if(!Array.isArray(r.undo)||r.undo.length>100||!r.undo.every(validBoard)||r.undo.length>Number(r.moves))return null;
 return {...startRun(puzzle,daily,key),board:r.board,moves:Number(r.moves),hints:Number(r.hints),undo:r.undo,actions:Array.isArray(r.actions)&&r.actions.length===r.moves?r.actions:undefined,elapsed:typeof r.elapsed==='number'&&Number.isFinite(r.elapsed)&&r.elapsed>=0?Math.min(r.elapsed,86400):0};
}
export const serializeRun=(r:Run,elapsed=r.elapsed)=>({key:r.key,daily:r.daily,board:r.board,moves:r.moves,hints:r.hints,undo:r.undo,actions:r.actions,elapsed,fingerprint:JSON.stringify([r.puzzle.initial,r.puzzle.solution,r.puzzle.locked,r.puzzle.filters,r.puzzle.receivers])});
export function resumeIndex(last:unknown,stars:Record<string,number>,trial:boolean){
 const n=typeof last==='number'&&Number.isInteger(last)?Math.max(0,Math.min(89,last)):0;
 if(canPlay(n,stars,trial))return n;
 // Keep chapter context when a session-only preview entitlement expires.
 if(n>=30)return 30;
 for(let i=n;i>=0;i--)if(canPlay(i,stars,trial))return i;
 return 0;
}
