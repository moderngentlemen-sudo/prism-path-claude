// Builds lib/content/puzzles-v3.json: the 90-puzzle curriculum and the weekday daily pools.
// Every board is checked for exactly one radiant arrangement, then graded; each slot keeps
// the candidate whose grade suits its role (introduction, ramp, twist or finale).
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {type Board,type Tile,WHITE,AMBER,MINT,VIOLET,N,E,S,W,shine,fewestTurns} from '../lib/optics.ts';
import {buildUnique,type Spec,type Built} from '../lib/generator.ts';
import {solveRadiant,grade} from '../lib/solver.ts';
import {encodePuzzle,decodePuzzle,type RawPuzzle} from '../lib/puzzle.ts';

type Role='intro'|'ramp'|'twist'|'finale';
type Slot={spec:Spec;role:Role};
const s=(w:number,h:number,extra:Partial<Spec>={},role:Role='ramp'):Slot=>({spec:{w,h,...extra},role});
const twin=(a:number,b:number):Partial<Spec>=>({inlets:[{side:W,c:a},{side:N,c:b}],outlets:[{side:E},{side:S}]});

const names=[
 ['First spark','A gentle bend','Turn it back','Every star','Ember path','Wick and glass','Lamplight','Night window','The long hall','Light the Lantern'],
 ['True north','Fixed points','Needle and dial','Bearing east','Waypoints','Pole star','Magnetic','The meridian','Dead reckoning','Find the Compass'],
 ['First crossing','Over and under','Two roads','The arch','River lights','Keystone','Span','Lantern bridge','Crossroads','Cross the Bridge'],
 ['Glancing light','Reflection','Mirror lake','Tail of fire','Bounce','Orbit','Perihelion','Long ellipse','Return','Catch the Comet'],
 ['First rainbow','Three ways','Split light','Spectrum','Refraction','Colour wheel','Glass and sun','Bright angle','Dispersion','Turn the Prism'],
 ['First blend','Two become one','Dusk','Coronet','Jewel light','Royal blend','Gilded','Diadem','Coronation','Raise the Crown'],
 ['Two lights','Side by side','Binary','Gemini','Parallel','Twin flames','Orbiting pair','Mirror twins','Double star','Join the Twins'],
 ['Gatekeeper','Tinted glass','Passage','Customs of light','Sails','Open water','Signal flags','Far shore','Starward','Guide the Voyager'],
 ['First curtain','Polar night','Ribbons','Solar wind','Shimmer','Green fire','Veils','Northern sky','Midnight sun','Wake the Aurora'],
];
const intros=[
 'Tap the dark tile to turn it. Match its openings to the light.',
 'Pinned tiles never turn. Read them first, then build around them.',
 'A bridge lets two beams cross without touching. Light keeps to its own channel.',
 'A mirror bounces light around a corner. Turn it to choose where each beam goes.',
 'A prism splits white light: amber ▲ turns left, mint ● goes straight, violet ■ turns right.',
 'Where colours meet, they mix. A ▲■ receiver needs amber and violet together, and nothing else.',
 'Two inlets, two colours. Keep the beams apart and feed each receiver its own light.',
 'A filter passes only its colours. Use it to strip a beam to what a receiver needs.',
 'Everything you have learned, under one sky.',
];
const tips=[
 ['Start where the light already is and work outward.','End tiles glow like stars once light reaches them.','An edge tile cannot open outward unless an inlet or outlet is there.','Corners bend light; straights carry it on.','Every opening must meet another for a third star.','Light every tile and let none escape.'],
 ['A pinned tile tells you where its neighbours must open.','Pinned tiles at the edge are the easiest place to start.','Work outward from each pinned tile.','Two pinned tiles can hold a whole corridor in place.'],
 ['Both channels of a bridge need light for a third star.','A bridge is open on all four sides: its neighbours must face it.','Follow one beam across, then the other.'],
 ['A mirror is open on all four sides; only its angle changes.','Try the mirror both ways and watch which tiles light.','A mirror carries two beams at once, one on each face.'],
 ['Each receiver needs exactly its colour. A stray beam spoils it.','White light must enter the prism through its flat back.','Follow each colour out of the prism to its receiver.'],
 ['Mixed light reaches every tile in its region.','A prism absorbs light that reaches its coloured faces.','Find where two colours meet first.'],
 ['Each inlet lights only its own network.','Bridges and mirrors let two networks pass through each other.','Match each receiver to the inlet that can reach it.'],
 ['A filter absorbs the colours it does not pass.','Filters work in both directions.','Check what colour reaches a filter before you trust it.'],
 ['Read the receivers first: their colours tell the story.','Start with the pinned tiles and the edges.','Every idea in the sky is here at once.'],
];
const plan:Slot[][]=[
 [s(3,3,{scramble:.6},'intro'),s(4,3,{scramble:.6}),s(4,4,{scramble:.65}),s(4,4,{scramble:.7}),s(5,4,{},'twist'),s(5,5),s(5,5,{},'finale')],
 [s(4,4,{fixed:3},'intro'),s(4,4,{fixed:3}),s(5,4,{fixed:3}),s(5,5,{fixed:4}),s(5,5,{fixed:3}),s(5,5,{fixed:2},'twist'),s(6,5,{fixed:4}),s(6,6,{fixed:5}),s(5,6,{fixed:3},'twist'),s(6,6,{fixed:4},'finale')],
 [s(4,4,{bridges:1},'intro'),s(5,4,{bridges:1}),s(5,5,{bridges:1}),s(5,5,{bridges:1,fixed:2}),s(5,5,{bridges:2}),s(6,5,{bridges:2},'twist'),s(6,6,{bridges:1}),s(6,6,{bridges:2}),s(6,6,{bridges:2,fixed:3},'twist'),s(6,6,{bridges:3},'finale')],
 [s(4,4,{mirrors:1},'intro'),s(5,4,{mirrors:1}),s(5,5,{mirrors:1}),s(5,5,{mirrors:1,bridges:1}),s(5,5,{mirrors:2}),s(6,5,{mirrors:2},'twist'),s(6,6,{mirrors:1,fixed:3}),s(6,6,{mirrors:2}),s(6,6,{mirrors:2,bridges:1},'twist'),s(6,6,{mirrors:3},'finale')],
 [s(5,4,{prisms:1,receivers:3},'intro'),s(5,5,{prisms:1,receivers:3}),s(5,5,{prisms:1,receivers:3}),s(5,5,{prisms:1,receivers:2,fixed:2}),s(6,5,{prisms:1,receivers:3}),s(6,6,{prisms:1,receivers:3,corridor:.2},'twist'),s(6,6,{prisms:1,receivers:4,bridges:1}),s(6,6,{prisms:1,receivers:3,mirrors:1}),s(6,6,{prisms:2,receivers:4},'twist'),s(6,6,{prisms:1,receivers:4,bridges:1,mirrors:1},'finale')],
 [s(5,5,{prisms:1,merges:1,receivers:3},'intro'),s(5,5,{prisms:1,merges:1,receivers:3}),s(6,5,{prisms:1,merges:1,receivers:3}),s(6,6,{prisms:1,merges:1,receivers:4}),s(6,6,{prisms:1,merges:1,receivers:3,fixed:2}),s(6,6,{prisms:1,merges:2,receivers:4},'twist'),s(6,6,{prisms:1,merges:1,receivers:3,bridges:1}),s(6,7,{prisms:1,merges:1,receivers:4,mirrors:1}),s(6,6,{prisms:2,merges:1,receivers:4},'twist'),s(7,7,{prisms:1,merges:2,receivers:4,bridges:1},'finale')],
 [s(5,5,{...twin(AMBER,VIOLET),receivers:2},'intro'),s(5,5,{...twin(AMBER,VIOLET),receivers:2}),s(6,5,{...twin(MINT,VIOLET),bridges:1,receivers:2}),s(6,6,{...twin(AMBER,MINT),receivers:3}),s(6,6,{...twin(AMBER,VIOLET),bridges:1,receivers:2}),s(6,6,{...twin(AMBER,VIOLET),mirrors:1,receivers:3},'twist'),s(6,6,{...twin(WHITE,MINT),receivers:3}),s(6,7,{...twin(AMBER,VIOLET),bridges:1,mirrors:1,receivers:3}),s(6,6,{...twin(MINT,AMBER),bridges:2,receivers:3},'twist'),s(7,7,{...twin(AMBER,VIOLET),bridges:1,mirrors:1,merges:1,receivers:4},'finale')],
 [s(5,4,{filters:1,receivers:2},'intro'),s(5,5,{filters:1,receivers:3}),s(5,5,{filters:2,receivers:3}),s(6,5,{prisms:1,filters:1,receivers:3}),s(6,6,{filters:2,receivers:3,fixed:2}),s(6,6,{prisms:1,filters:1,receivers:4},'twist'),s(6,6,{filters:2,bridges:1,receivers:3}),s(6,7,{prisms:1,filters:1,merges:1,receivers:4}),s(6,6,{filters:2,mirrors:1,receivers:3},'twist'),s(7,7,{prisms:1,filters:2,receivers:4},'finale')],
 [s(6,6,{prisms:1,bridges:1,receivers:3},'intro'),s(6,6,{mirrors:1,filters:1,receivers:3}),s(6,6,{...twin(AMBER,VIOLET),bridges:1,receivers:3}),s(6,7,{prisms:1,merges:1,mirrors:1,receivers:4}),s(7,6,{prisms:1,filters:1,bridges:1,receivers:4}),s(7,7,{prisms:1,mirrors:1,bridges:1,receivers:4},'twist'),s(7,7,{...twin(AMBER,VIOLET),mirrors:1,bridges:1,receivers:4}),s(7,7,{prisms:1,filters:1,merges:1,receivers:4,fixed:2}),s(7,7,{prisms:2,bridges:1,mirrors:1,receivers:4},'twist'),s(7,7,{prisms:1,bridges:1,mirrors:1,filters:1,merges:1,receivers:4},'finale')],
];
// Indexed by UTC weekday, Sunday first.
const weekdays:Spec[][]=[
 [{w:7,h:7,prisms:1,bridges:1,mirrors:1,receivers:4},{w:7,h:7,prisms:1,mirrors:1,filters:1,receivers:4},{w:7,h:7,prisms:1,bridges:1,merges:1,receivers:4}],
 [{w:5,h:5,scramble:.75},{w:5,h:6,scramble:.75}],
 [{w:6,h:5,fixed:3},{w:5,h:6,fixed:3},{w:6,h:6,fixed:4}],
 [{w:6,h:6,bridges:1},{w:6,h:6,bridges:2}],
 [{w:6,h:6,mirrors:1},{w:6,h:6,mirrors:1,fixed:2}],
 [{w:6,h:6,prisms:1,receivers:3},{w:6,h:6,prisms:1,receivers:3,fixed:2}],
 [{w:6,h:6,prisms:1,merges:1,receivers:3},{w:6,h:7,prisms:1,filters:1,receivers:3},{w:6,h:6,filters:2,receivers:3}],
];

// The first three lessons are drawn by hand: one turn, two corners, then a turn back.
const pipe=(m:number):Tile=>({k:'pipe',m});
function authored(w:number,h:number,tiles:Tile[],goal:number[],start:number[],ports:[number,number,boolean][]):Built{
 const board:Board={w,h,tiles,fixed:tiles.map(()=>false),ports:ports.map(([s,i,out])=>({s,i,out,c:WHITE}))};
 assert.ok(shine(board,goal).radiant);assert.ok(!shine(board,start).solved);assert.equal(solveRadiant(board,goal,2).count,1);
 return {...board,goal,start,minTurns:tiles.reduce((n,t,i)=>n+fewestTurns(t,start[i],goal[i]),0),grade:grade(board,goal)};
}
const handmade=[
 authored(3,1,[pipe(5),pipe(5),pipe(5)],[1,1,1],[1,0,1],[[W,0,false],[E,2,true]]),
 authored(2,2,[pipe(7),pipe(3),pipe(1),pipe(3)],[1,2,0,0],[1,1,0,3],[[W,0,false],[E,3,true]]),
 authored(3,2,[pipe(7),pipe(7),pipe(1),pipe(1),pipe(3),pipe(5)],[1,1,3,0,0,1],[1,1,0,0,1,0],[[W,0,false],[E,5,true]]),
];
const handLessons=['Tap the dark tile to turn it. Match its openings to the light.','Corners bend light. Turn each corner until the glow reaches the exit.','Press and hold a tile, or right-click it, to turn it back the other way.'];

function choose(spec:Spec,role:Role,seed:number,count=10):Built{
 const found:Built[]=[];
 for(let k=0;found.length<count&&k<count*6;k++){const b=buildUnique(spec,seed+k*101);if(b)found.push(b);}
 assert.ok(found.length,`No board for ${JSON.stringify(spec)}`);
 // Boards that need deep guessing make spikes; keep them only if nothing else was found.
 const fair=found.filter(b=>!b.grade!.stuck),pool=(fair.length?fair:found).sort((a,b)=>a.grade!.score-b.grade!.score||a.minTurns-b.minTurns);
 return role==='intro'?pool[0]:role==='finale'?pool.at(-1)!:role==='twist'?pool[Math.floor(pool.length*.75)]:pool[Math.floor(pool.length/2)];
}
const campaign:RawPuzzle[]=[];
plan.forEach((slots,chapter)=>{
 const offset=chapter===0?3:0;
 if(chapter===0)handmade.forEach((b,k)=>campaign.push(encodePuzzle(b,{id:String(k+1),name:names[0][k],lesson:handLessons[k],idea:0,d:b.grade!.score})));
 slots.forEach((slot,k)=>{
  const at=k+offset,id=chapter*10+at+1,b=choose(slot.spec,slot.role,id*1009);
  const lesson=chapter===0&&at===3?'Light every tile and let none escape: a sealed board earns a third star.':at===0?intros[chapter]:tips[chapter][at%tips[chapter].length];
  campaign.push(encodePuzzle(b,{id:String(id),name:names[chapter][at],lesson,idea:chapter,d:b.grade!.score}));
 });
});
assert.equal(campaign.length,90);
const daily=weekdays.map((specs,weekday)=>Array.from({length:53},(_,k)=>{
 const b=choose(specs[k%specs.length],'ramp',(weekday+1)*100003+k*977,4);
 return encodePuzzle(b,{id:`d${weekday}-${k}`,idea:[8,0,1,2,3,4,5][weekday],d:b.grade!.score});
}));
// Final verification of everything written.
for(const raw of [...campaign,...daily.flat()]){
 const p=decodePuzzle(raw);
 assert.ok(shine(p,p.goal).radiant,`goal ${p.id}`);assert.ok(!shine(p,p.start).solved,`start ${p.id}`);
 assert.equal(solveRadiant(p,p.goal,2).count,1,`unique ${p.id}`);
 for(let i=0;i<p.tiles.length;i++)if(p.fixed[i])assert.equal(p.start[i],p.goal[i]);
}
writeFileSync(new URL('../lib/content/puzzles-v3.json',import.meta.url),JSON.stringify({version:3,campaign,daily}));
console.log(`Generated ${campaign.length} campaign puzzles and ${daily.flat().length} daily puzzles.`);
console.log('Grades by chapter:\n'+[...Array(9).keys()].map(c=>campaign.slice(c*10,c*10+10).map(p=>String(p.d).padStart(3)).join(' ')).join('\n'));
console.log('Daily grades by weekday:',daily.map(pool=>Math.round(pool.reduce((a,p)=>a+p.d,0)/pool.length)).join(' '));
