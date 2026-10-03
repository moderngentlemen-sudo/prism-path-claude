import {rotate,starsFor} from './game.ts';
import {illuminate,type JourneyPuzzle} from './journey.ts';
import {puzzleScore} from './scoring.ts';
export type Action={kind:'rotate'|'hint'|'undo';index?:number};
export function verifyFinish(p:JourneyPuzzle,actions:Action[],elapsed:number,calm:boolean){
 try{return replay(p,actions,elapsed,calm);}catch(error){if(p.legacy)return replay(p.legacy,actions,elapsed,calm);throw error;}
}
function replay(p:JourneyPuzzle,actions:Action[],elapsed:number,calm:boolean){
 if(!Array.isArray(actions)||actions.length<1||actions.length>2000||!Number.isFinite(elapsed)||elapsed<0||elapsed>86400)throw Error('Invalid puzzle history');
 let board=[...p.initial],undo:number[][]=[],hints=0;
 for(const action of actions){if(!action||illuminate(board,p).solved)throw Error('Invalid action after completion');const i=action.index;
  if(action.kind==='undo'){if(!undo.length)throw Error('Nothing to undo');board=undo.pop()!;continue;}
  if(!Number.isInteger(i)||i!<0||i!>=board.length||p.locked.includes(i!))throw Error('Invalid tile');
  undo=[...undo.slice(-99),board];
  if(action.kind==='rotate')board=board.map((m,j)=>j===i?rotate(m):m);
  else if(action.kind==='hint'){hints++;board=board.map((m,j)=>j===i?p.solution[j]:m);}else throw Error('Invalid action');
 }
 if(!illuminate(board,p).solved)throw Error('Puzzle is not solved');
 const score=puzzleScore(actions.length,p.par,Math.max(0,p.paceSeconds-elapsed),p.paceSeconds,calm,p.id);
 return {points:score.points,stars:starsFor(actions.length,p.par,hints),moves:actions.length,hints,target:actions.length<=p.par};
}
