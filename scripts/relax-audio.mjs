import {writeFileSync,mkdirSync} from 'node:fs';
const rate=22050,root=new URL('../public/audio/',import.meta.url);mkdirSync(root,{recursive:true});
function wav(name,seconds,sample,peak){const n=Math.round(seconds*rate),data=new Float64Array(n);let max=0;for(let i=0;i<n;i++){data[i]=sample(i/rate);max=Math.max(max,Math.abs(data[i]));}const b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(data[i]/max*peak*32767),44+i*2);writeFileSync(new URL(name+'.wav',root),b);}
// The Drift background track: one synthesized felt-piano voice. Tile notes and
// effects are rendered live by app/audio/engine.ts, so only this loop is a file.
// Rounded hammer attack, quickly softened upper partials and a short room tail.
const period=120,notes=[];
const chords=[[261.63,329.63,392],[261.63,349.23,440],[261.63,329.63,440],[293.66,392,493.88]];
function piano(t,hz,length=3.2){
 if(t<0||t>=length)return 0;
 const envelope=(1-Math.exp(-t*100))*Math.min(1,(length-t)/.35);
 let tone=0;
 for(let h=1;h<=6;h++){
  const stretch=Math.sqrt(1+.00008*h*h);
  tone+=[0,1,.36,.16,.065,.022,.008][h]*Math.exp(-t*(1.35+h*.48))*Math.sin(2*Math.PI*hz*h*stretch*t);
 }
 return tone*envelope;
}
function room(t,hz,length=3.2){return piano(t,hz,length)+.08*piano(t-.11,hz,length-.11)+.04*piano(t-.19,hz,length-.19);}
// Three related phrases: the familiar opening, a quieter answering phrase,
// and open voicings returning gently to the start. No random jumps at the seam.
for(let bar=0;bar<24;bar++){
 const phrase=Math.floor(bar/8),chord=chords[Math.floor((bar%8)/2)],base=bar*5;
 const voicing=phrase===2?[chord[0]/2,chord[1],chord[2]]:chord;
 voicing.forEach((hz,i)=>notes.push([base+i*(phrase===1?.065:.035),hz,phrase===1?.21:.24]));
 if(phrase===0)notes.push([base+1.75,chord[2],.17],[base+3.25,chord[1],.13]);
 else if(phrase===1)notes.push([base+2,chord[1],.15],[base+3.5,chord[0],.12]);
 else notes.push([base+1.5,chord[0],.13],[base+2.75,chord[2],.15],[base+3.65,chord[1],.10]);
}
wav('relax-tide',period,t=>notes.reduce((sum,[at,hz,gain])=>sum+gain*room((t-at+period)%period,hz),0),.29);
