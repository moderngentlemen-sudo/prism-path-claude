import {AMBER,VIOLET} from './optics.ts';

// Each constellation has its own key; every melody uses the major pentatonic,
// so any order of notes stays consonant.
const PENTATONIC=[0,2,4,7,9];
const ROOTS=[0,2,4,7,9,5,10,3,0];
export const C4=261.63;
export function noteFor(chapter:number,step:number,shift=0){
 const root=ROOTS[((chapter%ROOTS.length)+ROOTS.length)%ROOTS.length],k=((step%10)+10)%10;
 return C4*Math.pow(2,(root+PENTATONIC[k%5]+12*Math.floor(k/5)+shift-5)/12);
}
// Light colour chooses the register: amber sings low, violet high, mixes in between.
export const colourShift=(c:number)=>c===AMBER?-12:c===VIOLET?12:0;
export const chordFor=(chapter:number)=>[0,2,4].map(k=>noteFor(chapter,k,-12));

export type InstrumentId='piano'|'sfx'|'kalimba'|'glass';
export const instrumentNames:Record<InstrumentId,string>={piano:'Felt piano',sfx:'Crystal chimes',kalimba:'Kalimba',glass:'Bowed glass'};
// Additive voices rendered to sample buffers once, then reused.
export function renderNote(id:InstrumentId,hz:number,rate:number){
 const seconds=id==='glass'?2.4:id==='kalimba'?1.2:1.8,n=Math.round(seconds*rate),out=new Float32Array(n);
 for(let i=0;i<n;i++){
  const t=i/rate,release=Math.min(1,(seconds-t)/.25);let v=0;
  if(id==='piano'){const env=(1-Math.exp(-t*90));for(let h=1;h<=6;h++){const amp=[0,1,.36,.16,.065,.022,.008][h];v+=amp*Math.exp(-t*(1.4+h*.5))*Math.sin(2*Math.PI*hz*h*Math.sqrt(1+.00008*h*h)*t);}v*=env;}
  else if(id==='sfx'){const env=(1-Math.exp(-t*160));v=env*(Math.exp(-t*2.1)*Math.sin(2*Math.PI*hz*t)+.32*Math.exp(-t*4)*Math.sin(2*Math.PI*hz*2.756*t)+.12*Math.exp(-t*7)*Math.sin(2*Math.PI*hz*5.404*t));}
  else if(id==='kalimba'){const env=(1-Math.exp(-t*220));v=env*(Math.exp(-t*3.2)*Math.sin(2*Math.PI*hz*t)+.22*Math.exp(-t*14)*Math.sin(2*Math.PI*hz*5.93*t)+.1*Math.exp(-t*6)*Math.sin(2*Math.PI*hz*2*t));}
  else{const env=Math.min(1,t/.28)*Math.exp(-t*.9),vib=1+.004*Math.sin(2*Math.PI*5.2*t);v=env*(Math.sin(2*Math.PI*hz*vib*t)+.25*Math.sin(2*Math.PI*hz*2*vib*t)+.08*Math.sin(2*Math.PI*hz*3*t));}
  out[i]=v*Math.max(0,release)*.32;
 }
 return out;
}
// A soft wooden detent for each quarter turn: filtered noise, no pitch.
export function renderDetent(rate:number,low=false){
 const n=Math.round(.05*rate),out=new Float32Array(n);let seed=17,prev=0;
 for(let i=0;i<n;i++){seed=(seed*1103515245+12345)&0x7fffffff;const noise=seed/0x3fffffff-1;prev+=(noise-prev)*(low?.12:.35);const t=i/rate;out[i]=prev*Math.exp(-t/(low?.018:.009))*(low?.9:.55);}
 return out;
}
// A slow shimmer pad that fades in as the board fills with light. Each partial
// completes whole cycles in the loop, so the seam never clicks.
export function renderPad(chapter:number,rate:number,seconds=8){
 const n=Math.round(seconds*rate),out=new Float32Array(n),notes=[0,2,4,7].map(k=>Math.round(noteFor(chapter,k,12)*seconds)/seconds);
 for(let i=0;i<n;i++){const t=i/rate;let v=0;notes.forEach((hz,k)=>{v+=Math.sin(2*Math.PI*hz*t)*(.5+.5*Math.sin(2*Math.PI*(t/seconds)*(k+1)+k));});out[i]=v*.05;}
 return out;
}
// Mini Metro's arpeggiation idea: never sound two notes closer than `gap` ms.
export function arpeggiate(times:number[],gap=70,cap=10){
 const out:number[]=[];let last=-Infinity;
 for(const t of [...times].sort((a,b)=>a-b)){if(out.length>=cap)break;const at=Math.max(t,last+gap);out.push(at);last=at;}
 return out;
}
