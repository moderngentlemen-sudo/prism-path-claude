'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,Undo2,Lightbulb,RotateCcw,Settings2,ArrowRight,Sparkles,Share2,Star} from 'lucide-react';
import {Board,type Arrival} from '@/app/board/Board';
import {hueColor,type Palette} from '@/app/board/render';
import {audio,haptic} from '@/app/audio/engine';
import {shine,hueGlyph,hueName,cellName,openings,sidesOf,sideName} from '@/lib/optics';
import {startRun,apply,rate,turnsOf,serializeRun,restoreRun,type Action,type Run} from '@/lib/run';
import {hintFor,whereLightStops} from '@/lib/hints';
import {routeOf,type Route} from '@/lib/save';
import {statBucket,type StatKind} from '@/lib/analytics';
import type {Puzzle} from '@/lib/puzzle';
import type {Settings} from '@/app/useSettings';

const RUNS='prism-path-runs-v3';
function loadRun(p:Puzzle){try{const all=JSON.parse(localStorage.getItem(RUNS)||'{}');return restoreRun(all?.[p.key],p.key,p);}catch{return null;}}
function saveRun(r:Run,p:Puzzle){try{const all=JSON.parse(localStorage.getItem(RUNS)||'{}');all[p.key]=serializeRun(r,p);const keys=Object.keys(all);if(keys.length>40)delete all[keys[0]];localStorage.setItem(RUNS,JSON.stringify(all));}catch{}}
export function clearRuns(){try{localStorage.removeItem(RUNS);}catch{}}
type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
type ModelContext={registerTool:(t:Tool,options:{signal:AbortSignal})=>Promise<void>|void};

export type Outcome={key:string;stars:number;perfect:boolean;radiant:boolean;route:Route|null;actions:Action[];turns:number};
type Hint={stage:number;marks:number[];until:number;at:number;text:string};
const noHint:Hint={stage:0,marks:[],until:0,at:-1,text:''};
type Props={
 puzzle:Puzzle;title:string;subtitle:string;caption:string;best:number;settings:Settings;palette:Palette;
 showSky:boolean;nextLabel:string;story?:string;extra?:React.ReactNode;
 onBack?:()=>void;onNext:()=>void;onSettings:()=>void;onRecord:(o:Outcome)=>void;onShare?:(o:Outcome,progress:number[])=>void;
 stat:(p:string,k:StatKind,n?:number)=>void;dust?:{amount:number;label:string}|null;
};
// Mounted once per puzzle (the parent keys it), so a new puzzle starts from its saved run.
export function PlayScreen({puzzle:p,title,subtitle,caption,best,settings,palette,showSky,nextLabel,story,extra,onBack,onNext,onSettings,onRecord,onShare,stat,dust}:Props){
 const [init]=useState(()=>{const run=loadRun(p)??startRun(p.key,p),r=rate(run,p);return {run,stars:r.stars,solved:r.light.solved};});
 const [run,setRun]=useState(init.run),[hint,setHint]=useState(noHint),[results,setResults]=useState<Outcome|null>(null),[refining,setRefining]=useState(false);
 const [solvedAt,setSolvedAt]=useState(init.solved?-1e9:0),[confirmReset,setConfirmReset]=useState(false),[more,setMore]=useState(false);
 const recorded=useRef(init.stars),acted=useRef(false),progress=useRef<number[]>([]),lastTurn=useRef<{i:number;d:number;at:number}|null>(null),connected=useRef(false);
 const bucket=statBucket(p.key),n=p.tiles.length;
 const score=useMemo(()=>rate(run,p),[run,p]),light=score.light;
 useEffect(()=>{audio.setChapter(Math.max(0,p.chapter));stat(bucket,'start');},[p.chapter,bucket,stat]);
 useEffect(()=>()=>{if(recorded.current===0&&acted.current)stat(bucket,'quit');},[bucket,stat]);
 useEffect(()=>{audio.setBrightness(light.litCount/n);},[light,n]);
 // Every change passes through here: save it, then celebrate a solve and record any improvement.
 const commit=(next:Run)=>{
  setRun(next);saveRun(next,p);acted.current=true;
  const s=rate(next,p),l=s.light;progress.current.push(l.litCount/n);
  if(!connected.current&&l.satisfied>0){connected.current=true;stat(bucket,'connect');}
  if(!l.solved&&light.solved){setSolvedAt(0);setResults(null);setRefining(false);}
  const improved=s.stars>recorded.current,solvedNow=l.solved&&!light.solved;
  if(!improved&&!solvedNow){if(l.satisfied>light.satisfied)audio.receiver();return;}
  const outcome:Outcome={key:p.key,stars:s.stars,perfect:s.perfect,radiant:s.radiant,route:routeOf(p,l),actions:next.actions,turns:s.turns};
  if(improved){
   if(recorded.current===0){stat(bucket,'solve');stat(bucket,'lit',Math.min(50,l.litCount));}
   if(s.stars===3)stat(bucket,'radiant');if(s.perfect)stat(bucket,'perfect');
   recorded.current=s.stars;onRecord(outcome);
  }
  if(solvedNow){setSolvedAt(performance.now());const lit=[...Array(n).keys()].filter(i=>l.lit[i]).sort((a,b)=>l.depth[a]-l.depth[b]);audio.complete(lit.map(i=>l.depth[i]),lit.map(i=>l.lit[i]),s.radiant);}
  else if(s.radiant)audio.complete([0,2,4,7,9],[0,0,0,0,0],true);
  if(settings.haptics)haptic(true);
  setResults(outcome);setRefining(false);
 };
 const act=(a:Action)=>{
  audio.unlock();
  let next:Run;try{next=apply(run,p,a);}catch{return;}
  commit(next);
  if(hint.stage===2&&a.k!=='undo'&&a.i===hint.at)setHint(noHint);
 };
 const turn=(i:number,d:1|-1)=>{
  const now=performance.now(),prev=lastTurn.current;
  if(prev&&prev.i===i&&prev.d===-d&&now-prev.at<2000)stat(bucket,'reverse');
  lastTurn.current={i,d,at:now};audio.detent();if(settings.haptics)haptic();act({k:'turn',i,d});
 };
 const undo=()=>{if(!run.history.length)return;stat(bucket,'undo');act({k:'undo'});};
 // Hints arrive in three steps: where the light stops, what to fix, then a fix if wanted.
 const nudge=()=>{
  if(light.radiant)return;audio.unlock();
  if(hint.stage===0){setHint({stage:1,marks:whereLightStops(p,run.rot),until:performance.now()+4500,at:-1,text:'The highlighted tiles are where the light stops or escapes.'});return;}
  const h=hintFor(p,run.rot);if(!h)return;stat(bucket,'hint');setHint({stage:2,marks:[],until:0,at:h.at,text:h.text});
 };
 const autoTurn=()=>{if(hint.at<0)return;act({k:'hint',i:hint.at});setHint(noHint);};
 const reset=()=>{const fresh=startRun(p.key,p);setRun(fresh);saveRun(fresh,p);setConfirmReset(false);setHint(noHint);setResults(null);setRefining(false);setSolvedAt(0);progress.current=[];};
 const arrive=(tiles:Arrival[])=>audio.arrive(tiles);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,[role=dialog]'))return;
   if((e.key==='z'&&(e.metaKey||e.ctrlKey))||e.key==='u'||e.key==='U'){e.preventDefault();undo();}
   else if(e.key==='h'||e.key==='H')nudge();
   else if((e.key==='n'||e.key==='N')&&score.stars>0)onNext();
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });
 // Agents can read and turn the board through WebMCP where the browser offers it.
 const live=useRef({p,run,commit});
 useEffect(()=>{live.current={p,run,commit};});
 useEffect(()=>{
  const context=(document as Document&{modelContext?:ModelContext}).modelContext;if(!context?.registerTool)return;
  const life=new AbortController(),register=(tool:Tool)=>{try{void Promise.resolve(context.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{}};
  const view=()=>{const {p,run}=live.current,l=shine(p,run.rot);return {puzzle:p.key,width:p.w,height:p.h,
   tiles:p.tiles.map((t,i)=>({kind:t.k,...('c' in t?{colour:hueName(t.c)}:{}),pinned:p.fixed[i],rotation:run.rot[i],openings:sidesOf(openings(t,run.rot[i])).map(sideName),lit:hueName(l.lit[i])})),
   ports:p.ports.map(q=>({tile:q.i,side:sideName(q.s),kind:q.out?'outlet':'inlet',colour:hueName(q.c)})),turns:turnsOf(run),solved:l.solved,radiant:l.radiant,leaks:l.leaks.length};};
  register({name:'read_prism_puzzle',description:'Read the current puzzle: tiles row by row with zero-based indices, their rotations and openings, the ports, and which tiles are lit.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:view});
  register({name:'rotate_prism_tiles',description:'Turn the listed zero-based tile indices a quarter turn each, in order, on the current puzzle: clockwise, or anticlockwise when direction is -1. Stops once solved.',
   inputSchema:{type:'object',properties:{indices:{type:'array',items:{type:'integer',minimum:0},minItems:1,maxItems:100},direction:{type:'integer',enum:[1,-1]}},required:['indices'],additionalProperties:false},annotations:{readOnlyHint:false},
   execute:(input:unknown)=>{
    const v=input as {indices?:unknown[];direction?:unknown},{p}=live.current;
    if(!v||!Array.isArray(v.indices)||v.indices.length<1||v.indices.length>100||v.indices.some(i=>!Number.isInteger(i)||(i as number)<0||(i as number)>=p.tiles.length))throw new Error('Provide 1–100 valid tile indices');
    const d=v.direction===-1?-1:1;let r=live.current.run;
    for(const i of v.indices as number[]){if(shine(p,r.rot).solved)break;try{r=apply(r,p,{k:'turn',i,d});}catch{}}
    live.current.commit(r);live.current={...live.current,run:r};return view();
   }});
  return()=>life.abort();
 },[]);
 const objectives=[
  ...p.ports.flatMap((q,k)=>q.out?[{id:'o'+k,at:q.i,outlet:true,ok:light.got[k]===q.c,wrong:!!light.got[k]&&light.got[k]!==q.c,need:q.c}]:[]),
  ...p.tiles.flatMap((t,i)=>t.k==='recv'?[{id:'r'+i,at:i,outlet:false,ok:light.recv[i]===t.c,wrong:!!light.recv[i]&&light.recv[i]!==t.c,need:t.c}]:[]),
 ];
 const dark=n-light.litCount,leaks=light.leaks.length;
 const status=light.radiant?'Radiant: every tile lit and no light escaping.':light.solved?`Every target lit. ${leaks} ${leaks===1?'leak':'leaks'} and ${dark} dark ${dark===1?'tile':'tiles'} left for a third star.`:`${light.satisfied} of ${light.objectives} ${light.objectives===1?'target':'targets'} lit · ${light.litCount} of ${n} tiles glowing.`;
 const stars=Math.max(best,score.stars);
 return <main className="play">
  <header className="play-top">
   {showSky&&onBack?<button id="sky-button" className="round-button" onClick={onBack} aria-label="Back to the sky"><ChevronLeft size={20}/></button>:<span className="brand-mark" aria-hidden="true">◈</span>}
   <div className="play-title"><h1>{title}</h1><span>{subtitle}</span></div>
   <span className="stars" aria-label={`Best: ${stars} of 3 stars`}>{[1,2,3].map(k=><Star key={k} size={15} fill={k<=stars?'currentColor':'none'}/>)}</span>
   <button className="round-button" onClick={onSettings} aria-label="Settings"><Settings2 size={19}/></button>
  </header>
  <p className={'caption'+(more?' open':'')}><span>{caption}</span>{caption.length>70&&<button className="text-button" onClick={()=>setMore(v=>!v)} aria-expanded={more}>{more?'Less':'More'}</button>}</p>
  <Board board={p} rot={run.rot} light={light} palette={palette} still={settings.still} patterns={settings.patterns} marks={hint.marks} markUntil={hint.until} hintAt={hint.at} solvedAt={solvedAt} label={`${title}. ${status}`} onTurn={turn} onNudge={()=>audio.detent(true)} onArrive={arrive}/>
  <div className="objectives" aria-label="Targets">
   {objectives.map(o=><button key={o.id} className={'chip'+(o.ok?' ok':o.wrong?' wrong':'')} onClick={()=>setHint({stage:1,marks:[o.at],until:performance.now()+2500,at:-1,text:`${o.outlet?'This outlet':`The receiver at ${cellName(p,o.at)}`} needs ${hueName(o.need)} light, exactly.`})} aria-label={`${o.outlet?'Outlet':'Receiver'} needing ${hueName(o.need)}: ${o.ok?'lit':o.wrong?'wrong colour':'dark'}`}><b>{o.outlet?'Outlet ':''}<span style={{color:hueColor(palette,o.need)}}>{hueGlyph(o.need)}</span></b>{o.ok?' ✓':o.wrong?' ✕':''}</button>)}
   {light.solved&&<span className={'chip'+(light.radiant?' ok':'')} aria-label={light.radiant?'Sealed':`${leaks} leaks, ${dark} dark tiles`}>{light.radiant?'Sealed ✓':`${leaks} ${leaks===1?'leak':'leaks'} · ${dark} dark`}</span>}
  </div>
  <p className="sr-only" aria-live="polite">{status}</p>
  {hint.text&&!results&&<div className="hint-card" aria-live="polite"><p>{hint.text}</p>{hint.stage===2&&<button className="text-button" onClick={autoTurn}>Turn it for me</button>}<button className="text-button" onClick={()=>setHint(noHint)}>Got it</button></div>}
  {results&&!refining?<section className="results" aria-label="Puzzle results">
   <div className="results-head"><span className="eyebrow">{results.stars===3?(results.perfect?'Perfect':'Radiant'):'Path complete'}</span><span className="result-stars" aria-label={`${results.stars} of 3 stars`}>{[1,2,3].map(k=><Star key={k} size={22} fill={k<=results.stars?'currentColor':'none'}/>)}</span></div>
   <p>{results.turns} {results.turns===1?'turn':'turns'} · fewest possible {p.minTurns}{run.hints?` · ${run.hints} automatic ${run.hints===1?'turn':'turns'}`:''}{dust?` · +${dust.amount} ✧`:''}</p>
   {story&&<p className="story">{story}</p>}
   {results.stars<3&&!run.hints&&<p className="results-tip">Light every tile and let no light escape for the third star.</p>}
   {results.stars<3&&run.hints>0&&<p className="results-tip">Solve it without automatic turns to earn more stars.</p>}
   <div className="results-actions">
    <button className="primary" onClick={onNext}>{nextLabel}<ArrowRight size={17}/></button>
    {results.stars<3&&!run.hints&&<button className="secondary" onClick={()=>setRefining(true)}><Sparkles size={16}/>Keep refining</button>}
    {run.hints>0&&<button className="secondary" onClick={reset}><RotateCcw size={16}/>Try again</button>}
    {onShare&&<button className="secondary" onClick={()=>onShare(results,progress.current)}><Share2 size={16}/>Share</button>}
   </div>
   {extra}
  </section>:<nav className="thumb-bar" aria-label="Puzzle tools">
   <button onClick={undo} disabled={!run.history.length}><Undo2 size={19}/><span>Undo</span></button>
   <button onClick={nudge} disabled={light.radiant}><Lightbulb size={19}/><span>{hint.stage===0?'Hint':'Explain'}</span></button>
   <button onClick={()=>setConfirmReset(true)} disabled={!run.actions.length}><RotateCcw size={19}/><span>Reset</span></button>
   {refining&&results&&<button onClick={()=>setRefining(false)}><Star size={19}/><span>Results</span></button>}
  </nav>}
  {confirmReset&&<div className="confirm" role="alertdialog" aria-label="Reset this puzzle?"><p>Start this board again? Your stars stay safe.</p><div><button className="primary" onClick={reset}>Reset board</button><button className="secondary" onClick={()=>setConfirmReset(false)}>Keep playing</button></div></div>}
 </main>;
}
