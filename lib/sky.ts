import type {Route} from './save.ts';

// Ten stars per constellation, in a 220 x 130 frame (kept from the original sky).
export const shapes:[number,number][][]=[
 [[90,18],[130,18],[150,48],[140,92],[110,112],[80,92],[70,48],[85,35],[110,48],[110,85]],
 [[110,12],[125,48],[180,65],[125,80],[110,118],[95,80],[40,65],[95,48],[110,35],[110,65]],
 [[22,95],[40,65],[65,40],[90,30],[115,35],[140,50],[165,75],[195,95],[140,95],[65,95]],
 [[25,110],[60,90],[90,70],[125,50],[155,20],[185,40],[175,70],[145,65],[105,45],[55,35]],
 [[110,15],[145,58],[180,100],[110,100],[40,100],[75,58],[110,65],[155,65],[180,45],[200,35]],
 [[25,40],[55,65],[75,20],[110,60],[145,20],[165,65],[195,40],[175,105],[110,105],[45,105]],
 [[55,20],[80,55],[55,95],[30,55],[90,60],[115,65],[155,30],[180,65],[155,105],[130,65]],
 [[25,90],[60,65],[95,75],[130,45],[165,60],[190,25],[150,15],[120,30],[100,20],[75,40]],
 [[20,90],[40,45],[65,65],[85,20],[105,60],[125,30],[145,80],[165,40],[185,65],[200,100]],
];
// Where each constellation sits on the sky map (1000 x 1700), climbing from the Lantern to the Aurora.
export const placements:[number,number][]=[[300,1500],[660,1330],[300,1160],[660,990],[300,820],[660,650],[300,480],[660,310],[480,120]];
export const SKY_W=1000,SKY_H=1700,SCALE=1.55;
export const starAt=(c:number,k:number)=>{const [px,py]=placements[c],[sx,sy]=shapes[c][k];return {x:px+(sx-110)*SCALE,y:py+(sy-65)*SCALE};};
// A solved route becomes the stroke between two stars: its inlet maps to one star,
// its outlet to the next, and its turns become the line's character.
export function strokeBetween(a:{x:number;y:number},b:{x:number;y:number},route?:Route){
 if(!route||route.cells.length<2)return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
 const pts=route.cells.map(c=>({x:c%route.w,y:Math.floor(c/route.w)}));
 const p0=pts[0],p1=pts.at(-1)!;let ux=p1.x-p0.x,uy=p1.y-p0.y;if(!ux&&!uy){ux=1;uy=0;}
 const len=Math.hypot(ux,uy),dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
 const scale=dist/len,ang=Math.atan2(dy,dx)-Math.atan2(uy,ux),cos=Math.cos(ang),sin=Math.sin(ang);
 // Squash sideways wander so strokes stay readable between nearby stars.
 const wander=Math.min(1,26/Math.max(1,dist)*3);
 const map=(p:{x:number;y:number})=>{const rx=(p.x-p0.x)*scale,ry=(p.y-p0.y)*scale;let x=rx*cos-ry*sin,y=rx*sin+ry*cos;
  const along=(x*dx+y*dy)/dist,side=(-x*dy+y*dx)/dist*wander;x=(along*dx-side*dy)/dist;y=(along*dy+side*dx)/dist;return {x:a.x+x,y:a.y+y};};
 return pts.map(map).map((p,k)=>`${k?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
}
