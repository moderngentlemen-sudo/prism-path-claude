import {test} from 'node:test';
import assert from 'node:assert/strict';
import {type Board,type Tile,AMBER,MINT,VIOLET,WHITE,N,E,S,W,shine,rotateMask,fewestTurns,stateOf,turnable,decodeTiles,encodeTile,hueGlyph,hueName} from '../lib/optics.ts';
import {solveRadiant,grade} from '../lib/solver.ts';
import {build,buildUnique,quickBoard} from '../lib/generator.ts';

const pipe=(m:number):Tile=>({k:'pipe',m});
const row=(tiles:Tile[],extra:Partial<Board>={}):Board=>({w:tiles.length,h:1,tiles,fixed:tiles.map(()=>false),ports:[{s:W,i:0,out:false,c:WHITE},{s:E,i:tiles.length-1,out:true,c:WHITE}],...extra});

void test('Straight channels carry white light from inlet to outlet; a wrong turn leaks',()=>{
 const b=row([pipe(5),pipe(5),pipe(5)]);
 assert.equal(shine(b,[1,1,1]).solved,true);
 assert.equal(shine(b,[1,1,1]).radiant,true);
 const blocked=shine(b,[1,0,1]);
 assert.equal(blocked.solved,false);
 assert.deepEqual(blocked.leaks.map(l=>[l.i,l.s]),[[0,E]]);
 assert.equal(blocked.litCount,1);
});

void test('A prism sends amber left, mint straight and violet right of its travel',()=>{
 // 3x3: inlet west into the centre prism; three receivers around it.
 const tiles:Tile[]=[pipe(1),{k:'recv',c:AMBER},pipe(1),pipe(5),{k:'prism'},{k:'recv',c:MINT},pipe(1),{k:'recv',c:VIOLET},pipe(1)];
 const b:Board={w:3,h:3,tiles,fixed:tiles.map(()=>false),ports:[{s:W,i:3,out:false,c:WHITE}]};
 // recv base opening is west; turn 3 faces south, 1 faces north, 2 faces east... receivers point toward the prism.
 const rot=[0,3,0,1,0,0,0,1,0];
 const light=shine(b,rot);
 assert.equal(light.recv[1],AMBER);assert.equal(light.recv[5],MINT);assert.equal(light.recv[7],VIOLET);
 assert.equal(light.satisfied,3);
 // Turning the prism a quarter turn puts its input face north: west light is absorbed.
 const turned=shine(b,rot.map((v,i)=>i===4?1:v));
 assert.equal(turned.recv[1]|turned.recv[5]|turned.recv[7],0);
 assert.equal(turned.leaks.length,0,'absorbed light is not a leak');
});

void test('Coloured light passing a prism leaves only through its own face',()=>{
 const tiles:Tile[]=[pipe(5),{k:'prism'},pipe(5)];
 const b:Board={w:3,h:1,tiles,fixed:[false,false,false],ports:[{s:W,i:0,out:false,c:MINT},{s:E,i:2,out:true,c:MINT}]};
 assert.equal(shine(b,[1,0,1]).solved,true);
 const amber={...b,ports:[{s:W,i:0,out:false,c:AMBER},{s:E,i:2,out:true,c:AMBER}]};
 const lit=shine(amber,[1,0,1]);assert.equal(lit.solved,false);assert.equal(lit.leaks.length,1,'amber turns north out of the board');
});

void test('Bridges keep crossing beams apart and mirrors reflect',()=>{
 // Plus shape: west inlet amber crosses a bridge to east; north inlet violet crosses south.
 const tiles:Tile[]=[pipe(1),pipe(5),pipe(1),pipe(5),{k:'bridge'},pipe(5),pipe(1),pipe(5),pipe(1)];
 const b:Board={w:3,h:3,tiles,fixed:tiles.map(()=>false),ports:[{s:W,i:3,out:false,c:AMBER},{s:N,i:1,out:false,c:VIOLET},{s:E,i:5,out:true,c:AMBER},{s:S,i:7,out:true,c:VIOLET}]};
 const rot=[0,0,0,1,0,1,0,0,0];
 const light=shine(b,rot);
 assert.equal(light.solved,true);
 assert.equal(light.lit[4],AMBER|VIOLET);
 // A mirror in place of the bridge sends west light north instead ('/', one turn).
 const mirror={...b,tiles:b.tiles.map((t,i)=>i===4?{k:'mirror'} as Tile:t)};
 assert.equal(shine(mirror,rot.map((v,i)=>i===4?1:v)).solved,false);
 assert.equal(shine(mirror,rot.map((v,i)=>i===4?0:v)).solved,false);
});

void test('Filters pass only their colours; receivers need exactly their colours',()=>{
 const tiles:Tile[]=[pipe(5),{k:'filter',c:AMBER|VIOLET},{k:'recv',c:AMBER|VIOLET}];
 const b:Board={w:3,h:1,tiles,fixed:[false,false,false],ports:[{s:W,i:0,out:false,c:WHITE}]};
 // Receiver base opening faces west, so it takes light from the filter at turn 0.
 assert.equal(shine(b,[1,0,0]).solved,true);
 const unfiltered={...b,tiles:[pipe(5),pipe(5),{k:'recv',c:AMBER|VIOLET}] as Tile[]};
 assert.equal(shine(unfiltered,[1,1,0]).solved,false,'a stray mint beam spoils the receiver');
 assert.equal(shine(b,[1,1,0]).litCount,1,'a turned filter refuses light');
});

void test('Turn counting respects symmetry and both directions',()=>{
 const straight=pipe(5),corner=pipe(3),cross=pipe(15);
 assert.equal(fewestTurns(straight,0,2),0);assert.equal(fewestTurns(straight,0,1),1);
 assert.equal(fewestTurns(corner,0,3),1,'one turn back');
 assert.equal(fewestTurns(corner,0,2),2);
 assert.equal(turnable(cross),false);assert.equal(turnable({k:'bridge'}),false);
 assert.equal(stateOf({k:'mirror'},2),stateOf({k:'mirror'},0));
 assert.equal(rotateMask(9),3);
 for(let m=1;m<16;m++)assert.equal(rotateMask(m,4),m);
});

void test('Tile codes round-trip and colours have glyphs and names',()=>{
 const tiles:Tile[]=[pipe(3),{k:'bridge'},{k:'mirror'},{k:'prism'},{k:'filter',c:5},{k:'recv',c:2}];
 assert.deepEqual(decodeTiles(tiles.map(encodeTile).join('')),tiles);
 assert.throws(()=>decodeTiles('x1'));
 assert.equal(hueGlyph(WHITE),'✦');assert.equal(hueGlyph(AMBER|VIOLET),'▲■');
 assert.equal(hueName(AMBER|VIOLET),'amber and violet');
});

void test('The solver finds the single radiant arrangement and rejects ambiguity',()=>{
 const b=row([pipe(5),pipe(5),pipe(5)]);
 const solved=solveRadiant(b,[0,0,0]);
 assert.equal(solved.count,1);assert.deepEqual(solved.solutions[0],[1,1,1]);
 assert.ok(grade(b,[0,0,0]).score>=0);
});

void test('Generated boards are radiant at their goal, unsolved at start and uniquely solvable',()=>{
 const specs=[{w:4,h:4},{w:5,h:5,fixed:3},{w:5,h:5,bridges:1},{w:5,h:5,mirrors:1},{w:5,h:5,prisms:1,receivers:3},{w:6,h:6,prisms:1,merges:1,receivers:3},{w:6,h:6,prisms:1,filters:1,receivers:3}];
 for(const [k,spec] of specs.entries()){
  const b=buildUnique(spec,100+k);
  assert.ok(b,`spec ${k} produced a board`);
  assert.equal(shine(b!,b!.goal).radiant,true);
  assert.equal(shine(b!,b!.start).solved,false);
  const sol=solveRadiant(b!,b!.goal,2);assert.equal(sol.count,1);
  assert.ok(b!.minTurns>0);
 }
});

void test('Quick boards are deterministic, solvable and chain row to row',()=>{
 const a=quickBoard(7,5,5,{inRow:2}),b=quickBoard(7,5,5,{inRow:2});
 assert.deepEqual(a,b);assert.equal(shine(a,a.goal).solved,true);assert.equal(shine(a,a.start).solved,false);
 assert.equal(a.ports.find(p=>!p.out)!.i,10);
 assert.ok(build({w:4,h:4},1)!==undefined);
});
