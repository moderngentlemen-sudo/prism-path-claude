const dayMs=86400000;
export function periods(day:string){const d=new Date(day+'T00:00:00Z'),n=Math.floor(d.getTime()/dayMs);return {daily:n,weekly:Math.floor((n+3)/7),monthly:d.getUTCFullYear()*12+d.getUTCMonth()};}
export function streaks(days:string[],today:string){
 const now=periods(today),all=days.map(periods);
 return (['daily','weekly','monthly'] as const).map((kind,i)=>{const set=new Set(all.map(p=>p[kind]));let at=now[kind];const active=set.has(at);if(!active)at--;let count=0;while(set.has(at--))count++;return {kind,count,active,period:String(now[kind]),bonus:[50,250,1000][i]*Math.min(active?count:count+1,[7,4,3][i])};});
}
