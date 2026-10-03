import {type Board,type Tile,type Port,type Hue,WHITE,AMBER,MINT,VIOLET,N,E,S,W,DX,DY,bit,opposite,rotateMask,distinctTurns,stateOf,fewestTurns,shine,turnable} from './optics.ts';
import {solveRadiant,grade,type Grade} from './solver.ts';

export function rng(seed:number){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const pick=<T,>(r:()=>number,xs:readonly T[])=>xs[Math.floor(r()*xs.length)];
const shuffle=<T,>(r:()=>number,xs:T[])=>{for(let i=xs.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[xs[i],xs[j]]=[xs[j],xs[i]];}return xs;};

// Smallest rotation of a pipe mask, and the turns that reach a given mask from it.
export const canonical=(m:number)=>Math.min(...[0,1,2,3].map(t=>rotateMask(m,t)));
export const turnsFor=(base:number,m:number)=>[0,1,2,3].find(t=>rotateMask(base,t)===m)!;

export type Spec={
 w:number;h:number;
 inlets?:{side:number;at?:number;c:Hue}[];  // default: one white inlet on the west edge
 outlets?:{side:number;at?:number}[];       // default: one outlet on the east edge
 bridges?:number;mirrors?:number;prisms?:number;filters?:number;receivers?:number;fixed?:number;merges?:number;
 corridor?:number;                          // 0..1, preference for long unbranched paths
 scramble?:number;                          // share of turnable tiles that start out of place
};
export type Built=Board&{goal:number[];start:number[];minTurns:number;grade?:Grade};

type Edge={a:number;b:number;via?:number;sa:number;sb:number};
// Grows a full-board light network: every tile joins it, so every tile can glow.
function network(spec:Spec,r:()=>number){
 const {w,h}=spec,n=w*h,cell=(x:number,y:number)=>y*w+x;
 const edgeCell=(side:number,at:number)=>side===W?cell(0,at):side===E?cell(w-1,at):side===N?cell(at,0):cell(at,h-1);
 const span=(side:number)=>side===W||side===E?h:w;
 const inlets=(spec.inlets??[{side:W,c:WHITE}]).map(p=>({...p,at:p.at??Math.floor(r()*span(p.side))}));
 const outlets=(spec.outlets??[{side:E}]).map(p=>({...p,at:p.at??Math.floor(r()*span(p.side))}));
 const portCells=new Set([...inlets,...outlets].map(p=>edgeCell(p.side,p.at)));
 if(portCells.size<inlets.length+outlets.length)return null;
 // Special tiles sit inside the frame and never touch one another.
 const interior=shuffle(r,[...Array(n).keys()].filter(i=>{const x=i%w,y=Math.floor(i/w);return x>0&&y>0&&x<w-1&&y<h-1&&!portCells.has(i);}));
 const kinds:('bridge'|'mirror'|'prism')[]=[...Array(spec.prisms??0).fill('prism'),...Array(spec.bridges??0).fill('bridge'),...Array(spec.mirrors??0).fill('mirror')];
 const special=new Map<number,'bridge'|'mirror'|'prism'>(),mirrorTurn=new Map<number,number>();
 for(const k of kinds){
  const at=interior.find(i=>![...special.keys()].some(j=>Math.abs(j%w-i%w)+Math.abs(Math.floor(j/w)-Math.floor(i/w))<2));
  if(at===undefined)return null;special.set(at,k);if(k==='mirror')mirrorTurn.set(at,r()<.5?0:1);
 }
 const carrier=(i:number)=>special.get(i)==='bridge'||special.get(i)==='mirror';
 const nb=(i:number,s:number)=>{const x=i%w+DX[s],y=Math.floor(i/w)+DY[s];return x>=0&&y>=0&&x<w&&y<h?cell(x,y):-1;};
 const forced:Edge[]=[],free:Edge[]=[];
 for(const [i,k] of special){
  if(k==='prism'){for(let s=0;s<4;s++)forced.push({a:i,b:nb(i,s),sa:s,sb:opposite(s)});continue;}
  const pairs=k==='bridge'?[[N,S],[E,W]]:mirrorTurn.get(i)?[[W,N],[S,E]]:[[W,S],[N,E]];
  for(const [p,q] of pairs)forced.push({a:nb(i,p),b:nb(i,q),via:i,sa:opposite(p),sb:opposite(q)});
 }
 for(let i=0;i<n;i++)for(const s of [E,S]){const j=nb(i,s);if(j<0||carrier(i)||carrier(j)||special.get(i)==='prism'||special.get(j)==='prism')continue;free.push({a:i,b:j,sa:s,sb:opposite(s)});}
 // Union-find over tiles; carriers are not nodes, their channels are edges.
 const parent=[...Array(n).keys()],find=(x:number):number=>parent[x]===x?x:(parent[x]=find(parent[x]));
 const inletRoot=new Set<number>();
 const holdsInlet=(x:number)=>inlets.some(p=>find(edgeCell(p.side,p.at))===find(x));
 const degree=Array<number>(n).fill(0),edges:Edge[]=[];
 const join=(e:Edge)=>{if(find(e.a)===find(e.b))return false;if(inlets.length>1&&holdsInlet(e.a)&&holdsInlet(e.b))return false;parent[find(e.a)]=find(e.b);degree[e.a]++;degree[e.b]++;edges.push(e);return true;};
 for(const e of forced)if(!join(e))return null;
 const nodes=[...Array(n).keys()].filter(i=>!carrier(i));
 const target=Math.max(1,inlets.length);
 const roots=()=>new Set(nodes.map(find)).size;
 const corridor=spec.corridor??.5;
 while(roots()>target){
  const options=free.filter(e=>find(e.a)!==find(e.b)&&!(inlets.length>1&&holdsInlet(e.a)&&holdsInlet(e.b)));
  if(!options.length)return null;
  const calm=options.filter(e=>degree[e.a]<2&&degree[e.b]<2);
  join(pick(r,calm.length&&r()<corridor?calm:options));
 }
 inletRoot.clear();
 return {w,h,n,inlets,outlets,special,mirrorTurn,edges,edgeCell,nb};
}

// Builds the solved board (goal turns) from a network.
function assemble(net:NonNullable<ReturnType<typeof network>>,r:()=>number){
 const {w,h,n,edges,special,mirrorTurn,inlets,outlets,edgeCell}=net;
 const mask=Array<number>(n).fill(0);
 for(const e of edges){mask[e.a]|=bit(e.sa);mask[e.b]|=bit(e.sb);}
 const ports:Port[]=[...inlets.map(p=>({s:p.side,i:edgeCell(p.side,p.at),out:false,c:p.c})),...outlets.map(p=>({s:p.side,i:edgeCell(p.side,p.at),out:true,c:0}))];
 for(const p of ports)mask[p.i]|=bit(p.s);
 const tiles:Tile[]=[],goal:number[]=[];
 for(let i=0;i<n;i++){
  const k=special.get(i);
  if(k==='bridge'){tiles.push({k:'bridge'});goal.push(0);}
  else if(k==='mirror'){tiles.push({k:'mirror'});goal.push(mirrorTurn.get(i)!);}
  else if(k==='prism'){tiles.push({k:'prism'});goal.push(0);}
  else{if(!mask[i])return null;const base=canonical(mask[i]);tiles.push({k:'pipe',m:base});goal.push(turnsFor(base,mask[i]));}
 }
 const board:Board={w,h,tiles,fixed:Array(n).fill(false),ports};
 // A prism takes white light through the face nearest the inlet.
 for(const [i,k] of special)if(k==='prism'){
  const graph=new Map<number,number[]>();
  for(const e of edges){graph.set(e.a,[...graph.get(e.a)??[],e.b]);graph.set(e.b,[...graph.get(e.b)??[],e.a]);}
  const from=new Map<number,number>(),queue=ports.filter(p=>!p.out).map(p=>p.i);for(const q of queue)from.set(q,-1);
  for(let k2=0;k2<queue.length;k2++){const at=queue[k2];if(at===i)break;for(const nx of graph.get(at)??[])if(!from.has(nx)){from.set(nx,at);queue.push(nx);}}
  const prev=from.get(i);if(prev===undefined||prev<0)return null;
  const side=[N,E,S,W].find(s=>net.nb(i,s)===prev)!;goal[i]=(side-W+4)&3;
 }
 return {board,goal,mask,r};
}

const subsets=(c:Hue)=>[1,2,3,4,5,6,7].filter(x=>(x&c)===x&&x!==c);
export function build(spec:Spec,seed:number):Built|null{
 const r=rng(seed),net=network(spec,r);if(!net)return null;
 const made=assemble(net,r);if(!made)return null;
 const {board,goal}=made,n=board.w*board.h;
 let light=shine(board,goal);
 // Merges join two differently coloured regions so their light mixes.
 for(let k=0;k<(spec.merges??0);k++){
  const options:[number,number][]=[];
  for(let i=0;i<n;i++)for(const s of [E,S]){const j=net.nb(i,s);if(j<0||board.tiles[i].k!=='pipe'||board.tiles[j].k!=='pipe')continue;const mi=rotateMask((board.tiles[i] as {m:number}).m,goal[i]),mj=rotateMask((board.tiles[j] as {m:number}).m,goal[j]);if(mi&bit(s)||light.lit[i]===light.lit[j]||!light.lit[i]||!light.lit[j]||(mi|bit(s))===15||(mj|bit(opposite(s)))===15)continue;options.push([i,s]);}
  if(!options.length)return null;
  const [i,s]=pick(r,options),j=net.nb(i,s);
  for(const [c,side] of [[i,s],[j,opposite(s)]] as const){const m=rotateMask((board.tiles[c] as {m:number}).m,goal[c])|bit(side),base=canonical(m);board.tiles[c]={k:'pipe',m:base};goal[c]=turnsFor(base,m);}
  light=shine(board,goal);
 }
 // Filters sit on straight runs that carry more than one colour.
 for(let k=0;k<(spec.filters??0);k++){
  const options=[...Array(n).keys()].filter(i=>{const t=board.tiles[i];return t.k==='pipe'&&t.m===5&&!board.ports.some(p=>p.i===i)&&subsets(light.lit[i]).length>0;});
  if(!options.length)return null;
  const i=pick(r,options),m=rotateMask(5,goal[i]);
  board.tiles[i]={k:'filter',c:pick(r,subsets(light.lit[i]))};goal[i]=m===5?1:0;
  light=shine(board,goal);
 }
 // Receivers replace end tiles; each needs exactly the colours that reach it.
 const ends=shuffle(r,[...Array(n).keys()].filter(i=>{const t=board.tiles[i];return t.k==='pipe'&&t.m===1&&!board.ports.some(p=>p.i===i);}));
 const chosen:number[]=[];
 for(const i of ends){if(chosen.length>=(spec.receivers??0))break;if(chosen.some(j=>light.lit[j]===light.lit[i])&&ends.some(k=>!chosen.includes(k)&&!chosen.some(j=>light.lit[j]===light.lit[k])&&k!==i))continue;chosen.push(i);}
 for(const i of chosen){const open=rotateMask(1,goal[i]),side=[N,E,S,W].find(s=>open&bit(s))!;board.tiles[i]={k:'recv',c:light.lit[i]};goal[i]=(side-W+4)&3;}
 light=shine(board,goal);
 board.ports.forEach((p,k)=>{if(p.out)p.c=light.got[k];});
 light=shine(board,goal);
 if(!light.radiant||board.ports.some(p=>p.out&&!p.c)||board.tiles.some(t=>t.k==='recv'&&!t.c))return null;
 // Fixed tiles never move; prefer ones that carry information.
 const fixable=shuffle(r,[...Array(n).keys()].filter(i=>turnable(board.tiles[i])&&board.tiles[i].k!=='prism'&&board.tiles[i].k!=='mirror'));
 for(const i of fixable.slice(0,spec.fixed??0))board.fixed[i]=true;
 // Scramble: most turnable tiles start away from their goal.
 const start=[...goal],share=spec.scramble??.8;
 for(let i=0;i<n;i++){
  const t=board.tiles[i];if(board.fixed[i]||!turnable(t))continue;
  if(r()<share){const others=distinctTurns(t).filter(x=>stateOf(t,x)!==stateOf(t,goal[i]));start[i]=pick(r,others);}
 }
 if(shine(board,start).solved){const i=[...Array(n).keys()].find(i=>!board.fixed[i]&&turnable(board.tiles[i])&&stateOf(board.tiles[i],start[i])===stateOf(board.tiles[i],goal[i]))
  ;if(i===undefined)return null;start[i]=distinctTurns(board.tiles[i]).find(x=>stateOf(board.tiles[i],x)!==stateOf(board.tiles[i],goal[i]))!;if(shine(board,start).solved)return null;}
 const minTurns=board.tiles.reduce((sum,t,i)=>sum+fewestTurns(t,start[i],goal[i]),0);
 return {...board,goal,start,minTurns};
}

// Generates until a board has exactly one radiant arrangement.
export function buildUnique(spec:Spec,seed:number,attempts=60):Built|null{
 for(let a=0;a<attempts;a++){
  const b=build(spec,seed*7919+a);if(!b)continue;
  const sol=solveRadiant(b,b.goal,2);
  if(sol.aborted||sol.count!==1)continue;
  return {...b,grade:grade(b,b.goal)};
 }
 return null;
}

// Quick boards for Drift and Pulse: channels only, always solvable, no proof of uniqueness.
export function quickBoard(seed:number,w:number,h:number,opts:{inRow?:number;outRow?:number;fixed?:number;corridor?:number;scramble?:number}={}):Built{
 for(let a=0;;a++){
  const b=build({w,h,inlets:[{side:W,at:opts.inRow,c:WHITE}],outlets:[{side:E,at:opts.outRow}],fixed:opts.fixed,corridor:opts.corridor??.65,scramble:opts.scramble??.7},seed*31+a);
  if(b)return b;
  if(a>200)throw Error('Quick board generation failed');
 }
}
export {AMBER,MINT,VIOLET};
