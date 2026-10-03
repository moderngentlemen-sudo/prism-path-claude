'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,Play,Send,RotateCcw} from 'lucide-react';
import {Board,type Arrival} from '@/app/board/Board';
import type {Palette} from '@/app/board/render';
import {audio,haptic} from '@/app/audio/engine';
import {shine} from '@/lib/optics';
import {startRun,apply,rate,type Action,type Run} from '@/lib/run';
import {pulseBoard,boardPoints,weekOf,PULSE_SECONDS,MAX_PULSE_BOARDS} from '@/lib/pulse';
import type {Settings} from '@/app/useSettings';
import type {Player} from '@/app/usePlayer';

const BEST='prism-pulse-best';
const storedBest=(week:number)=>{try{const b=JSON.parse(localStorage.getItem(BEST)||'null');return b?.week===week&&Number.isInteger(b.score)?b.score as number:0;}catch{return 0;}};
// Pulse: opt-in speed. Points live only here; the Journey never times you.
export function Pulse({settings,palette,player,onBack,onAccount}:{settings:Settings;palette:Palette;player:Player;onBack:()=>void;onAccount:()=>void}){
 const [week]=useState(weekOf),[best,setBest]=useState(()=>storedBest(weekOf()));
 const [phase,setPhase]=useState<'intro'|'run'|'done'>('intro'),[k,setK]=useState(0),[run,setRun]=useState<Run|null>(null),[score,setScore]=useState(0),[left,setLeft]=useState(PULSE_SECONDS),[sent,setSent]=useState(false),[boards,setBoards]=useState<Action[][]>([]);
 const startedAt=useRef(0),total=useRef(0),advance=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const board=useMemo(()=>pulseBoard(week,k),[week,k]);
 const light=useMemo(()=>run?shine(board,run.rot):null,[board,run]);
 const finish=(points:number)=>{
  setPhase('done');clearTimeout(advance.current);
  if(points>storedBest(week))try{localStorage.setItem(BEST,JSON.stringify({week,score:points}));}catch{}
  setBest(b=>Math.max(b,points));
 };
 const end=useRef(finish);
 useEffect(()=>{end.current=finish;});
 useEffect(()=>{
  if(phase!=='run')return;
  const t=setInterval(()=>{const l=Math.max(0,PULSE_SECONDS-(performance.now()-startedAt.current)/1000);setLeft(l);if(l<=0)end.current(total.current);},200);
  return()=>clearInterval(t);
 },[phase]);
 useEffect(()=>()=>clearTimeout(advance.current),[]);
 const begin=()=>{audio.unlock();clearTimeout(advance.current);total.current=0;setBoards([]);setScore(0);setK(0);setRun(startRun('pulse',pulseBoard(week,0)));setLeft(PULSE_SECONDS);setSent(false);startedAt.current=performance.now();setPhase('run');};
 const turn=(i:number,d:1|-1)=>{
  if(!run||phase!=='run'||light?.solved)return;audio.detent();
  let next:Run;try{next=apply(run,board,{k:'turn',i,d});}catch{return;}
  setRun(next);if(!shine(board,next.rot).solved)return;
  // Solved: bank the points and slide in the next board.
  const r=rate(next,board),done=[...boards,next.actions];total.current+=boardPoints(r.turns,board.minTurns);
  setScore(total.current);setBoards(done);audio.receiver();if(settings.haptics)haptic(true);
  if(done.length>=MAX_PULSE_BOARDS){finish(total.current);return;}
  const nextK=k+1;advance.current=setTimeout(()=>{setK(nextK);setRun(startRun('pulse',pulseBoard(week,nextK)));},settings.still?120:420);
 };
 const submit=async()=>{if(!player.data?.profile){onAccount();return;}const out=await player.pulse(week,boards,Math.min(PULSE_SECONDS,(performance.now()-startedAt.current)/1000));if(out)setSent(true);};
 return <main className="play pulse">
  <header className="play-top"><button className="round-button" onClick={onBack} aria-label="Back to the sky"><ChevronLeft size={20}/></button><div className="play-title"><h1>Pulse</h1><span>This week · best {best}</span></div><span className="pulse-score" aria-live="polite">{score}</span></header>
  {phase==='intro'&&<section className="pulse-intro"><p>Three minutes. Solve as many of this week’s boards as you can; everyone gets the same ones. Each board scores 100, plus up to 50 for using few turns.</p><p className="note">Pulse is optional. The Journey and the daily never time you.</p><button className="primary" onClick={begin}><Play size={16}/>Start</button></section>}
  {phase==='run'&&run&&light&&<>
   <div className="pulse-bar" role="timer" aria-label={`${Math.ceil(left)} seconds left`}><i style={{transform:`scaleX(${left/PULSE_SECONDS})`}}/><span>{Math.ceil(left)}s</span></div>
   <Board board={board} rot={run.rot} light={light} palette={palette} still={settings.still} patterns={settings.patterns} label={`Pulse board ${k+1}`} onTurn={turn} onNudge={()=>audio.detent(true)} onArrive={(t:Arrival[])=>audio.arrive(t)}/>
   <p className="caption"><span>Board {k+1} · light every target</span></p>
  </>}
  {phase==='done'&&<section className="pulse-intro"><h2>{score} points</h2><p>{boards.length} {boards.length===1?'board':'boards'} in three minutes.</p>
   {boards.length>0&&(sent?<p className="owned">Sent to this week’s board.</p>:<button className="primary" onClick={()=>void submit()} disabled={player.busy}><Send size={16}/>{player.data?.profile?'Send to this week’s board':'Connect to post your score'}</button>)}
   <button className="secondary" onClick={begin}><RotateCcw size={16}/>Run again</button></section>}
 </main>;
}
