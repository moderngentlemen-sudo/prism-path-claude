'use client';
import {useState} from 'react';
import {Switch} from '@/components/ui/switch';
import {Slider} from '@/components/ui/slider';
import {audio,canVibrate} from '@/app/audio/engine';
import {instrumentNames,type InstrumentId} from '@/lib/music';
import {palettes} from '@/lib/rewards';
import {constellationNames} from '@/lib/content';
import type {Settings} from '@/app/useSettings';

const tracks=[{id:'quiet-orbit',name:'Quiet Orbit',needs:''},{id:'moonrise',name:'Moonrise',needs:'music'},{id:'drift',name:'Drift',needs:'music'}];
function Toggle({id,label,note,checked,onChange}:{id:string;label:string;note?:string;checked:boolean;onChange:(v:boolean)=>void}){
 return <div className="setting"><label htmlFor={id}>{label}{note&&<small>{note}</small>}</label><Switch id={id} checked={checked} onCheckedChange={onChange}/></div>;
}
export function SettingsPanel({settings,update,owned,earnedPalettes,onRestart}:{settings:Settings;update:(p:Partial<Settings>)=>void;owned:string[];earnedPalettes:string[];onRestart:()=>void}){
 const [confirm,setConfirm]=useState(false);
 const instruments=(Object.keys(instrumentNames) as InstrumentId[]).filter(id=>id==='piano'||owned.includes(id));
 return <div className="panel-body">
  <section><h3>Sound</h3>
   <Toggle id="set-effects" label="Tile sounds and melody" note="Each lit tile plays a note." checked={settings.effects} onChange={v=>update({effects:v})}/>
   <Toggle id="set-music" label="Music" checked={settings.music} onChange={v=>update({music:v})}/>
   <label id="set-volume-label" className="setting-label">Music volume · {Math.round(settings.volume*100)}%</label>
   <Slider aria-labelledby="set-volume-label" value={[Math.round(settings.volume*100)]} min={0} max={100} step={1} onValueChange={v=>update({volume:(Array.isArray(v)?v[0]:v)/100})}/>
   <fieldset className="choices"><legend>Melody instrument</legend>{instruments.map(id=><button key={id} className={'choice'+(settings.instrument===id?' selected':'')} aria-pressed={settings.instrument===id} onClick={()=>{update({instrument:id});audio.preview(id);}}>{instrumentNames[id]}</button>)}</fieldset>
   <fieldset className="choices"><legend>Background track</legend>{tracks.filter(t=>!t.needs||owned.includes(t.needs)).map(t=><button key={t.id} className={'choice'+(settings.track===t.id?' selected':'')} aria-pressed={settings.track===t.id} onClick={()=>update({track:t.id})}>{t.name}</button>)}</fieldset>
  </section>
  <section><h3>Light and colour</h3>
   <Toggle id="set-still" label="Still light" note="No animation; light appears at once." checked={settings.still} onChange={v=>update({still:v})}/>
   <fieldset className="choices"><legend>Beam colours</legend>{(['standard','contrast'] as const).map(c=><button key={c} className={'choice'+(settings.colours===c?' selected':'')} aria-pressed={settings.colours===c} onClick={()=>update({colours:c})}>{c==='standard'?'Standard':'High contrast'}</button>)}</fieldset>
   <Toggle id="set-patterns" label="Light patterns" note="Amber ▲ beams are dotted and violet ■ beams dashed; mint ● stays solid." checked={settings.patterns} onChange={v=>update({patterns:v})}/>
   <fieldset className="choices"><legend>Palette</legend>{palettes.map(p=>{const open=p.id==='mint'||earnedPalettes.includes(p.id);return <button key={p.id} className={'choice'+(settings.theme===p.id?' selected':'')} aria-pressed={settings.theme===p.id} disabled={!open} onClick={()=>update({theme:p.id})}><i className="swatch" style={{background:p.color}}/>{p.name}{!open&&<small>Complete {constellationNames[p.chapter]}</small>}</button>;})}</fieldset>
  </section>
  {canVibrate()&&<section><h3>Touch</h3><Toggle id="set-haptics" label="Vibration" checked={settings.haptics} onChange={v=>update({haptics:v})}/></section>}
  <section><h3>Controls</h3><p className="note">Tap a tile to turn it clockwise. Press and hold, right-click or tap with two fingers to turn it back. With a keyboard: arrows move, Enter turns, Shift+Enter or Q turns back, U undoes, H asks for a hint.</p></section>
  <section><h3>Privacy</h3><Toggle id="set-stats" label="Share anonymous puzzle statistics" note="Counts of starts, solves and hints per puzzle. No account, device ID or address is sent." checked={settings.stats} onChange={v=>update({stats:v})}/></section>
  <section><h3>Progress</h3>{confirm?<div className="confirm-inline"><p>Clear stars and saved boards on this device? Stardust and unlocks stay.</p><button className="primary" onClick={()=>{setConfirm(false);onRestart();}}>Restart the journey</button><button className="secondary" onClick={()=>setConfirm(false)}>Keep my progress</button></div>:<button className="secondary" onClick={()=>setConfirm(true)}>Restart the journey</button>}</section>
 </div>;
}
