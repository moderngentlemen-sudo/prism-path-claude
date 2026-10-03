import {rotate, turnsTo, type Puzzle} from './game.ts';
import {openingPuzzle} from './opening-puzzles.ts';
export type Color = 'mint'|'amber'|'violet';
export type JourneyPuzzle = Puzzle & {stage:number;paceSeconds:number;locked:number[]; filters:Record<number,Color>; receivers:{at:number;color:Color}[]; lesson:string;name?:string;legacy?:JourneyPuzzle};
export const paceBudget=(stage:number,par:number)=>stage<11?0:Math.max(25,Math.ceil(par*(6-4*Math.min(79,stage-11)/79)));
const steps=[[-1,0,1,4],[0,1,2,8],[1,0,4,1],[0,-1,8,2]];
export function illuminate(board:number[],p:JourneyPuzzle){
 const lit=new Set<number>(), colors:Record<number,Color[]>={}, depth:Record<number,number>={};
 const queue:{at:number;color:Color;distance:number}[]=[];const visited=new Set<string>();
 const add=(at:number,color:Color,distance:number)=>{color=p.filters[at]||color;const key=at+color;if(visited.has(key))return;visited.add(key);lit.add(at);(colors[at]??=[]).push(color);depth[at]=Math.min(depth[at]??Infinity,distance);queue.push({at,color,distance});};
 if(board[0]&8)add(0,'mint',0);
 for(let k=0;k<queue.length;k++){const {at,color,distance}=queue[k];const row=Math.floor(at/p.size),col=at%p.size;
  for(const [dr,dc,bit,opposite] of steps){const r=row+dr,c=col+dc,next=r*p.size+c;if(r>=0&&r<p.size&&c>=0&&c<p.size&&(board[at]&bit)&&(board[next]&opposite))add(next,color,distance+1);}
 }
 const received=p.receivers.filter(r=>colors[r.at]?.includes(r.color)).length;
 return {lit,colors,depth,received,solved:lit.has(board.length-1)&&!!(board[board.length-1]&2)&&received===p.receivers.length&&p.locked.every(at=>lit.has(at))};
}
export function enrich(base:Puzzle):JourneyPuzzle{
 const legacy=enrichLegacy(base);return base.id<=15?openingPuzzle(legacy):legacy;
}
export function enrichLegacy(base:Puzzle):JourneyPuzzle{
 const stage=base.id>90?10:base.id;
 const p:JourneyPuzzle={...base,stage,paceSeconds:0,initial:[...base.initial],solution:[...base.solution],path:[...base.path],locked:[],filters:{},receivers:[],lesson:'Connect the light to the exit. Only the route needs to connect.'};
 if(p.id<=3){p.size=3;p.path=[0,1,2,5,8];p.solution=[10,10,12,3,5,5,9,3,3];p.initial=[...p.solution];const targets=[[1],[1,2],[0,2,5]][p.id-1];for(const at of targets)p.initial[at]=rotate(p.solution[at]);p.lesson=['Tap the highlighted tile once. Its openings must meet the glowing path.','A corner changes direction. Turn the highlighted tiles until the light bends downward.','Now connect the whole route yourself. The glow shows how far the light can travel.'][p.id-1];}
 else {
  const tier=stage>=41?3:stage>=21?2:stage>=11?1:0;
  if(tier>=2){const used=new Set(p.path);let branch:{at:number;next:number;bit:number;opposite:number}|undefined;
   for(const at of p.path.slice(1,-1)){const row=Math.floor(at/p.size),col=at%p.size;for(const [dr,dc,bit,opposite] of steps){const r=row+dr,c=col+dc,next=r*p.size+c;if(r>=0&&r<p.size&&c>=0&&c<p.size&&!used.has(next)){branch={at,next,bit,opposite};break;}}if(branch)break;}
   if(branch){p.solution[branch.at]|=branch.bit;p.solution[branch.next]=branch.opposite;p.path.push(branch.next);p.receivers.push({at:branch.next,color:'mint'});}
   else {let linked=false;for(const at of p.path){for(const [dr,dc,bit,opposite] of steps){const r=Math.floor(at/p.size)+dr,c=at%p.size+dc,next=r*p.size+c;if(r>=0&&r<p.size&&c>=0&&c<p.size&&!(p.solution[at]&bit)){p.solution[at]|=bit;p.solution[next]|=opposite;p.receivers.push({at:next,color:'mint'});linked=true;break;}}if(linked)break;}}
   p.lesson='Split the beam: connect the diamond receiver and the exit. A three-way tile lights both branches.';
  }
  if(tier>=3){const color:Color=p.id%2?'amber':'violet';const main=p.path.filter(at=>at!==p.receivers[0]?.at);const filter=main[Math.max(1,Math.floor(main.length/2))];p.filters[filter]=color;p.receivers.push({at:p.size*p.size-1,color});p.lesson=`Route light through the ${color} prism (P), then into the matching ${color} receiver (A or V). Also light the other receiver.`;}
  if(stage>=61){const first=p.path[Math.floor((base.path.length-1)/3)],second=p.path[Math.floor((base.path.length-1)*2/3)];p.filters={[first]:'amber',[second]:'violet'};p.receivers.push({at:first,color:'amber'});p.lesson='Paired prisms: light the amber receiver (A), then carry violet light from the second prism (P) to the exit (V). Light every receiver.';}
  const lock=p.path[Math.max(1,Math.floor(p.path.length*.7))];if(tier>=1&&lock!==p.size*p.size-1&&!p.receivers.some(r=>r.at===lock))p.locked=[lock];
  if(tier===1)p.lesson='The padlock tile stays fixed. Turn its neighbors to carry the light through it.';
  p.initial=p.solution.map((m,i)=>p.locked.includes(i)?m:Array.from({length:(i+p.id)%3+1}).reduce<number>(v=>rotate(v),m));
  if(tier===0){p.initial=[...p.solution];for(const at of p.path.slice(0,Math.min(stage,8)))p.initial[at]=rotate(p.solution[at]);}
 }
 // The first fifteen campaign puzzles teach recognition before rotation endurance.
 // Spread the repair points along the route; the first fixed-tile level is a breather.
 if(p.id>=4&&p.id<=15){
  const counts=[3,4,4,5,5,6,6,3,4,5,6,7];
  const available=p.path.filter(at=>!p.locked.includes(at)&&rotate(p.solution[at])!==p.solution[at]);
  const count=Math.min(counts[p.id-4],available.length);
  for(const at of p.path)p.initial[at]=p.solution[at];
  for(let j=0;j<count;j++){
   const at=available[Math.floor(j*available.length/count)];
   p.initial[at]=rotate(rotate(rotate(p.solution[at])));
  }
 }
 if(stage>=61) p.receivers=p.receivers.map(r=>r.at===p.size*p.size-1?{...r,color:'violet'}:r);
 const expected=illuminate(p.solution,p);
 p.receivers=p.receivers.map(r=>({...r,color:expected.colors[r.at]?.includes(r.color)?r.color:expected.colors[r.at]?.[0]||r.color}));
 p.receivers=p.receivers.filter((r,i,all)=>all.findIndex(other=>other.at===r.at&&other.color===r.color)===i);
 p.par=p.path.reduce((v,i)=>v+(p.locked.includes(i)?0:turnsTo(p.initial[i],p.solution[i])),0);
 if(illuminate(p.initial,p).solved){const i=p.path.find(i=>!p.locked.includes(i)&&rotate(p.solution[i])!==p.solution[i])!;p.initial[i]=rotate(p.solution[i]);p.par=p.path.reduce((v,i)=>v+turnsTo(p.initial[i],p.solution[i]),0);}
 p.paceSeconds=paceBudget(stage,p.par);return p;
}
export function explainHint(board:number[],p:JourneyPuzzle){
 const signal=illuminate(board,p);if(signal.solved)return null;
 const candidates=p.path.filter(i=>!p.locked.includes(i)&&board[i]!==p.solution[i]);
 // Prefer a repair at the live frontier; preserve already-valid alternative solutions.
 const frontier=candidates.filter(i=>signal.lit.has(i)||i===0||steps.some(([dr,dc])=>{const r=Math.floor(i/p.size)+dr,c=i%p.size+dc;return r>=0&&r<p.size&&c>=0&&c<p.size&&signal.lit.has(r*p.size+c);}));
 const ranked=(frontier.length?frontier:candidates).map(at=>{const next=[...board];next[at]=p.solution[at];const result=illuminate(next,p);return {at,score:(result.solved?10000:0)+(result.received-signal.received)*100+result.lit.size-signal.lit.size};}).sort((a,b)=>b.score-a.score);
 const at=ranked[0]?.at;if(at===undefined)return null;
 const names=['up','right','down','left'];const openings=names.filter((_,i)=>p.solution[at]&(1<<i)).join(' and ');
 const missing=p.receivers.find(r=>!signal.colors[r.at]?.includes(r.color));
 const darkLock=p.locked.find(i=>!signal.lit.has(i));
 const reason=!(board[0]&8)?'The entrance is closed: light needs a west-facing opening.':missing?`The ${missing.color} receiver at row ${Math.floor(missing.at/p.size)+1}, column ${missing.at%p.size+1} still needs matching light.`:darkLock!==undefined?`The locked tile at row ${Math.floor(darkLock/p.size)+1}, column ${darkLock%p.size+1} must receive light. Rotate its neighbors to connect it.`:'The exit is not connected yet. Follow the edge of the glowing route.';
 return {at,text:`${reason} Try row ${Math.floor(at/p.size)+1}, column ${at%p.size+1}: aim the openings ${openings}. ${p.filters[at]?'This prism changes the passing light’s color.':'Match each opening to the neighboring tile.'}`};
}
export const canPlay=(index:number,stars:Record<string,number>,trial:boolean)=>index>=0&&index<90&&(index<30||index<33||trial)&&(index===0||index===30||!!stars[String(index)]||!!stars[String(index+1)]);
