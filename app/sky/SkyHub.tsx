'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Sun,ShoppingBag,User,Settings2,Lock,Star,Waves,Timer,ArrowRight} from 'lucide-react';
import {constellationNames,ideas,campaign,weekdayIdeas} from '@/lib/content';
import {shapes,starAt,strokeBetween,placements,SKY_W,SKY_H} from '@/lib/sky';
import {story} from '@/lib/story';
import {canPlay,chapterOpen,solved,type Route} from '@/lib/save';

type Props={still:boolean;stars:Record<string,number>;routes:Record<string,Route>;fullSky:boolean;initial:number;stardust:number;streak:number;dailyDone:boolean;showModes:boolean;showShop:boolean;
 onPlay:(index:number)=>void;onDaily:()=>void;onDrift:()=>void;onPulse:()=>void;onShop:()=>void;onPlayer:()=>void;onSettings:()=>void;onFullSky:()=>void};
// The map frames the selected constellation and glides between them.
const VIEW_W=640,VIEW_H=540;
const frameFor=(c:number)=>({x:Math.max(0,Math.min(SKY_W-VIEW_W,placements[c][0]-VIEW_W/2)),y:Math.max(0,Math.min(SKY_H-VIEW_H,placements[c][1]-VIEW_H/2+20))});
// Faint background stars, the same every visit.
const dust=Array.from({length:140},(_,k)=>{const r=(n:number)=>{const x=Math.sin(k*12.9898+n*78.233)*43758.5453;return x-Math.floor(x);};return {x:r(1)*SKY_W,y:r(2)*SKY_H,s:.6+r(3)*1.6,o:.15+r(4)*.45};});
export function SkyHub({still,stars,routes,fullSky,initial,stardust,streak,dailyDone,showModes,showShop,onPlay,onDaily,onDrift,onPulse,onShop,onPlayer,onSettings,onFullSky}:Props){
 const [selected,setSelected]=useState(initial),[glide,setGlide]=useState(()=>frameFor(initial)),shown=useRef(glide);
 useEffect(()=>{
  if(still)return;
  const to=frameFor(selected),from=shown.current,start=performance.now();let raf=0;
  const step=(now:number)=>{const t=Math.min(1,(now-start)/520),e=1-Math.pow(1-t,3),v={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e};shown.current=v;setGlide(v);if(t<1)raf=requestAnimationFrame(step);};
  raf=requestAnimationFrame(step);return()=>cancelAnimationFrame(raf);
 },[selected,still]);
 const view=still?frameFor(selected):glide;
 // Keep the chosen constellation's tab in view without scrolling the page.
 const picker=useRef<HTMLDivElement>(null);
 useEffect(()=>{const el=picker.current,tab=el?.querySelector<HTMLElement>('[aria-selected="true"]');if(el&&tab)el.scrollTo({left:tab.offsetLeft-(el.clientWidth-tab.clientWidth)/2,behavior:still?'auto':'smooth'});},[selected,still]);
 const total=Object.entries(stars).filter(([k])=>/^\d+$/.test(k)).reduce((s,[,v])=>s+v,0);
 const counts=useMemo(()=>shapes.map((_,c)=>Array.from({length:10},(_,k)=>solved(stars,c*10+k)).filter(Boolean).length),[stars]);
 const open=chapterOpen(selected,fullSky),next=Array.from({length:10},(_,k)=>selected*10+k).find(i=>canPlay(i,stars,fullSky)&&!solved(stars,i));
 const weekday=new Date().getUTCDay();
 return <main className={'hub atmo-'+selected}>
  <header className="hub-top"><span className="wordmark"><span className="brand-mark">◈</span> PRISM PATH</span>
   <span className="hub-stats"><span aria-label={`${total} stars`}><Star size={14} fill="currentColor"/>{total}</span><span aria-label={`${stardust} Stardust`}>✧ {stardust}</span></span>
   <nav className="hub-actions" aria-label="Menu">
    <button className="round-button" onClick={onDaily} aria-label="Daily puzzle"><Sun size={18}/></button>
    {showShop&&<button className="round-button" onClick={onShop} aria-label="Shop"><ShoppingBag size={18}/></button>}
    <button className="round-button" onClick={onPlayer} aria-label="Player and friends"><User size={18}/></button>
    <button className="round-button" onClick={onSettings} aria-label="Settings"><Settings2 size={18}/></button>
   </nav>
  </header>
  <div className="hub-layout">
   <div className="sky-map">
    <p className="sr-only">{`Star map: ${counts.filter(c=>c===10).length} of 9 constellations restored.`}</p>
    <svg viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
     {dust.map((d,k)=><circle key={k} cx={d.x} cy={d.y} r={d.s} fill="#cfe7ff" opacity={d.o}/>)}
     <path className="sky-trail" d={'M'+placements.map(([x,y])=>`${x} ${y}`).join(' L')} fill="none"/>
     {shapes.map((shape,c)=>{const locked=!chapterOpen(c,fullSky),n=counts[c];return <g key={c} className={'constellation'+(locked?' locked':'')+(c===selected?' selected':'')+(n===10?' complete':'')} onClick={()=>setSelected(c)} role="presentation">
      <rect x={placements[c][0]-190} y={placements[c][1]-120} width={380} height={250} fill="transparent"/>
      <svg x={placements[c][0]-150} y={placements[c][1]-150} width={300} height={300} viewBox={`${c%3*300} ${Math.floor(c/3)*300} 300 300`} className="constellation-art" style={{opacity:locked?.05:n===10?.6:.06+n*.025}} aria-hidden="true"><image href="/constellation-art.webp" width={900} height={900}/></svg>
      {shape.slice(1).map((_,k)=>{const a=starAt(c,k),b=starAt(c,k+1),lit=solved(stars,c*10+k)&&solved(stars,c*10+k+1);return lit?<g key={k}><path d={strokeBetween(a,b,routes[String(c*10+k+2)])} className="stroke-glow"/><path d={strokeBetween(a,b,routes[String(c*10+k+2)])} className="stroke"/></g>:<path key={k} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} className="stroke-dim"/>;})}
      {shape.map((_,k)=>{const {x,y}=starAt(c,k),s=stars[String(c*10+k+1)]??0;return <g key={k} transform={`translate(${x} ${y})`}>{s>0&&<circle r={14} className="star-halo"/>}<circle r={s?5+s:3.2} className={s?'star-lit':'star-dark'}/>{s===3&&<path d="M-13 0H13M0-13V13" className="star-cross"/>}</g>;})}
      <text x={placements[c][0]} y={placements[c][1]+128} textAnchor="middle" className="constellation-name">{constellationNames[c]}{locked?' 🔒':''}</text>
     </g>;})}
    </svg>
    <div ref={picker} className="sky-picker" role="tablist" aria-label="Constellations">{constellationNames.map((name,c)=><button key={name} role="tab" aria-selected={c===selected} className={c===selected?'selected':''} onClick={()=>setSelected(c)}>{name}<small>{chapterOpen(c,fullSky)?`${counts[c]}/10`:'Full Sky'}</small></button>)}</div>
   </div>
   <aside className="hub-side">
    <section className="constellation-card" aria-live="polite">
     <span className="eyebrow">{ideas[selected]} · {counts[selected]}/10</span><h2>{constellationNames[selected]}</h2>
     {counts[selected]===10&&<p className="story">{story[selected]}</p>}
     {open?<>
      <div className="puzzle-stars">{Array.from({length:10},(_,k)=>{const i=selected*10+k,s=stars[String(i+1)]??0,ok=canPlay(i,stars,fullSky);return <button key={i} disabled={!ok} onClick={()=>onPlay(i)} aria-label={`Puzzle ${i+1}, ${campaign[i]?.name}: ${s?`${s} stars`:ok?'ready':'locked'}`} className={s?'done':ok?'ready':''}><b>{i+1}</b><small>{s?'★'.repeat(s):ok?'•':'·'}</small></button>;})}</div>
      {next!==undefined?<button className="primary" onClick={()=>onPlay(next)}>Play {next+1} · {campaign[next].name}<ArrowRight size={16}/></button>:counts[selected]===10?<>
       <p className="note">Every star here is lit. Replay any puzzle to chase a radiant board.</p>
       {selected<8&&<button className="primary" onClick={()=>setSelected(selected+1)}>On to {constellationNames[selected+1]}<ArrowRight size={16}/></button>}
      </>:<p className="note">Finish the constellation before it to open this one.</p>}
     </>:<><p className="note">Part of Full Sky: six constellations of mirrors, prisms, mixing, twin inlets and filters.</p><button className="primary" onClick={onFullSky}><Lock size={15}/>See Full Sky</button></>}
    </section>
    <button className="mode-card" onClick={onDaily}><Sun size={22}/><span><strong>Today · {ideas[weekdayIdeas[weekday]]}</strong><small>{dailyDone?'Solved today':'One puzzle a day'} · {streak} day streak</small></span><ArrowRight size={16}/></button>
    {showModes&&<><button className="mode-card" onClick={onDrift}><Waves size={22}/><span><strong>Drift</strong><small>Endless, unscored paths. Help is always free.</small></span><ArrowRight size={16}/></button>
     <button className="mode-card" onClick={onPulse}><Timer size={22}/><span><strong>Pulse</strong><small>Three minutes against this week’s boards.</small></span><ArrowRight size={16}/></button></>}
   </aside>
  </div>
 </main>;
}
