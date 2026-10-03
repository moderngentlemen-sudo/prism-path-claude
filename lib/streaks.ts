// The daily streak counts consecutive UTC days with a solved daily puzzle.
// A built-in freeze covers one missed day, at most once in any seven days.
const DAY=86400000;
const num=(d:string)=>Math.floor(Date.parse(d+'T00:00:00Z')/DAY);
const iso=(n:number)=>new Date(n*DAY).toISOString().slice(0,10);
export type Streak={count:number;active:boolean;frozen:string[];freezeReady:boolean};
// Chain ending at `end` (inclusive). A day that is not played can be frozen only
// when the day before it was played and no freeze was used in the previous 7 days.
export function chainTo(days:Iterable<string>,end:string){
 const set=new Set([...days].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).map(num));
 let at=num(end),count=0,lastFreeze=Infinity;const frozen:number[]=[];
 if(!set.has(at))return {count:0,frozen:[] as string[]};
 while(true){
  if(set.has(at)){count++;at--;continue;}
  if(set.has(at-1)&&lastFreeze-at>=7&&count>0){frozen.push(at);lastFreeze=at;at--;continue;}
  break;
 }
 return {count,frozen:frozen.map(iso)};
}
export function dailyStreak(days:Iterable<string>,today:string):Streak{
 const list=[...days],set=new Set(list),t=num(today);
 if(set.has(today)){const c=chainTo(list,today);return {count:c.count,active:true,frozen:c.frozen,freezeReady:!c.frozen.some(d=>t+1-num(d)<7)};}
 // Not played yet today: yesterday's chain survives, and a missed yesterday can still be frozen.
 const y=iso(t-1);
 if(set.has(y)){const c=chainTo(list,y);return {count:c.count,active:false,frozen:c.frozen,freezeReady:!c.frozen.some(d=>t-num(d)<7)};}
 const before=iso(t-2);
 if(set.has(before)){const c=chainTo(list,before),ready=!c.frozen.some(d=>t-num(d)<8);return {count:ready?c.count:0,active:false,frozen:c.frozen,freezeReady:ready};}
 return {count:0,active:false,frozen:[],freezeReady:true};
}
