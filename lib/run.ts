import {type Board,shine,turnable,stateOf} from './optics.ts';

// Turns go either way. Undo is free: an undone turn no longer counts.
// A hint that turns a tile for you is remembered even if undone.
export type Action={k:'turn';i:number;d:1|-1}|{k:'hint';i:number}|{k:'undo'};
export type Step={i:number;prev:number;hint:boolean};
export type Run={key:string;rot:number[];history:Step[];hints:number;actions:Action[]};
type Playable=Board&{goal:number[];start:number[];minTurns:number};

export const startRun=(key:string,p:Playable):Run=>({key,rot:[...p.start],history:[],hints:0,actions:[]});
export const turnsOf=(r:Run)=>r.history.filter(s=>!s.hint).length;
export const MAX_ACTIONS=3000;

export function apply(r:Run,p:Playable,a:Action):Run{
 if(r.actions.length>=MAX_ACTIONS)throw Error('Too many actions');
 if(a.k==='undo'){
  const last=r.history.at(-1);if(!last)throw Error('Nothing to undo');
  const rot=[...r.rot];rot[last.i]=last.prev;
  return {...r,rot,history:r.history.slice(0,-1),actions:[...r.actions,a]};
 }
 const i=a.i;
 if(!Number.isInteger(i)||i<0||i>=r.rot.length)throw Error('Tile out of range');
 if(p.fixed[i]||!turnable(p.tiles[i]))throw Error('Tile cannot turn');
 const rot=[...r.rot];
 if(a.k==='turn'){if(a.d!==1&&a.d!==-1)throw Error('Invalid direction');rot[i]=(rot[i]+a.d+4)&3;}
 else if(a.k==='hint')rot[i]=p.goal[i];
 else throw Error('Invalid action');
 return {...r,rot,history:[...r.history,{i,prev:r.rot[i],hint:a.k==='hint'}],hints:r.hints+(a.k==='hint'?1:0),actions:[...r.actions,a]};
}

// Stars: one for lighting every target, one for doing it without automatic turns,
// one for a radiant board (every tile lit, no light escaping). Perfect is the fewest turns.
export function rate(r:Run,p:Playable){
 const light=shine(p,r.rot),turns=turnsOf(r);
 const stars=!light.solved?0:1+(r.hints===0?1:0)+(r.hints===0&&light.radiant?1:0);
 return {light,turns,stars,radiant:light.radiant,perfect:stars===3&&turns<=p.minTurns};
}
export const correct=(p:Playable,rot:number[],i:number)=>stateOf(p.tiles[i],rot[i])===stateOf(p.tiles[i],p.goal[i]);

// Saved runs carry a fingerprint so a changed puzzle never restores a stale board.
export const fingerprint=(p:Playable)=>p.w+'x'+p.h+':'+JSON.stringify([p.tiles,p.start,p.goal,p.fixed,p.ports]).length+':'+hash(JSON.stringify([p.tiles,p.start,p.goal,p.fixed,p.ports]));
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
export const serializeRun=(r:Run,p:Playable)=>({v:3,fp:fingerprint(p),key:r.key,actions:r.actions});
// Restores by replaying the saved actions, which validates every step.
export function restoreRun(raw:unknown,key:string,p:Playable):Run|null{
 if(!raw||typeof raw!=='object')return null;
 const v=raw as {v?:unknown;fp?:unknown;key?:unknown;actions?:unknown};
 if(v.v!==3||v.key!==key||v.fp!==fingerprint(p)||!Array.isArray(v.actions)||v.actions.length>MAX_ACTIONS)return null;
 try{let r=startRun(key,p);for(const a of v.actions as Action[])r=apply(r,p,a);return r;}catch{return null;}
}
