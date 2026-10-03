import {type Board,openings,distinctTurns,shine,bit,opposite,DX,DY} from './optics.ts';

// A radiant board lights every tile and lets no light escape. Pipe, filter and
// receiver openings must therefore meet open neighbours (Net's rule), while
// bridges, mirrors and prisms are open on all four sides and are settled by light.
type Model={b:Board;n:number;nb:Int32Array;port:Uint8Array;sv:Uint8Array;special:boolean[];inlets:number[]};
function model(b:Board):Model{
 const n=b.w*b.h,nb=new Int32Array(n*4).fill(-1),port=new Uint8Array(n*4),sv=new Uint8Array(n*4),special=b.tiles.map(t=>t.k==='bridge'||t.k==='mirror'||t.k==='prism');
 for(let i=0;i<n;i++){const x=i%b.w,y=Math.floor(i/b.w);for(let s=0;s<4;s++){const xx=x+DX[s],yy=y+DY[s];if(xx>=0&&yy>=0&&xx<b.w&&yy<b.h)nb[i*4+s]=yy*b.w+xx;}for(let r=0;r<4;r++)sv[i*4+r]=openings(b.tiles[i],r);}
 for(const p of b.ports)port[p.i*4+p.s]=1;
 const inlets=b.ports.filter(p=>!p.out).map(p=>p.i);
 return {b,n,nb,port,sv,special,inlets};
}
const masks=(d:number)=>[0,1,2,3].filter(r=>d&(1<<r));
// Possible open/closed values of side s for domain d: bit 0 closed, bit 1 open.
function edgeValues(m:Model,i:number,s:number,d:number){let v=0;for(let r=0;r<4;r++)if(d&(1<<r))v|=m.sv[i*4+r]&bit(s)?2:1;return v;}
function initialDomains(m:Model,fixedRot:number[]){
 const dom=new Uint8Array(m.n);
 for(let i=0;i<m.n;i++){
  let d=0;for(const r of m.b.fixed[i]?[fixedRot[i]&3]:distinctTurns(m.b.tiles[i]))d|=1<<r;
  // Sides facing the border must be closed unless a port is there.
  for(let s=0;s<4;s++)if(m.nb[i*4+s]<0){const want=m.port[i*4+s]?1:0;for(let r=0;r<4;r++)if(d&(1<<r)&&((m.sv[i*4+r]>>s)&1)!==want)d&=~(1<<r);}
  dom[i]=d;
 }
 return dom;
}
// Arc consistency on shared sides. Returns the number of synchronous rounds, or -1 on contradiction.
function propagate(m:Model,dom:Uint8Array,start?:number[]){
 let queue=start??Array.from({length:m.n},(_,i)=>i),rounds=0;
 while(queue.length){
  rounds++;const next=new Set<number>();
  for(const i of queue){
   if(!dom[i])return -1;
   for(let s=0;s<4;s++){
    const j=m.nb[i*4+s];if(j<0)continue;
    const v=edgeValues(m,i,s,dom[i]),o=opposite(s);let d=dom[j];
    for(let r=0;r<4;r++)if(d&(1<<r)&&!(v&(m.sv[j*4+r]&bit(o)?2:1)))d&=~(1<<r);
    if(d!==dom[j]){if(!d)return -1;dom[j]=d;next.add(j);}
   }
  }
  queue=[...next];
 }
 return rounds;
}
const single=(d:number)=>d&&!(d&(d-1));
const rotOf=(d:number)=>d===1?0:d===2?1:d===4?2:3;
// A finished group of tiles whose openings all meet each other is sealed off.
// It must hold an inlet, and it may not hold every inlet while other tiles remain outside.
function sealedOk(m:Model,dom:Uint8Array){
 const known=(i:number)=>m.special[i]||single(dom[i]);
 const open=(i:number)=>m.special[i]?15:m.sv[i*4+rotOf(dom[i])];
 const seen=new Uint8Array(m.n);
 for(let start=0;start<m.n;start++){
  if(seen[start]||!known(start))continue;
  let sealed=true,size=0,inlets=0;const stack=[start];seen[start]=1;
  while(stack.length){
   const i=stack.pop()!;size++;if(m.inlets.includes(i))inlets++;
   const o=open(i);
   for(let s=0;s<4;s++){if(!(o&bit(s)))continue;const j=m.nb[i*4+s];if(j<0)continue;if(!known(j)){sealed=false;continue;}if(!(open(j)&bit(opposite(s))))continue;if(!seen[j]){seen[j]=1;stack.push(j);}}
  }
  if(sealed&&(inlets===0||(inlets===m.inlets.length&&size<m.n)))return false;
 }
 return true;
}
function specialCombos(m:Model,dom:Uint8Array){
 const cells=[...Array(m.n).keys()].filter(i=>m.special[i]);
 const choices=cells.map(i=>masks(dom[i]));
 const out:number[][]=[];
 const walk=(k:number,acc:number[])=>{if(k===cells.length){out.push(acc);return;}for(const r of choices[k])walk(k+1,[...acc,r]);};
 walk(0,[]);
 return {cells,combos:out};
}
export type Solutions={count:number;solutions:number[][];nodes:number;aborted:boolean};
// Enumerates radiant arrangements, stopping after `limit`. fixedRot supplies fixed tiles' turns.
export function solveRadiant(b:Board,fixedRot:number[],limit=2,maxNodes=250000):Solutions{
 const m=model(b),dom=initialDomains(m,fixedRot),solutions:number[][]=[];let nodes=0,aborted=false;
 if(propagate(m,dom)<0)return {count:0,solutions,nodes,aborted};
 const search=(d:Uint8Array)=>{
  if(solutions.length>=limit||aborted)return;
  if(++nodes>maxNodes){aborted=true;return;}
  if(!sealedOk(m,d))return;
  let pick=-1,best=9;
  for(let i=0;i<m.n;i++){if(m.special[i])continue;const c=masks(d[i]).length;if(c>1&&c<best){best=c;pick=i;}}
  if(pick<0){
   const {cells,combos}=specialCombos(m,d);
   const base=Array.from(d,(v,i):number=>m.special[i]?0:rotOf(v));
   for(const combo of combos){const rot=[...base];cells.forEach((c,k)=>rot[c]=combo[k]);if(shine(b,rot).radiant){solutions.push(rot);if(solutions.length>=limit)return;}}
   return;
  }
  for(const r of masks(d[pick])){const next=d.slice();next[pick]=1<<r;if(propagate(m,next,[pick])>=0)search(next);if(solutions.length>=limit||aborted)return;}
 };
 search(dom);
 return {count:solutions.length,solutions,nodes,aborted};
}

// How a person might get there: rounds of local deduction, then single trial
// placements that fail (how far a wrong guess travels before it shows).
export type Grade={rounds:number;trials:number;trialSteps:number;stuck:boolean;specials:number;tiles:number;score:number};
export function grade(b:Board,fixedRot:number[]):Grade{
 const m=model(b),dom=initialDomains(m,fixedRot);let rounds=0,trials=0,trialSteps=0,stuck=false;
 const settled=()=>{for(let i=0;i<m.n;i++)if(!m.special[i]&&!single(dom[i]))return false;return true;};
 for(let guard=0;guard<200;guard++){
  const r=propagate(m,dom);if(r<0){stuck=true;break;}rounds+=r;
  if(settled())break;
  let removed=false;
  const open=[...Array(m.n).keys()].filter(i=>!m.special[i]&&!single(dom[i])).sort((a,c)=>masks(dom[a]).length-masks(dom[c]).length);
  for(const i of open){
   for(const v of masks(dom[i])){
    const test=dom.slice();test[i]=1<<v;const steps=propagate(m,test,[i]);
    if(steps<0||!sealedOk(m,test)){dom[i]&=~(1<<v);trials++;trialSteps+=Math.max(1,steps);removed=true;break;}
   }
   if(removed)break;
  }
  if(!removed){stuck=true;break;}
 }
 const specials=b.tiles.filter((t,i)=>m.special[i]&&t.k!=='bridge').length;
 const tiles=b.tiles.filter((t,i)=>!b.fixed[i]).length;
 const score=Math.round(tiles*.35+rounds*.6+trials*3+trialSteps*.4+specials*3+(stuck?18:0));
 return {rounds,trials,trialSteps,stuck,specials,tiles,score};
}
