'use client';
import {renderNote,renderDetent,renderPad,noteFor,colourShift,chordFor,arpeggiate,type InstrumentId} from '@/lib/music';

export type AudioSettings={effects:boolean;music:boolean;volume:number;instrument:InstrumentId;track:string};
type Arrival={i:number;depth:number;colour:number;delay:number};
// One audio graph for the whole game: effects and the melody on one bus, music through
// a low-pass filter that opens as the board fills with light, plus a shimmer pad.
class Engine{
 ctx:AudioContext|null=null;private fx:GainNode|null=null;private musicGain:GainNode|null=null;private filter:BiquadFilterNode|null=null;private pad:GainNode|null=null;private padSource:AudioBufferSourceNode|null=null;
 private buffers=new Map<string,AudioBuffer>();private player:HTMLAudioElement|null=null;private media:MediaElementAudioSourceNode|null=null;
 settings:AudioSettings={effects:true,music:true,volume:.35,instrument:'piano',track:'quiet-orbit'};
 private chapter=0;private brightness=0;private hidden=false;
 private ensure(){
  if(this.ctx)return this.ctx;
  const Ctor=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!Ctor)return null;
  const ctx=new Ctor();this.ctx=ctx;
  this.fx=ctx.createGain();this.fx.gain.value=.9;this.fx.connect(ctx.destination);
  this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=900;this.filter.Q.value=.4;
  this.musicGain=ctx.createGain();this.musicGain.gain.value=this.settings.volume;this.filter.connect(this.musicGain);this.musicGain.connect(ctx.destination);
  this.pad=ctx.createGain();this.pad.gain.value=0;this.pad.connect(this.musicGain);
  document.addEventListener('visibilitychange',()=>{this.hidden=document.hidden;this.syncMusic();});
  return ctx;
 }
 // Browsers start audio only after a gesture; every tap calls this.
 unlock(){const ctx=this.ensure();if(ctx&&ctx.state!=='running')void ctx.resume().catch(()=>{});this.syncMusic();}
 configure(s:Partial<AudioSettings>){
  const prevTrack=this.settings.track;this.settings={...this.settings,...s};
  if(this.musicGain)this.musicGain.gain.setTargetAtTime(this.settings.volume,this.ctx!.currentTime,.05);
  if(s.track&&s.track!==prevTrack&&this.player){this.player.pause();this.player=null;this.media?.disconnect();this.media=null;}
  this.syncMusic();
 }
 setChapter(chapter:number){if(chapter===this.chapter&&this.padSource)return;this.chapter=chapter;this.startPad();}
 private buffer(key:string,make:(rate:number)=>Float32Array){
  const ctx=this.ctx!;let b=this.buffers.get(key);
  if(!b){const data=make(ctx.sampleRate);b=ctx.createBuffer(1,data.length,ctx.sampleRate);b.getChannelData(0).set(data);this.buffers.set(key,b);}
  return b;
 }
 private play(b:AudioBuffer,when:number,gain:number,rate=1){
  const ctx=this.ctx!,src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=b;src.playbackRate.value=rate;g.gain.value=gain;src.connect(g);g.connect(this.fx!);src.start(when);src.onended=()=>{src.disconnect();g.disconnect();};
 }
 private note(hz:number,when:number,gain=.8,instrument=this.settings.instrument){
  // Notes are rendered per semitone-ish pitch and reused.
  const key=instrument+':'+Math.round(hz*10);this.play(this.buffer(key,rate=>renderNote(instrument,hz,rate)),when,gain);
 }
 detent(low=false){if(!this.settings.effects)return;const ctx=this.ensure();if(!ctx)return;this.play(this.buffer(low?'thunk':'detent',rate=>renderDetent(rate,low)),ctx.currentTime,low?.9:.7,low?1:.96+Math.random()*.08);}
 // The route plays itself: each newly lit tile sounds as the light reaches it.
 arrive(tiles:Arrival[]){
  if(!this.settings.effects||!tiles.length)return;const ctx=this.ensure();if(!ctx||ctx.state!=='running')return;
  const times=arpeggiate(tiles.map(t=>t.delay),70,10),now=ctx.currentTime;
  [...tiles].sort((a,b)=>a.delay-b.delay).slice(0,times.length).forEach((t,k)=>this.note(noteFor(this.chapter,t.depth,colourShift(t.colour)),now+times[k]/1000,.55));
 }
 // Completion replays the whole route as an arpeggio over the constellation's chord.
 complete(depths:number[],colours:number[],radiant:boolean){
  if(!this.settings.effects)return;const ctx=this.ensure();if(!ctx||ctx.state!=='running')return;
  const now=ctx.currentTime+.08,steps=[...new Set(depths)].sort((a,b)=>a-b).slice(0,12);
  steps.forEach((d,k)=>this.note(noteFor(this.chapter,d,colourShift(colours[k]??0)),now+k*.085,.5));
  const end=now+steps.length*.085+.05;
  chordFor(this.chapter).forEach((hz,k)=>this.note(hz,end+k*.02,.45,'glass'));
  if(radiant)[7,9,10].forEach((s,k)=>this.note(noteFor(this.chapter,s,12),end+.25+k*.12,.35,'sfx'));
 }
 receiver(){if(!this.settings.effects)return;const ctx=this.ensure();if(!ctx||ctx.state!=='running')return;chordFor(this.chapter).forEach((hz,k)=>this.note(hz*2,ctx.currentTime+k*.03,.28,'sfx'));}
 preview(instrument:InstrumentId){const ctx=this.ensure();if(!ctx)return;this.unlock();[0,2,4,7].forEach((s,k)=>this.note(noteFor(this.chapter,s),ctx.currentTime+.05+k*.16,.6,instrument));}
 // A short excerpt of a background track, for the shop.
 previewTrack(track:string){
  this.unlock();const a=new Audio(`/audio/${track}.wav`);a.volume=Math.max(.2,Math.min(1,this.settings.volume*1.6));
  this.player?.pause();void a.play().catch(()=>{});
  setTimeout(()=>{a.pause();this.syncMusic();},9000);
 }
 // Music opens up as more of the board is lit.
 setBrightness(fraction:number){
  this.brightness=Math.max(0,Math.min(1,fraction));
  if(!this.ctx||!this.filter||!this.pad)return;const t=this.ctx.currentTime;
  this.filter.frequency.setTargetAtTime(700*Math.pow(14,this.brightness),t,.4);
  this.pad.gain.setTargetAtTime(this.settings.music?.9*this.brightness*this.brightness:0,t,.8);
 }
 private startPad(){
  const ctx=this.ctx;if(!ctx||!this.pad)return;
  this.padSource?.stop();const src=ctx.createBufferSource();src.buffer=this.buffer('pad:'+this.chapter,rate=>renderPad(this.chapter,rate));src.loop=true;src.connect(this.pad);src.start();this.padSource=src;
 }
 private syncMusic(){
  const ctx=this.ctx;if(!ctx||!this.filter)return;
  const want=this.settings.music&&!this.hidden&&ctx.state==='running';
  if(want&&!this.player){
   const p=new Audio(`/audio/${this.settings.track}.wav`);p.loop=true;p.crossOrigin='anonymous';this.player=p;
   try{this.media=ctx.createMediaElementSource(p);this.media.connect(this.filter);}catch{p.volume=this.settings.volume;}
   if(!this.padSource)this.startPad();
  }
  if(this.player){if(want)void this.player.play().catch(()=>{});else this.player.pause();}
  if(this.pad)this.pad.gain.setTargetAtTime(want?.9*this.brightness*this.brightness:0,ctx.currentTime,.3);
 }
}
export const audio=new Engine();
// Haptics: native builds expose Capacitor's Haptics plugin; Android browsers have vibrate; iOS Safari has neither.
export function canVibrate(){const w=window as unknown as {Capacitor?:{Plugins?:{Haptics?:unknown}}};return !!w.Capacitor?.Plugins?.Haptics||typeof navigator.vibrate==='function';}
export function haptic(strong=false){
 const w=window as unknown as {Capacitor?:{Plugins?:{Haptics?:{impact:(o:{style:string})=>Promise<void>}}}};
 const native=w.Capacitor?.Plugins?.Haptics;if(native){void native.impact({style:strong?'MEDIUM':'LIGHT'}).catch(()=>{});return;}
 if(typeof navigator.vibrate==='function')navigator.vibrate(strong?[18,40,26]:8);
}
