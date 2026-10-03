'use client';
import {useState} from 'react';
import {ideas,weekdayIdeas} from '@/lib/content';
import {chainTo} from '@/lib/streaks';

const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const monthStart=(d:Date,offset:number)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,1));
const daysIn=(m:Date)=>new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+1,0)).getUTCDate();
export function DailyPanel({stars,today,streak,onPlay}:{stars:Record<string,number>;today:Date;streak:number;onPlay:()=>void}){
 const [offset,setOffset]=useState(0);
 const month=monthStart(today,offset);
 const days=daysIn(month),prefix=month.toISOString().slice(0,7),todayIso=today.toISOString().slice(0,10);
 const done=Object.keys(stars).filter(k=>k.startsWith('daily-')&&stars[k]>0).map(k=>k.slice(6));
 const frozen=new Set(done.length?chainTo(done,[...done].sort().at(-1)!).frozen:[]);
 const weekday=today.getUTCDay(),played=!!stars['daily-'+todayIso];
 return <div className="panel-body">
  <section className="daily-today"><span className="eyebrow">{weekdays[weekday]} · {ideas[weekdayIdeas[weekday]]}</span>
   <p className="note">Monday is gentle; each day adds an idea, and Sunday brings everything together. Results rank by fewest turns, never by time.</p>
   <button className="primary" onClick={onPlay}>{played?'Play again':'Play today’s puzzle'}</button>
   <p className="streak-line"><strong>{streak}</strong> day streak · one missed day a week is covered ❄</p>
  </section>
  <section className="calendar"><div className="calendar-head"><button className="round-button" aria-label="Previous month" onClick={()=>setOffset(o=>o-1)}>‹</button><h3>{month.toLocaleDateString(undefined,{month:'long',year:'numeric',timeZone:'UTC'})}</h3><button className="round-button" aria-label="Next month" disabled={offset>=0} onClick={()=>setOffset(o=>o+1)}>›</button></div>
   <div className="calendar-grid">{['S','M','T','W','T','F','S'].map((s,k)=><span key={'h'+k} aria-hidden="true" className="dow">{s}</span>)}{Array.from({length:month.getUTCDay()},(_,k)=><span key={'e'+k}/>)}{Array.from({length:days},(_,k)=>{const day=`${prefix}-${String(k+1).padStart(2,'0')}`,ok=done.includes(day),ice=frozen.has(day);return <span key={day} className={(ok?'done ':'')+(ice?'frozen ':'')+(day===todayIso?'today':'')} aria-label={`${day}${ok?', solved':ice?', covered by a freeze':''}${day===todayIso?', today':''}`}>{k+1}{ok?<small aria-hidden="true">✦</small>:ice?<small aria-hidden="true">❄</small>:null}</span>;})}</div>
  </section>
 </div>;
}
