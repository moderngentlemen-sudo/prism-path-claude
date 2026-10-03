'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {type Board as BoardData,type Light,hueName,hueGlyph,openings,facing,cellName,turnable} from '@/lib/optics';
import {draw,fit,centre,type Geometry,type Palette} from './render';

export type Arrival={i:number;depth:number;colour:number;delay:number};
type Props={
 board:BoardData;rot:number[];light:Light;palette:Palette;still:boolean;patterns:boolean;
 marks?:number[];markUntil?:number;hintAt?:number;solvedAt?:number;maxTile?:number;label:string;
 onTurn:(i:number,d:1|-1)=>void;onNudge?:(i:number)=>void;onArrive?:(tiles:Arrival[])=>void;
};
type View={board:BoardData;rot:number[];light:Light;palette:Palette;still:boolean;patterns:boolean;marks:number[];markUntil:number;hintAt:number;solvedAt:number;geo:Geometry|null};
const TURN_MS=140,STEP_MS=62,LONG_PRESS=430;
const ease=(t:number)=>{const c=1.6;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};

// The painter owns the animation: each render hands it the latest view, and it
// eases tiles toward their new turn and sends light outward from where it was.
class Painter{
 canvas:HTMLCanvasElement|null=null;view:View|null=null;
 private board:BoardData|null=null;private rot:number[]=[];private light:Light|null=null;private geo:Geometry|null=null;
 private angle:number[]=[];private from:number[]=[];private to:number[]=[];private start:number[]=[];
 private glow:number[]=[];private glowFrom:number[]=[];private glowTo:number[]=[];private glowStart:number[]=[];
 private nudges:number[]=[];private raf=0;private last=0;
 sync(v:View,canvas:HTMLCanvasElement|null,onArrive?:(tiles:Arrival[])=>void){
  const now=performance.now(),n=v.board.tiles.length;
  this.canvas=canvas;
  if(v.board!==this.board){
   // A new board starts settled, lit wherever light already is.
   this.board=v.board;this.rot=v.rot.slice();this.angle=v.rot.slice();this.from=v.rot.slice();this.to=v.rot.slice();this.start=Array(n).fill(0);
   this.glow=v.light.lit.map(x=>x?1:0);this.glowFrom=this.glow.slice();this.glowTo=this.glow.slice();this.glowStart=Array(n).fill(0);this.nudges=Array(n).fill(-1e9);this.light=v.light;
  }else if(v.light!==this.light){
   let turned=false;
   for(let i=0;i<n;i++){if(v.rot[i]===this.rot[i])continue;let d=((v.rot[i]-this.rot[i])%4+4)%4;if(d===3)d=-1;this.from[i]=this.angle[i];this.to[i]+=d;this.start[i]=now;turned=true;}
   this.rot=v.rot.slice();
   const prev=this.light!,fresh:number[]=[];this.light=v.light;
   for(let i=0;i<n;i++){
    const on=v.light.lit[i]>0,was=prev.lit[i]>0;
    if(on&&!was)fresh.push(i);
    else if(!on&&was){this.glowFrom[i]=this.glow[i];this.glowTo[i]=0;this.glowStart[i]=now;}
   }
   if(fresh.length){
    const base=Math.min(...fresh.map(i=>v.light.depth[i])),lead=turned?TURN_MS:0;
    const arrivals=fresh.map(i=>({i,depth:v.light.depth[i],colour:v.light.lit[i],delay:lead+(v.light.depth[i]-base)*(v.still?0:STEP_MS)}));
    for(const t of arrivals){this.glowFrom[t.i]=0;this.glowTo[t.i]=1;this.glowStart[t.i]=now+t.delay;}
    onArrive?.(arrivals);
   }
  }
  if(v.geo&&canvas&&v.geo!==this.geo){
   const dpr=Math.min(2,window.devicePixelRatio||1);this.geo=v.geo;
   canvas.width=Math.round(v.geo.width*dpr);canvas.height=Math.round(v.geo.height*dpr);canvas.style.width=v.geo.width+'px';canvas.style.height=v.geo.height+'px';
  }
  this.view=v;this.kick();
 }
 nudge(i:number){this.nudges[i]=performance.now();this.kick();}
 stop(){cancelAnimationFrame(this.raf);this.raf=0;}
 private kick=()=>{if(!this.raf)this.raf=requestAnimationFrame(this.frame);};
 private frame=(now:number)=>{
  this.raf=0;const v=this.view,c=this.canvas;if(!v?.geo||!c)return;
  const n=v.board.tiles.length;let busy=false;
  for(let i=0;i<n;i++){
   const t=Math.min(1,(now-this.start[i])/(v.still?1:TURN_MS));
   this.angle[i]=t>=1?this.to[i]:this.from[i]+(this.to[i]-this.from[i])*ease(t);
   if(t<1)busy=true;
   const wob=now-this.nudges[i];if(wob<260){this.angle[i]+=Math.sin(wob/26)*.05*(1-wob/260);busy=true;}
   const g=now<this.glowStart[i]?0:Math.min(1,(now-this.glowStart[i])/(v.still?1:160));
   this.glow[i]=now<this.glowStart[i]?this.glowFrom[i]:this.glowFrom[i]+(this.glowTo[i]-this.glowFrom[i])*g;
   if(now<this.glowStart[i]||g<1)busy=true;
  }
  const ctx=c.getContext('2d');if(!ctx)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);ctx.setTransform(dpr,0,0,dpr,0,0);
  draw(ctx,{b:v.board,rot:v.rot,light:v.light,geo:v.geo,pal:v.palette,time:now,still:v.still,patterns:v.patterns,angle:this.angle,glow:this.glow,marks:new Set(v.marks),hintAt:v.hintAt,markUntil:v.markUntil,solvedAt:v.solvedAt});
  // Full speed while anything moves; a gentle 30 fps shimmer while light rests on the board.
  const alive=!v.still&&(v.light.litCount>0||v.light.leaks.length>0);
  if(busy||now<v.markUntil||v.hintAt>=0||(v.solvedAt&&now-v.solvedAt<2500))this.raf=requestAnimationFrame(this.frame);
  else if(alive)this.raf=requestAnimationFrame(t=>{if(t-this.last<30){this.raf=0;setTimeout(this.kick,30-(t-this.last));return;}this.last=t;this.frame(t);});
 };
}

function describe(b:BoardData,rot:number[],light:Light,i:number){
 const t=b.tiles[i],lit=light.lit[i],parts=[cellName(b,i)];
 if(b.fixed[i])parts.push('pinned');
 if(t.k==='pipe')parts.push(`openings ${facing(openings(t,rot[i]))}`);
 else if(t.k==='bridge')parts.push('bridge crossing north–south and east–west');
 else if(t.k==='mirror')parts.push(`mirror set to ${rot[i]&1?'slash':'backslash'}`);
 else if(t.k==='prism')parts.push(`prism, white enters from the ${['north','east','south','west'][(3+rot[i])&3]}`);
 else if(t.k==='filter')parts.push(`${hueName(t.c)} filter, ${rot[i]&1?'north to south':'east to west'}`);
 else parts.push(`receiver needing ${hueName(t.c)} ${hueGlyph(t.c)}, ${light.recv[i]===t.c?'satisfied':light.recv[i]?'receiving '+hueName(light.recv[i]):'dark'}, opening ${facing(openings(t,rot[i]))}`);
 parts.push(lit?`lit ${hueName(lit)}`:'dark');
 if(!b.fixed[i]&&turnable(t))parts.push('press to turn clockwise, shift or hold to turn back');
 return parts.join(', ');
}

export function Board({board,rot,light,palette,still,patterns,marks=[],markUntil=0,hintAt=-1,solvedAt=0,maxTile,label,onTurn,onNudge,onArrive}:Props){
 const box=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),painter=useRef<Painter|null>(null);
 const [geo,setGeo]=useState<Geometry|null>(null);
 const n=board.tiles.length;
 useLayoutEffect(()=>{
  painter.current??=new Painter();
  painter.current.sync({board,rot,light,palette,still,patterns,marks,markUntil,hintAt,solvedAt,geo},canvas.current,onArrive);
 });
 useEffect(()=>()=>painter.current?.stop(),[]);
 // The observer reports the box's size as soon as it starts watching, and on every change.
 useEffect(()=>{
  const el=box.current;if(!el)return;
  const ro=new ResizeObserver(()=>setGeo(fit(board,el.clientWidth,el.clientHeight,maxTile)));ro.observe(el);return()=>ro.disconnect();
 },[board,maxTile]);

 // Input: tap turns clockwise; hold, right-click, two-finger tap or Shift turns back.
 const press=useRef<{i:number;timer:ReturnType<typeof setTimeout>|null;done:boolean}|null>(null),skipClick=useRef(0);
 const turn=(i:number,d:1|-1)=>{if(board.fixed[i]||!turnable(board.tiles[i])){painter.current?.nudge(i);onNudge?.(i);return;}onTurn(i,d);};
 const down=(i:number,e:React.PointerEvent)=>{if(e.button!==0)return;const p={i,timer:null as ReturnType<typeof setTimeout>|null,done:false};p.timer=setTimeout(()=>{p.done=true;turn(i,-1);if(typeof navigator.vibrate==='function')navigator.vibrate(8);},LONG_PRESS);press.current=p;};
 const up=(i:number,e:React.PointerEvent)=>{const p=press.current;press.current=null;if(!p||p.i!==i)return;if(p.timer)clearTimeout(p.timer);if(p.done||e.button!==0)return;if(e.timeStamp<skipClick.current)return;turn(i,e.shiftKey?-1:1);};
 const cancel=()=>{const p=press.current;if(p?.timer)clearTimeout(p.timer);press.current=null;};
 const tileAt=(x:number,y:number)=>{const el=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-tile]');return el?Number(el.dataset.tile):-1;};
 const touch=(e:React.TouchEvent)=>{if(e.touches.length!==2)return;cancel();const i=tileAt(e.touches[0].clientX,e.touches[0].clientY);if(i>=0){skipClick.current=e.timeStamp+400;turn(i,-1);}};
 const key=(i:number,e:React.KeyboardEvent<HTMLButtonElement>)=>{
  const k=e.key;
  if(k==='Enter'||k===' '){e.preventDefault();turn(i,e.shiftKey?-1:1);return;}
  if(k==='q'||k==='Q'){e.preventDefault();turn(i,-1);return;}
  if(k==='e'||k==='E'){e.preventDefault();turn(i,1);return;}
  const move:Record<string,number>={ArrowUp:-board.w,ArrowDown:board.w,ArrowLeft:-1,ArrowRight:1};
  const step=move[k];if(step===undefined)return;e.preventDefault();
  const x=i%board.w,next=i+step;if((k==='ArrowLeft'&&x===0)||(k==='ArrowRight'&&x===board.w-1)||next<0||next>=n)return;
  box.current?.querySelector<HTMLButtonElement>(`[data-tile="${next}"]`)?.focus();
 };
 return <div ref={box} className="board-box" onTouchStart={touch}>
  <fieldset className="board-stage" style={geo?{width:geo.width,height:geo.height}:undefined} aria-label={label}>
   <canvas ref={canvas} aria-hidden="true"/>
   {geo&&board.tiles.map((_,i)=>{const {x,y}=centre(board,geo,i);return <button key={i} data-tile={i} type="button" className="tile-hit" style={{left:x-geo.T/2,top:y-geo.T/2,width:geo.T,height:geo.T}} aria-label={describe(board,rot,light,i)} onPointerDown={e=>down(i,e)} onPointerUp={e=>up(i,e)} onPointerLeave={cancel} onPointerCancel={cancel} onContextMenu={e=>{e.preventDefault();cancel();turn(i,-1);}} onKeyDown={e=>key(i,e)}/>;})}
  </fieldset>
 </div>;
}
