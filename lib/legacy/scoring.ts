export const pulseCap=(puzzle:number)=>2+10*Math.max(0,Math.min(1,(puzzle-11)/79));
export function puzzleScore(moves:number,par:number,remaining:number,budget:number,calm=false,puzzle=11){
 const base=Math.max(1,Math.round(2000/(1+Math.max(0,moves)/Math.max(1,par))));
 const secondsLeft=Math.floor(Math.max(0,Math.min(budget,remaining)));
 const maxMultiplier=calm||budget<=0?1:pulseCap(puzzle);
 const multiplier=budget<=0?1:1+(maxMultiplier-1)*secondsLeft/budget;
 const targetBonus=moves<=par?500:0;
 return {base,multiplier,maxMultiplier,secondsLeft,targetBonus,points:Math.round(base*multiplier)+targetBonus};
}
export function cleanScores(raw:unknown):Record<string,number>{
 if(!raw||typeof raw!=='object')return {};
 return Object.fromEntries(Object.entries(raw).filter(([k,v])=>/^(?:[1-9]|[1-8][0-9]|90|daily-\d{4}-\d{2}-\d{2})$/.test(k)&&Number.isInteger(v)&&v>0&&v<=24500));
}
