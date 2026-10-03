import {type Board,type Port,decodeTiles,encodeTile} from './optics.ts';

export type Puzzle=Board&{id:string;key:string;name:string;lesson:string;idea:number;chapter:number;goal:number[];start:number[];minTurns:number;difficulty:number};
export type RawPuzzle={id:string;name?:string;lesson?:string;idea:number;w:number;h:number;t:string;s:string;g:string;f?:number[];p:number[][];m:number;d:number};

export function decodePuzzle(raw:RawPuzzle,key=raw.id,chapter=-1):Puzzle{
 const tiles=decodeTiles(raw.t),n=raw.w*raw.h;
 if(tiles.length!==n||raw.s.length!==n||raw.g.length!==n)throw Error('Malformed puzzle '+raw.id);
 const fixed=Array(n).fill(false);for(const i of raw.f??[])fixed[i]=true;
 const ports:Port[]=raw.p.map(([s,i,out,c])=>({s,i,out:!!out,c}));
 return {id:raw.id,key,name:raw.name??'',lesson:raw.lesson??'',idea:raw.idea,chapter,w:raw.w,h:raw.h,tiles,fixed,ports,start:raw.s.split('').map(Number),goal:raw.g.split('').map(Number),minTurns:raw.m,difficulty:raw.d};
}
export function encodePuzzle(p:Board&{goal:number[];start:number[];minTurns:number},meta:{id:string;name?:string;lesson?:string;idea:number;d:number}):RawPuzzle{
 return {...meta,w:p.w,h:p.h,t:p.tiles.map(encodeTile).join(''),s:p.start.join(''),g:p.goal.join(''),...(p.fixed.some(Boolean)?{f:p.fixed.flatMap((v,i)=>v?[i]:[])}:{}),p:p.ports.map(q=>[q.s,q.i,q.out?1:0,q.c]),m:p.minTurns};
}
