import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {noteFor,chordFor,colourShift,renderNote,renderDetent,renderPad,arpeggiate,instrumentNames,C4,type InstrumentId} from '../lib/music.ts';
import {AMBER,MINT,VIOLET} from '../lib/optics.ts';

void test('Background tracks are audible mono PCM without clipping, and the Drift loop has no seam',()=>{
 for(const name of ['quiet-orbit','moonrise','drift','relax-tide']){
  const b=readFileSync(new URL('../public/audio/'+name+'.wav',import.meta.url));
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),22050);
  let peak=0,power=0;const n=Math.min((b.length-44)/2,22050);
  for(let i=0;i<n;i++){const s=b.readInt16LE(44+i*2)/32768;peak=Math.max(peak,Math.abs(s));power+=s*s;}
  assert.ok(peak<.95,name+' must not clip');assert.ok(Math.sqrt(power/n)>.02,name+' must be audible in its first second');
 }
 const loop=readFileSync(new URL('../public/audio/relax-tide.wav',import.meta.url));
 assert.ok(Math.abs(loop.readInt16LE(44)-loop.readInt16LE(loop.length-2))/32768<.05);
});

void test('Every melody note sits on the constellation’s pentatonic scale',()=>{
 for(let chapter=0;chapter<9;chapter++){
  const root=noteFor(chapter,0);
  for(let step=0;step<20;step++){
   const semis=Math.round(12*Math.log2(noteFor(chapter,step)/root));
   assert.ok([0,2,4,7,9].includes(((semis%12)+12)%12),`chapter ${chapter} step ${step}`);
  }
  assert.ok(chordFor(chapter).every(hz=>hz>C4/4&&hz<C4*2));
 }
 assert.equal(colourShift(AMBER),-12);assert.equal(colourShift(VIOLET),12);assert.equal(colourShift(MINT),0);
});

void test('Instrument voices start and end silently and never clip',()=>{
 for(const id of Object.keys(instrumentNames) as InstrumentId[]){
  const out=renderNote(id,440,22050);let peak=0;for(const v of out)peak=Math.max(peak,Math.abs(v));
  assert.ok(peak>.05&&peak<1,id+' peak '+peak);
  assert.ok(Math.abs(out[0])<.02&&Math.abs(out.at(-1)!)<.01,id+' must not click');
 }
 const detent=renderDetent(22050);assert.ok(detent.length<2000&&Math.abs(detent.at(-1)!)<.02);
});

void test('The shimmer pad loops without a click',()=>{
 for(const rate of [44100,48000])for(let chapter=0;chapter<9;chapter++){
  const pad=renderPad(chapter,rate),step=Math.abs(pad[1]-pad[0]);
  assert.ok(Math.abs(pad[0]-pad.at(-1)!)<=step*2+1e-3,`chapter ${chapter} at ${rate} Hz`);
 }
});

void test('Arpeggiation keeps notes apart and caps a burst',()=>{
 const times=arpeggiate([0,0,0,10,500,505],70,4);
 assert.deepEqual(times,[0,70,140,210]);
 assert.deepEqual(arpeggiate([300,0],70,10),[0,300]);
});
