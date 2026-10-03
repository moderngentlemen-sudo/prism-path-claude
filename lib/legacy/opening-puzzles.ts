import {rotate,turnsTo} from './game.ts';
import type {JourneyPuzzle} from './journey.ts';

// Each opening has one teaching intention. Repair positions refer to tile indices,
// and all repairs are one clockwise turn: learn the route before adding turn load.
const openings=[
 {size:3,path:[0,1,2,5,8],repair:[1],name:'First spark',lesson:'Turn the highlighted straight tile once. Match its openings to the light.'},
 {size:3,path:[0,3,4,5,8],repair:[3,5],name:'A gentle bend',lesson:'Corners turn the beam. Rotate the highlighted tile, then follow the glow to the next corner.'},
 {size:3,path:[0,1,4,7,8],repair:[1,4,7],name:'Follow the glow',lesson:'Work outward from the entrance. Each connected tile shows where to look next.'},
 {size:3,path:[0,3,6,7,4,5,8],repair:[3,7,5],name:'The little detour',lesson:'The route can turn back through the middle. Follow the openings, not just the direction of the exit.'},
 {size:3,path:[0,1,2,5,4,3,6,7,8],repair:[1,5,3,7],name:'Across and back',lesson:'A path can weave across the board. Light each stretch before moving to the next.'},
 {size:3,path:[0,3,4,1,2,5,8],repair:[3,4,2,5],name:'A rising path',lesson:'Sometimes light travels upward on its way out. Corners guide it in every direction.'},
 {size:4,path:[0,1,2,3,7,11,15],repair:[1,2,3,7,11],name:'Room to explore',lesson:'A larger board, the same idea. Follow the edge; extra tiles can stay dark.'},
 {size:4,path:[0,4,5,6,10,14,15],repair:[4,5,6,10,14],name:'The staircase',lesson:'Look for alternating straight stretches and corners. Connect one step at a time.'},
 {size:4,path:[0,1,5,4,8,12,13,14,10,11,15],repair:[1,5,8,13,10,11],name:'The winding trail',lesson:'Trace the turns before rotating. Some tiles already face the right way.'},
 {size:4,path:[0,4,8,9,5,1,2,3,7,6,10,14,15],repair:[4,9,1,7,10,14],name:'Light the Lantern',lesson:'Bring together straight runs, corners and detours. Your tenth star completes the Lantern.'},
 {size:4,path:[0,1,5,9,10,11,15],repair:[1,5,10],lock:9,name:'A fixed point',lesson:'The padlock tile cannot turn and must receive light. Connect its two neighbors to carry the beam through it.'},
 {size:4,path:[0,4,8,9,10,6,7,11,15],repair:[4,9,6,15],lock:10,name:'Meet in the middle',lesson:'Read the locked corner first. Its openings tell you where the incoming and outgoing paths belong.'},
 {size:4,path:[0,1,2,6,5,9,13,14,15],repair:[2,6,9,14,15],lock:5,name:'The fixed bend',lesson:'Keep the fixed bend in your route. Turn the neighboring corners to approach and leave it.'},
 {size:4,path:[0,4,5,1,2,6,7,11,10,14,15],repair:[0,4,1,2,7,10],lock:6,name:'Find the approach',lesson:'Open the entrance, then work toward the padlock. Its direction stays constant while the route takes shape.'},
 {size:4,path:[0,1,5,4,8,9,10,6,7,11,15],repair:[0,1,5,8,9,6,11],lock:10,name:'Carry it through',lesson:'One fixed corner, one winding path. Light the padlock and continue all the way to the exit.'},
];

export function openingPuzzle(legacy:JourneyPuzzle):JourneyPuzzle{
 const spec=openings[legacy.id-1];if(!spec)return legacy;
 const {size,path,repair,lesson,name}=spec;
 // Quiet spare channels; their positions are deterministic for saved runs.
 const solution=Array.from({length:size*size},(_,i)=>[3,6,12,9,5,10][(i*3+legacy.id)%6]);
 const direction=(a:number,b:number)=>b===a-size?1:b===a+1?2:b===a+size?4:8;
 path.forEach((at,i)=>{solution[at]=(i?direction(at,path[i-1]):8)|(i===path.length-1?2:direction(at,path[i+1]));});
 const initial=[...solution];for(const at of repair)initial[at]=rotate(rotate(rotate(solution[at])));
 const par=path.reduce((sum,at)=>sum+turnsTo(initial[at],solution[at]),0);
 return {...legacy,size,path:[...path],initial,solution,par,lesson,name,locked:spec.lock===undefined?[]:[spec.lock],legacy,paceSeconds:legacy.id<11?0:Math.max(25,Math.ceil(par*(6-4*(legacy.id-11)/79)))};
}
