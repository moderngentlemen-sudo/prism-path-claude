// A spoiler-free daily result: stars, turns, and how the light grew, never the route.
const BARS='▁▂▃▄▅▆▇█';
export function sparkline(progress:number[],width=10){
 if(!progress.length)return '';
 return Array.from({length:Math.min(width,progress.length)},(_,k)=>{const v=progress[Math.min(progress.length-1,Math.round(k*(progress.length-1)/Math.max(1,Math.min(width,progress.length)-1)))];return BARS[Math.max(0,Math.min(7,Math.round(v*7)))];}).join('');
}
export function shareText(o:{date:string;weekday:string;stars:number;radiant:boolean;perfect:boolean;turns:number;hints:number;progress:number[]}){
 return [`Prism Path · ${o.weekday} ${o.date}`,`${'★'.repeat(o.stars)}${'☆'.repeat(Math.max(0,3-o.stars))}${o.perfect?' Perfect':o.radiant?' Radiant':''}`,`${o.turns} turns · ${o.hints?`${o.hints} ${o.hints===1?'hint':'hints'}`:'no hints'}`,sparkline(o.progress)].join('\n');
}
