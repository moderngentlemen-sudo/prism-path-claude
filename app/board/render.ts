import {type Board,type Light,AMBER,MINT,VIOLET,WHITE,N,E,S,W,DX,DY,hueGlyph} from '@/lib/optics';

export type Palette={white:string;amber:string;mint:string;violet:string;am:string;av:string;mv:string};
export const palettes:Record<string,Palette>={
 standard:{white:'#f3ffe2',amber:'#ffb44d',mint:'#58efb6',violet:'#b78cff',am:'#e3f36b',av:'#ff8ad5',mv:'#8fcbff'},
 contrast:{white:'#ffffff',amber:'#ffc61a',mint:'#3df0ff',violet:'#ff5cf4',am:'#d4ff3d',av:'#ff9a8a',mv:'#a9b8ff'},
};
export const hueColor=(pal:Palette,c:number)=>c===WHITE?pal.white:c===AMBER?pal.amber:c===MINT?pal.mint:c===VIOLET?pal.violet:c===(AMBER|MINT)?pal.am:c===(AMBER|VIOLET)?pal.av:c===(MINT|VIOLET)?pal.mv:'#6d8890';

export type Geometry={T:number;gap:number;pad:number;width:number;height:number};
export function fit(b:{w:number;h:number},cssW:number,cssH:number,max=104):Geometry{
 const g=.07,p=.62;
 const T=Math.max(28,Math.min(max,cssW/(b.w+(b.w-1)*g+2*p),cssH/(b.h+(b.h-1)*g+2*p)));
 const gap=T*g,pad=T*p;
 return {T,gap,pad,width:b.w*T+(b.w-1)*gap+2*pad,height:b.h*T+(b.h-1)*gap+2*pad};
}
export const centre=(b:{w:number},geo:Geometry,i:number)=>({x:geo.pad+(i%b.w)*(geo.T+geo.gap)+geo.T/2,y:geo.pad+Math.floor(i/b.w)*(geo.T+geo.gap)+geo.T/2});

export type Frame={
 b:Board;rot:number[];light:Light;geo:Geometry;pal:Palette;time:number;still:boolean;patterns:boolean;
 angle:number[];      // visual quarter turns, eased toward rot
 glow:number[];       // 0..1 per tile, the travelling wavefront
 marks:Set<number>;hintAt:number;markUntil:number;solvedAt:number;
};
const TAU=Math.PI*2;
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function withAlpha(hex:string,a:number){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${Math.max(0,Math.min(1,a))})`;}
// Paths are drawn in a tile's own frame: centre at 0,0, half-size s, base orientation.
type Seg={side:number;draw:(ctx:CanvasRenderingContext2D,s:number,half:0|1|2)=>void};
// A spoke from a side's midpoint to the centre. half 1 = outer half, 2 = inner half, 0 = whole.
const spoke=(side:number):Seg=>({side,draw:(ctx,s,half)=>{const x=DX[side]*s,y=DY[side]*s;ctx.moveTo(half===2?x*.5:x,half===2?y*.5:y);ctx.lineTo(half===1?x*.5:0,half===1?y*.5:0);}});
// Quarter arc joining two adjacent sides around their shared corner.
function arc(a:number,b:number):Seg[]{
 const cx=(DX[a]+DX[b]),cy=(DY[a]+DY[b]);
 const start=(side:number)=>Math.atan2(DY[side]-cy,DX[side]-cx);
 const make=(from:number,to:number):Seg=>({side:from,draw:(ctx,s)=>{const r=s,x=cx*s,y=cy*s;const a0=start(from),a1=start(to);let d=a1-a0;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;ctx.moveTo(x+Math.cos(a0)*r,y+Math.sin(a0)*r);ctx.arc(x,y,r,a0,a0+d/2,d<0);}});
 return [make(a,b),make(b,a)];
}
function pipeSegs(m:number):Seg[]{
 const sides=[N,E,S,W].filter(d=>m&(1<<d));
 if(sides.length===2&&(sides[1]-sides[0])%2===1)return arc(sides[0],sides[1]);
 return sides.map(spoke);
}
// Which world side a base side faces after r quarter turns.
const world=(base:number,r:number)=>(base+r)&3;

function drawSegs(ctx:CanvasRenderingContext2D,segs:Seg[],s:number,stroke:(seg:Seg)=>string|null,width:number,cap:CanvasLineCap='round'){
 ctx.lineWidth=width;ctx.lineCap=cap;
 for(const seg of segs){const c=stroke(seg);if(!c)continue;ctx.strokeStyle=c;ctx.beginPath();seg.draw(ctx,s,0);ctx.stroke();}
}
function glyph(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,color:string){ctx.fillStyle=color;ctx.font=`600 ${size}px system-ui, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+size*.04);}

export function draw(ctx:CanvasRenderingContext2D,f:Frame){
 const {b,geo,pal,light,time}=f,{T}=geo,s=T/2;
 ctx.clearRect(0,0,geo.width,geo.height);
 const solvedFor=f.solvedAt?Math.max(0,time-f.solvedAt):0;
 // Board glass.
 rounded(ctx,geo.pad*.35,geo.pad*.35,geo.width-geo.pad*.7,geo.height-geo.pad*.7,T*.3);
 const frame=ctx.createLinearGradient(0,0,0,geo.height);frame.addColorStop(0,'#0c191e');frame.addColorStop(1,'#081115');
 ctx.fillStyle=frame;ctx.fill();ctx.lineWidth=1.2;ctx.strokeStyle=f.solvedAt?withAlpha(pal.white,.35+.25*Math.exp(-solvedFor/900)):'#22393f';ctx.stroke();
 for(let i=0;i<b.tiles.length;i++){
  const {x,y}=centre(b,geo,i),t=b.tiles[i],lit=light.lit[i],glowing=f.glow[i];
  const a=f.angle[i],r=Math.round(a)&3,settled=Math.abs(a-Math.round(a))<.02;
  // Tile glass, warming with the light it carries.
  rounded(ctx,x-s,y-s,T,T,T*.16);
  const g=ctx.createLinearGradient(x,y-s,x,y+s);g.addColorStop(0,b.fixed[i]?'#1a2c31':'#17292f');g.addColorStop(1,b.fixed[i]?'#122025':'#102025');
  ctx.fillStyle=g;ctx.fill();
  if(lit&&glowing>0){ctx.fillStyle=withAlpha(hueColor(pal,lit),.09*glowing);ctx.fill();}
  ctx.lineWidth=1;ctx.strokeStyle=lit&&glowing>.5?withAlpha(hueColor(pal,lit),.32*glowing):b.fixed[i]?'#38545b':'#24393f';ctx.stroke();
  ctx.save();ctx.translate(x,y);ctx.rotate(a*Math.PI/2);
  const base=t.k==='pipe'?pipeSegs(t.m):t.k==='bridge'?[spoke(N),spoke(S),spoke(E),spoke(W)]:t.k==='mirror'?[...arc(W,S),...arc(N,E)]:t.k==='prism'?[spoke(W),spoke(N),spoke(E),spoke(S)]:t.k==='filter'?[spoke(E),spoke(W)]:[spoke(W)];
  // Grooves.
  drawSegs(ctx,base,s,()=>'#2f474e',T*.2);drawSegs(ctx,base,s,()=>'#0d191d',T*.11);
  // Light: per side, glow then core, only once the tile has finished turning.
  if(settled&&lit&&glowing>0){
   const colour=(seg:Seg)=>{const c=light.side[i*4+world(seg.side,r)];return c?hueColor(pal,c):null;};
   ctx.globalCompositeOperation='lighter';
   const pulse=f.solvedAt?1+.6*Math.exp(-solvedFor/700):1;
   ctx.globalAlpha=.22*glowing*pulse;drawSegs(ctx,base,s,colour,T*.3);
   ctx.globalAlpha=.55*glowing;drawSegs(ctx,base,s,colour,T*.12);
   ctx.globalAlpha=.95*glowing;drawSegs(ctx,base,s,seg=>colour(seg)?'#ffffff':null,T*.035);
   // Patterns tell beams apart without colour: amber dotted, violet dashed, mint solid.
   if(f.patterns){
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.9*glowing;
    for(const [hue,dash,ink] of [[AMBER,[T*.025,T*.065],'#20140a'],[VIOLET,[T*.13,T*.07],'#1a0f2a']] as const){
     ctx.setLineDash(dash);drawSegs(ctx,base,s,seg=>{const c=light.side[i*4+world(seg.side,r)];return c&hue&&!(c&(AMBER|VIOLET)&~hue)?ink:null;},T*.04,'butt');
    }
    ctx.setLineDash([]);
   }
   ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  // Tile furniture in the tile's own frame.
  if(t.k==='bridge'){ctx.fillStyle='#0d191d';ctx.fillRect(-s*.32,-s*.14,s*.64,s*.28);ctx.strokeStyle='#4a666d';ctx.lineWidth=1.2;ctx.strokeRect(-s*.32,-s*.14,s*.64,s*.28);
   const ew=light.side[i*4+E]|light.side[i*4+W];if(ew&&glowing>0){ctx.globalCompositeOperation='lighter';ctx.strokeStyle=withAlpha(hueColor(pal,ew),.9*glowing);ctx.lineWidth=T*.06;ctx.beginPath();ctx.moveTo(-s*.32,0);ctx.lineTo(s*.32,0);ctx.stroke();ctx.globalCompositeOperation='source-over';}}
  if(t.k==='mirror'){ctx.strokeStyle='#d9eef2';ctx.lineWidth=T*.05;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-s*.62,-s*.62);ctx.lineTo(s*.62,s*.62);ctx.stroke();ctx.strokeStyle='#7fa1aa';ctx.lineWidth=T*.02;ctx.beginPath();ctx.moveTo(-s*.5,-s*.62);ctx.lineTo(s*.62,s*.5);ctx.stroke();}
  if(t.k==='prism'){
   ([[N,pal.amber],[E,pal.mint],[S,pal.violet]] as const).forEach(([side,c])=>{ctx.strokeStyle=withAlpha(c,.35);ctx.lineWidth=T*.05;ctx.beginPath();ctx.moveTo(DX[side]*s*.42,DY[side]*s*.42);ctx.lineTo(DX[side]*s*.86,DY[side]*s*.86);ctx.stroke();});
   ctx.beginPath();ctx.moveTo(-s*.34,-s*.4);ctx.lineTo(s*.42,0);ctx.lineTo(-s*.34,s*.4);ctx.closePath();
   const pg=ctx.createLinearGradient(-s*.34,0,s*.42,0);pg.addColorStop(0,'#e8fbff');pg.addColorStop(1,'#8fb7c4');ctx.fillStyle=withAlpha('#cfeaf2',lit?.55:.3);ctx.fill();ctx.strokeStyle=pg;ctx.lineWidth=T*.035;ctx.stroke();
   ctx.strokeStyle='#ffffff';ctx.lineWidth=T*.05;ctx.beginPath();ctx.moveTo(-s*.34,-s*.4);ctx.lineTo(-s*.34,s*.4);ctx.stroke();
  }
  if(t.k==='filter'){rounded(ctx,-s*.12,-s*.46,s*.24,s*.92,s*.08);ctx.fillStyle=withAlpha(hueColor(pal,t.c),.55);ctx.fill();ctx.strokeStyle=hueColor(pal,t.c);ctx.lineWidth=1.5;ctx.stroke();}
  ctx.restore();
  // Centre pieces drawn upright so glyphs read correctly.
  if(t.k==='pipe'&&t.m===1){const on=lit&&glowing>0;ctx.beginPath();ctx.arc(x,y,T*.1,0,TAU);ctx.fillStyle=on?withAlpha(hueColor(pal,lit),.95*glowing):'#3a5259';ctx.fill();if(on){ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.arc(x,y,T*.22,0,TAU);ctx.fillStyle=withAlpha(hueColor(pal,lit),.18*glowing);ctx.fill();ctx.globalCompositeOperation='source-over';}}
  if(t.k==='pipe'&&(t.m===7||t.m===15)){ctx.beginPath();ctx.arc(x,y,T*.07,0,TAU);ctx.fillStyle=lit&&glowing>.5?'#ffffff':'#2f474e';ctx.fill();}
  if(t.k==='recv'){
   const got=light.recv[i],ok=got===t.c,c=hueColor(pal,t.c);
   ctx.beginPath();ctx.arc(x,y,T*.27,0,TAU);ctx.fillStyle=ok?withAlpha(c,.85*glowing+.1):'#0d191d';ctx.fill();
   ctx.lineWidth=T*.045;ctx.strokeStyle=got&&!ok?'#ff8e8e':c;ctx.setLineDash(got&&!ok?[T*.05,T*.04]:[]);ctx.stroke();ctx.setLineDash([]);
   if(ok){ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.arc(x,y,T*.42,0,TAU);ctx.fillStyle=withAlpha(c,.16*glowing);ctx.fill();ctx.globalCompositeOperation='source-over';}
   glyph(ctx,hueGlyph(t.c),x,y,T*(t.c===WHITE||[1,2,4].includes(t.c)?.22:.17),ok?'#0b1418':c);
  }
  if(t.k==='filter')glyph(ctx,hueGlyph(t.c),x+T*.3,y-T*.3,T*.15,hueColor(pal,t.c));
  if(b.fixed[i]){ctx.beginPath();ctx.arc(x-s+T*.15,y-s+T*.15,T*.055,0,TAU);ctx.fillStyle='#c9dde1';ctx.fill();ctx.beginPath();ctx.arc(x-s+T*.15,y-s+T*.15,T*.1,0,TAU);ctx.strokeStyle='#6f8d94';ctx.lineWidth=1;ctx.stroke();}
  // Hint marks.
  if(f.marks.has(i)&&time<f.markUntil){const k=.5+.5*Math.sin(time/180);rounded(ctx,x-s+2,y-s+2,T-4,T-4,T*.14);ctx.strokeStyle=withAlpha(pal.white,.25+.35*k);ctx.lineWidth=2;ctx.stroke();}
  if(f.hintAt===i){rounded(ctx,x-s+1.5,y-s+1.5,T-3,T-3,T*.15);ctx.setLineDash([6,5]);ctx.lineDashOffset=-time/40;ctx.strokeStyle=pal.white;ctx.lineWidth=2.5;ctx.stroke();ctx.setLineDash([]);}
 }
 // Particles drift from where light enters a tile toward where it leaves.
 if(!f.still){
  ctx.globalCompositeOperation='lighter';
  for(let i=0;i<b.tiles.length;i++){
   if(!light.lit[i]||f.glow[i]<.9)continue;
   const {x,y}=centre(b,geo,i),ins=[0,1,2,3].filter(d=>light.inflow[i*4+d]),outs=[0,1,2,3].filter(d=>light.side[i*4+d]&&!light.inflow[i*4+d]);
   if(!ins.length)continue;
   const k=((time/1100+i*.37)%1),from=ins[i%ins.length],to=outs.length?outs[Math.floor(time/1100+i*.37)%outs.length]:-1;
   const px=k<.5?DX[from]*s*(1-2*k):to<0?0:DX[to]*s*(2*k-1),py=k<.5?DY[from]*s*(1-2*k):to<0?0:DY[to]*s*(2*k-1);
   const c=hueColor(pal,light.side[i*4+(k<.5?from:Math.max(to,0))]||light.lit[i]);
   ctx.beginPath();ctx.arc(x+px,y+py,T*.045,0,TAU);ctx.fillStyle=withAlpha(c,.9);ctx.fill();
   ctx.beginPath();ctx.arc(x+px,y+py,T*.11,0,TAU);ctx.fillStyle=withAlpha(c,.18);ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';
 }
 // Leaks: light spilling out of an open side.
 for(const leak of light.leaks){
  const {x,y}=centre(b,geo,leak.i),dx=DX[leak.s],dy=DY[leak.s],c=hueColor(pal,leak.c);
  ctx.globalCompositeOperation='lighter';
  for(let k=0;k<3;k++){const t=f.still?.5:((time/700+k/3)%1),d=s+T*(.05+.22*t),spread=(k-1)*T*.12*t;
   ctx.beginPath();ctx.arc(x+dx*d+dy*spread,y+dy*d+dx*spread,T*.04*(1-t*.5),0,TAU);ctx.fillStyle=withAlpha(c,.75*(1-t));ctx.fill();}
  ctx.globalCompositeOperation='source-over';
 }
 // Ports outside the frame.
 b.ports.forEach((q,k)=>{
  const {x,y}=centre(b,geo,q.i),d=s+geo.pad*.52,px=x+DX[q.s]*d,py=y+DY[q.s]*d,c=hueColor(pal,q.c),got=light.got[k];
  if(!q.out){
   ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.arc(px,py,T*.2,0,TAU);ctx.fillStyle=withAlpha(c,.25);ctx.fill();ctx.globalCompositeOperation='source-over';
   ctx.beginPath();ctx.arc(px,py,T*.1,0,TAU);ctx.fillStyle=c;ctx.fill();
   ctx.strokeStyle=withAlpha(c,.8);ctx.lineWidth=T*.04;ctx.beginPath();ctx.moveTo(px-DX[q.s]*T*.12,py-DY[q.s]*T*.12);ctx.lineTo(x+DX[q.s]*s,y+DY[q.s]*s);ctx.stroke();
  }else{
   const ok=got===q.c,bloom=f.solvedAt?Math.exp(-solvedFor/900):0;
   if(ok){ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.arc(px,py,Math.min(geo.pad*.46,T*(.26+.5*bloom)),0,TAU);ctx.fillStyle=withAlpha(c,.22+.45*bloom);ctx.fill();ctx.globalCompositeOperation='source-over';}
   ctx.beginPath();ctx.arc(px,py,T*.16,0,TAU);ctx.fillStyle=ok?c:'#0d191d';ctx.fill();ctx.lineWidth=T*.04;ctx.strokeStyle=got&&!ok?'#ff8e8e':c;ctx.stroke();
   glyph(ctx,hueGlyph(q.c),px,py,T*.15,ok?'#0b1418':c);
  }
 });
}
