import { makePuzzle,trace,rotate,turnsTo } from '../../lib/legacy/game.ts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const campaign=Array.from({length:90},(_,i)=>makePuzzle(i+1,i<8?4:i<45?5:6));
const daily=Array.from({length:365},(_,i)=>makePuzzle(1001+i,5));
for(const puzzle of [...campaign,...daily]){
 assert.equal(trace(puzzle.solution,puzzle.size).solved,true,`Unsolvable puzzle ${puzzle.id}`);
 assert.equal(trace(puzzle.initial,puzzle.size).solved,false,`Already solved ${puzzle.id}`);
 assert.ok(puzzle.par>0);
 const board=[...puzzle.initial];let moves=0;
 for(const at of puzzle.path){const turns=turnsTo(board[at],puzzle.solution[at]);for(let t=0;t<turns;t++){board[at]=rotate(board[at]);moves++;}}
 assert.equal(trace(board,puzzle.size).solved,true);assert.equal(moves,puzzle.par);
}
writeFileSync('lib/legacy/puzzles.json',JSON.stringify({campaign,daily}));
console.log('Generated and verified 90 campaign puzzles and 365 daily puzzles.');
