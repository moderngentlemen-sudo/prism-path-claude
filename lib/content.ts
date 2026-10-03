import {type Puzzle,type RawPuzzle,decodePuzzle} from './puzzle.ts';
import data from './content/puzzles-v3.json' with {type:'json'};

export type {Puzzle,RawPuzzle};
export const ideas=['Channels','Fixed tiles','Bridges','Mirrors','Prisms','Mixing','Two lights','Filters','Everything'] as const;
export const constellationNames=['The Lantern','The Compass','The Bridge','The Comet','The Prism','The Crown','The Twin Stars','The Voyager','The Aurora'] as const;
export const FREE_CHAPTERS=3;

const bank=data as unknown as {version:number;campaign:RawPuzzle[];daily:RawPuzzle[][]};
export const campaign:Puzzle[]=bank.campaign.map((raw,i)=>decodePuzzle(raw,String(i+1),Math.floor(i/10)));
export const contentVersion=bank.version;

// Daily puzzles follow the UTC weekday: Monday is gentlest, Sunday brings everything.
export const dayNumber=(date=new Date())=>Math.floor(date.getTime()/86400000);
export const dayKey=(date=new Date())=>'daily-'+date.toISOString().slice(0,10);
export const weekdayIdeas=[8,0,1,2,3,4,5] as const;
export function dailyFor(key:string):Puzzle|null{
 const m=/^daily-(\d{4}-\d{2}-\d{2})$/.exec(key);if(!m)return null;
 const date=new Date(m[1]+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==m[1])return null;
 const day=dayNumber(date),weekday=date.getUTCDay(),pool=bank.daily[weekday];
 const raw=pool[((Math.floor(day/7)%pool.length)+pool.length)%pool.length];
 return {...decodePuzzle(raw,key),name:['Sunday sky','Monday glow','Tuesday anchors','Wednesday crossings','Thursday reflections','Friday prisms','Saturday blends'][weekday]};
}
export const puzzleFor=(key:string):Puzzle|null=>/^\d+$/.test(key)?campaign[Number(key)-1]??null:dailyFor(key);
