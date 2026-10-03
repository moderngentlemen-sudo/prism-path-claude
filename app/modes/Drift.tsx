'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,Undo2,HandHelping,SkipForward,Settings2} from 'lucide-react';
import {Board,type Arrival} from '@/app/board/Board';
import type {Palette} from '@/app/board/render';
import {audio,haptic} from '@/app/audio/engine';
import {quickBoard} from '@/lib/generator';
import {shine} from '@/lib/optics';
import {startRun,apply,type Action,type Run} from '@/lib/run';
import {hintFor} from '@/lib/hints';
import {routeOf,type Route} from '@/lib/save';
import type {Settings} from '@/app/useSettings';

// Drift: endless, unscored boards. Each solved board slides away and the beam
// continues into the next one from the row where it left.
type Size=4|5|6;
type DriftSave={index:number;size:Size;nextSize?:Size;inRow:number;actions:Action[];trails:Route[]};
const KEY='prism-drift-v1',sizes=[{size:4,label:'Small paths'},{size:5,label:'Flowing paths'},{size:6,label:'Open sky'}] as const;
const boardFor=(index:number,size:Size,inRow:number)=>quickBoard(50000+index*7,size,size,{inRow:Math.min(inRow,size-1),scramble:.6});
const replay=(board:ReturnType<typeof boardFor>,actions:Action[])=>{let r:Run=startRun('drift',board);for(const a of actions){try{r=apply(r,board,a);}catch{break;}}return r;};
const sizeOf=(v:unknown)=>([4,5,6] as const).find(s=>s===v);
function restore():DriftSave{
 const blank:DriftSave={index:0,size:4,inRow:1,actions:[],trails:[]};
 try{
  const v=JSON.parse(localStorage.getItem(KEY)||'null') as DriftSave|null;if(!v||!Number.isSafeInteger(v.index)||v.index<0)return blank;
  const s:DriftSave={index:v.index,size:sizeOf(v.size)??4,nextSize:sizeOf(v.nextSize),inRow:Number.isInteger(v.inRow)?v.inRow:1,actions:Array.isArray(v.actions)?v.actions.slice(0,500):[],trails:Array.isArray(v.trails)?v.trails.slice(-120):[]};
  // A board left solved (the page closed mid-slide) moves straight on to the next one.
  const b=boardFor(s.index,s.size,s.inRow);
  return shine(b,replay(b,s.actions).rot).solved?{...s,index:s.index+1,size:s.nextSize??s.size,actions:[]}:s;
 }catch{return blank;}
}
export function Drift({settings,palette,onBack,onSettings}:{settings:Settings;palette:Palette;onBack:()=>void;onSettings:()=>void}){
 const [save,setSave]=useState<DriftSave>(restore),[leaving,setLeaving]=useState(false),[help,setHelp]=useState(-1);
 const leave=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const {index,size,inRow,actions}=save;
 const board=useMemo(()=>boardFor(index,size,inRow),[index,size,inRow]);
 const run=useMemo(()=>replay(board,actions),[board,actions]);
 const light=useMemo(()=>shine(board,run.rot),[board,run.rot]);
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(save));}catch{}},[save]);
 useEffect(()=>{audio.setChapter(index%9);},[index]);
 useEffect(()=>{audio.setBrightness(light.litCount/board.tiles.length);},[light,board]);
 useEffect(()=>()=>clearTimeout(leave.current),[]);
 const act=(a:Action)=>{
  audio.unlock();if(leaving)return;
  let next:Run;try{next=apply(run,board,a);}catch{return;}
  setSave(s=>({...s,actions:[...s.actions,a]}));
  const l=shine(board,next.rot);if(!l.solved)return;
  // Solved: the route plays, the board slides away, and the beam carries on from its outlet row.
  const lit=[...l.lit.keys()].filter(i=>l.lit[i]).sort((x,y)=>l.depth[x]-l.depth[y]);
  audio.complete(lit.map(i=>l.depth[i]),lit.map(i=>l.lit[i]),false);if(settings.haptics)haptic(true);
  const route=routeOf(board,l),out=board.ports.find(q=>q.out)!,row=Math.floor(out.i/board.w);
  setLeaving(true);setHelp(-1);
  leave.current=setTimeout(()=>{setLeaving(false);setSave(s=>{const size=s.nextSize??s.size;return {index:s.index+1,size,inRow:Math.min(row,size-1),actions:[],trails:[...s.trails,...(route?[route]:[])].slice(-120)};});},settings.still?400:1300);
 };
 const turn=(i:number,d:1|-1)=>{audio.detent();if(settings.haptics)haptic();setHelp(-1);act({k:'turn',i,d});};
 const assist=()=>{const h=hintFor(board,run.rot);if(!h)return;setHelp(h.at);act({k:'hint',i:h.at});};
 const skip=()=>setSave(s=>({...s,index:s.index+1,size:s.nextSize??s.size,actions:[]}));
 const chosen=save.nextSize??save.size;
 return <main className="play drift">
  <header className="play-top"><button className="round-button" onClick={onBack} aria-label="Back to the sky"><ChevronLeft size={20}/></button><div className="play-title"><h1>Drift</h1><span>{save.trails.length} {save.trails.length===1?'path':'paths'} so far</span></div><button className="round-button" onClick={onSettings} aria-label="Settings"><Settings2 size={19}/></button></header>
  <p className="caption"><span>No timer, no score. Let the openings meet; help is always free.</span></p>
  <div key={index} className={'drift-stage'+(leaving?' leaving':'')}>
   <Board board={board} rot={run.rot} light={light} palette={palette} still={settings.still} patterns={settings.patterns} hintAt={help} label="Drift board" onTurn={turn} onNudge={()=>audio.detent(true)} onArrive={(t:Arrival[])=>audio.arrive(t)}/>
  </div>
  <div className="drift-sizes" aria-label="Size of the next board">{sizes.map(o=><button key={o.size} aria-pressed={chosen===o.size} className={'choice'+(chosen===o.size?' selected':'')} onClick={()=>setSave(s=>({...s,nextSize:o.size}))}>{o.label}</button>)}</div>
  <nav className="thumb-bar" aria-label="Drift tools">
   <button onClick={()=>act({k:'undo'})} disabled={!run.history.length||leaving}><Undo2 size={19}/><span>Undo</span></button>
   <button onClick={assist} disabled={light.solved||leaving}><HandHelping size={19}/><span>Help me</span></button>
   <button onClick={skip} disabled={leaving}><SkipForward size={19}/><span>Another path</span></button>
  </nav>
  <DriftSky trails={save.trails}/>
 </main>;
}
// The latest drifts, drawn side by side as one ribbon of light.
function DriftSky({trails}:{trails:Route[]}){
 if(!trails.length)return null;
 const shown=trails.slice(-16),w=shown.length*60+20;
 return <figure className="drift-sky" aria-label={`Your drift: ${trails.length} paths`}><svg viewBox={`0 0 ${w} 80`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">{shown.map((t,k)=><polyline key={k} points={t.cells.map(c=>`${10+k*60+(c%t.w)/(Math.max(1,t.w-1))*50},${10+Math.floor(c/t.w)/(Math.max(1,t.h-1))*60}`).join(' ')} className="trail"/>)}</svg></figure>;
}
