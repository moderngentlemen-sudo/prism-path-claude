import {type Board,type Light,shine,turnable,stateOf,openings,hueName,hueGlyph,cellName,facing,sideName,DX,DY,W} from './optics.ts';

type Playable=Board&{goal:number[]};
const wrong=(p:Playable,rot:number[],i:number)=>!p.fixed[i]&&turnable(p.tiles[i])&&stateOf(p.tiles[i],rot[i])!==stateOf(p.tiles[i],p.goal[i]);
const lit=(l:Light,i:number)=>l.lit[i]>0;
function neighbours(p:Board,i:number){const x=i%p.w,y=Math.floor(i/p.w);return [0,1,2,3].map(s=>{const xx=x+DX[s],yy=y+DY[s];return xx>=0&&yy>=0&&xx<p.w&&yy<p.h?yy*p.w+xx:-1;}).filter(j=>j>=0);}

// The gentle first step: where the light stops, without naming a fix.
export function whereLightStops(p:Board,rot:number[]){
 const l=shine(p,rot),out=new Set<number>();
 for(const leak of l.leaks)out.add(leak.i);
 for(const q of p.ports)if(!q.out&&!lit(l,q.i))out.add(q.i);
 for(let i=0;i<l.lit.length;i++)if(lit(l,i))for(const j of neighbours(p,i))if(!lit(l,j))out.add(j);
 return [...out];
}

function problem(p:Playable,l:Light){
 const outlet=p.ports.findIndex((q,k)=>q.out&&l.got[k]!==q.c);
 if(outlet>=0){const q=p.ports[outlet],got=l.got[outlet];return `The ${sideName(q.s)} outlet needs ${hueName(q.c)} light ${hueGlyph(q.c)}${got?`, but it receives ${hueName(got)}`:', and no light reaches it yet'}.`;}
 const recv=p.tiles.findIndex((t,i)=>t.k==='recv'&&l.recv[i]!==t.c);
 if(recv>=0){const t=p.tiles[recv] as {c:number},got=l.recv[recv];return `The receiver at ${cellName(p,recv)} needs ${hueName(t.c)} ${hueGlyph(t.c)}${got?`, but it receives ${hueName(got)}`:', and it is still dark'}.`;}
 const dark=l.lit.length-l.litCount;
 return `Every target is lit. For a third star, ${[l.leaks.length?`seal ${l.leaks.length} ${l.leaks.length===1?'leak':'leaks'}`:'',dark?`light ${dark} dark ${dark===1?'tile':'tiles'}`:''].filter(Boolean).join(' and ')}.`;
}
function instruction(p:Playable,i:number){
 const t=p.tiles[i],g=p.goal[i];
 if(t.k==='prism')return `turn the prism so white light enters its flat back from the ${sideName((W+g)&3)}`;
 if(t.k==='mirror')return `set the mirror to ${g&1?'/':'\\'}`;
 if(t.k==='recv')return `point its opening ${sideName((W+g)&3)}`;
 if(t.k==='filter')return `line it up ${g&1?'north to south':'east to west'}`;
 return `turn it so its openings face ${facing(openings(t,g))}`;
}
// Picks the fix that moves the board furthest toward radiant, preferring tiles next to the light.
export function hintFor(p:Playable,rot:number[]){
 const l=shine(p,rot);if(l.radiant)return null;
 const near=new Set(whereLightStops(p,rot));
 let best:{at:number;score:number}|null=null;
 for(let i=0;i<rot.length;i++){
  if(!wrong(p,rot,i))continue;
  const next=[...rot];next[i]=p.goal[i];const n=shine(p,next);
  const score=(n.satisfied-l.satisfied)*100+(n.litCount-l.litCount)*3-(n.leaks.length-l.leaks.length)*2+(near.has(i)||lit(l,i)?20:0);
  if(!best||score>best.score)best={at:i,score};
 }
 if(!best)return null;
 return {at:best.at,text:`${problem(p,l)} Try ${cellName(p,best.at)}: ${instruction(p,best.at)}.`};
}
