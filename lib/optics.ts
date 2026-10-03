// Prism Path optics. Three primaries travel independently and superpose:
// a beam's colour is a bitmask, so white light is all three at once.
export const AMBER=1,MINT=2,VIOLET=4,WHITE=7;
export const PRIMARIES=[AMBER,MINT,VIOLET] as const;
export type Hue=number;
// Sides: north, east, south, west. Masks use bit 1<<side, matching earlier saves.
export const N=0,E=1,S=2,W=3;
export const DX=[0,1,0,-1],DY=[-1,0,1,0];
export const opposite=(d:number)=>(d+2)&3;
export const bit=(d:number)=>1<<d;
export const rotateMask=(m:number,turns=1)=>{let t=turns&3,x=m;while(t--)x=((x<<1)&15)|(x>>3);return x;};
export const sidesOf=(m:number)=>[N,E,S,W].filter(d=>m&bit(d));

export type Tile=
 |{k:'pipe';m:number}      // a junction: light entering any opening leaves by every other opening
 |{k:'bridge'}             // two straight channels that cross without touching
 |{k:'mirror'}             // a two-sided diagonal mirror: two separate corner channels
 |{k:'prism'}              // white in through one face, each primary out through its own face
 |{k:'filter';c:Hue}       // a straight channel that passes only the colours in c
 |{k:'recv';c:Hue};        // an end receiver that needs exactly the colours in c
// An inlet emits c into cell i through side s; an outlet at side s of cell i needs exactly c.
export type Port={s:number;i:number;out:boolean;c:Hue};
export type Board={w:number;h:number;tiles:Tile[];fixed:boolean[];ports:Port[]};

const BACK=[E,N,W,S],SLASH=[W,S,E,N];
// The sides through which a tile, turned r quarter turns clockwise, can take or give light.
export function openings(t:Tile,r:number){
 switch(t.k){
  case 'pipe':return rotateMask(t.m,r);
  case 'filter':return r&1?bit(N)|bit(S):bit(E)|bit(W);
  case 'recv':return bit((W+r)&3);
  default:return 15;
 }
}
// Where primary p goes after entering tile t (turned r) through side s.
export function exits(t:Tile,r:number,s:number,p:number):number[]{
 switch(t.k){
  case 'pipe':{const m=rotateMask(t.m,r);return m&bit(s)?sidesOf(m&~bit(s)):[];}
  case 'bridge':return [opposite(s)];
  case 'mirror':return [(r&1?SLASH:BACK)[s]];
  case 'prism':{if(s!==((W+r)&3))return [];const travel=opposite(s);return [p===AMBER?(travel+3)&3:p===MINT?travel:(travel+1)&3];}
  case 'filter':return openings(t,r)&bit(s)&&t.c&p?[opposite(s)]:[];
  case 'recv':return [];
 }
}
// Orientations that look and behave the same share a state; turning costs are counted between states.
export const stateOf=(t:Tile,r:number)=>t.k==='pipe'?rotateMask(t.m,r):t.k==='bridge'?0:t.k==='mirror'||t.k==='filter'?r&1:r&3;
export const turnable=(t:Tile)=>stateOf(t,0)!==stateOf(t,1);
export function turnsTo(t:Tile,from:number,to:number,dir:1|-1){for(let n=0;n<4;n++)if(stateOf(t,from+dir*n)===stateOf(t,to))return n;return Infinity;}
export const fewestTurns=(t:Tile,from:number,to:number)=>Math.min(turnsTo(t,from,to,1),turnsTo(t,from,to,-1));
export const distinctTurns=(t:Tile)=>{const seen=new Set<number>(),out:number[]=[];for(let r=0;r<4;r++)if(!seen.has(stateOf(t,r))){seen.add(stateOf(t,r));out.push(r);}return out;};

export type Leak={i:number;s:number;c:Hue};
export type Light={
 lit:number[];      // primaries present in each tile
 side:number[];     // primaries crossing side s of tile i, at i*4+s
 inflow:number[];   // primaries entering tile i through side s, at i*4+s
 depth:number[];    // first step at which light reached each tile; Infinity when dark
 got:number[];      // per port: emitted colours for inlets, received colours for outlets
 recv:number[];     // primaries received by each receiver tile
 leaks:Leak[];
 objectives:number;satisfied:number;litCount:number;solved:boolean;radiant:boolean;
};
export function shine(b:Board,rot:number[]):Light{
 const n=b.w*b.h,lit=Array<number>(n).fill(0),side=Array<number>(n*4).fill(0),inflow=Array<number>(n*4).fill(0),depth=Array<number>(n).fill(Infinity),recv=Array<number>(n).fill(0),got=b.ports.map(()=>0),leak=new Map<number,number>();
 const portAt=(i:number,s:number)=>b.ports.findIndex(p=>p.i===i&&p.s===s);
 for(const p of PRIMARIES){
  const seen=new Uint8Array(n*4);let frontier:[number,number][]=[];
  b.ports.forEach((port,k)=>{if(port.out||!(port.c&p))return;got[k]|=p;if(openings(b.tiles[port.i],rot[port.i])&bit(port.s))frontier.push([port.i,port.s]);});
  for(let step=0;frontier.length;step++){
   const next:[number,number][]=[];
   for(const [i,s] of frontier){
    if(seen[i*4+s])continue;seen[i*4+s]=1;
    lit[i]|=p;side[i*4+s]|=p;inflow[i*4+s]|=p;if(step<depth[i])depth[i]=step;
    if(b.tiles[i].k==='recv')recv[i]|=p;
    for(const e of exits(b.tiles[i],rot[i],s,p)){
     side[i*4+e]|=p;
     const x=i%b.w+DX[e],y=Math.floor(i/b.w)+DY[e];
     if(x<0||y<0||x>=b.w||y>=b.h){const k=portAt(i,e);if(k>=0){if(b.ports[k].out)got[k]|=p;}else leak.set(i*4+e,(leak.get(i*4+e)||0)|p);continue;}
     const j=y*b.w+x,o=opposite(e);
     if(openings(b.tiles[j],rot[j])&bit(o))next.push([j,o]);else leak.set(i*4+e,(leak.get(i*4+e)||0)|p);
    }
   }
   frontier=next;
  }
 }
 let objectives=0,satisfied=0;
 b.ports.forEach((port,k)=>{if(!port.out)return;objectives++;if(got[k]===port.c)satisfied++;});
 b.tiles.forEach((t,i)=>{if(t.k!=='recv')return;objectives++;if(recv[i]===t.c)satisfied++;});
 const leaks=[...leak].map(([key,c])=>({i:key>>2,s:key&3,c})),litCount=lit.filter(Boolean).length,solved=objectives>0&&satisfied===objectives;
 return {lit,side,inflow,depth,got,recv,leaks,objectives,satisfied,litCount,solved,radiant:solved&&litCount===n&&!leaks.length};
}

// Names and glyphs carry colour meaning without relying on hue alone.
export const hueGlyph=(c:Hue)=>c===WHITE?'✦':(c&AMBER?'▲':'')+(c&MINT?'●':'')+(c&VIOLET?'■':'');
export const hueName=(c:Hue)=>c===WHITE?'white':[c&AMBER?'amber':'',c&MINT?'mint':'',c&VIOLET?'violet':''].filter(Boolean).join(' and ')||'no';
export const sideName=(s:number)=>['north','east','south','west'][s&3];
export const facing=(m:number)=>{const names=sidesOf(m).map(sideName);return names.length<2?names.join(''):names.slice(0,-1).join(', ')+' and '+names.at(-1);};
export const cellName=(b:{w:number},i:number)=>`row ${Math.floor(i/b.w)+1}, column ${i%b.w+1}`;

// Compact content encoding: two characters per tile (kind, parameter), one digit per rotation.
export function decodeTiles(code:string):Tile[]{
 const out:Tile[]=[];
 for(let k=0;k<code.length;k+=2){
  const kind=code[k],v=parseInt(code[k+1],16);
  if(kind==='p'&&v>=1)out.push({k:'pipe',m:v});
  else if(kind==='b')out.push({k:'bridge'});
  else if(kind==='m')out.push({k:'mirror'});
  else if(kind==='P')out.push({k:'prism'});
  else if(kind==='f'&&v>=1&&v<=7)out.push({k:'filter',c:v});
  else if(kind==='r'&&v>=1&&v<=7)out.push({k:'recv',c:v});
  else throw Error('Unknown tile code '+kind+code[k+1]);
 }
 return out;
}
export const encodeTile=(t:Tile)=>t.k==='pipe'?'p'+t.m.toString(16):t.k==='bridge'?'b0':t.k==='mirror'?'m0':t.k==='prism'?'P0':t.k==='filter'?'f'+t.c:'r'+t.c;
