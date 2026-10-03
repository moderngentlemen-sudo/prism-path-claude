import {quickBoard} from './generator.ts';
import {startRun,apply,rate} from './run.ts';
import {cleanActions} from './verify.ts';

// Pulse: an opt-in three-minute run of quick boards. Everyone gets the same boards each week.
export const PULSE_SECONDS=180;
export const MAX_PULSE_BOARDS=60;
export const weekOf=(date=new Date())=>Math.floor((Math.floor(date.getTime()/86400000)+3)/7);
export function pulseBoard(week:number,k:number){
 const [w,h]=k<3?[4,4]:k<6?[5,5]:k<10?[5,6]:[6,6];
 return quickBoard(week*1000+k+17,w,h,{fixed:k%4===3?2:0,scramble:.75});
}
// 100 for each board, plus up to 50 for using few turns.
export const boardPoints=(turns:number,minTurns:number)=>100+Math.max(0,50-5*Math.max(0,turns-minTurns));
export function verifyPulse(week:number,boards:unknown){
 if(!Number.isInteger(week)||!Array.isArray(boards)||boards.length>MAX_PULSE_BOARDS)throw Error('Invalid Pulse run');
 let score=0,turns=0;
 boards.forEach((raw,k)=>{
  const p=pulseBoard(week,k);let r=startRun('pulse',p);for(const a of cleanActions(raw))r=apply(r,p,a);
  const result=rate(r,p);if(!result.light.solved)throw Error('Board '+(k+1)+' is not solved');
  score+=boardPoints(result.turns,p.minTurns);turns+=result.turns;
 });
 return {score,solved:boards.length,turns};
}
