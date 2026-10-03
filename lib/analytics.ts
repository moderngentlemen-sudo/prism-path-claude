// Anonymous play statistics: counts per puzzle and day, with no account, device ID or address.
export const statKinds=['start','connect','solve','radiant','perfect','quit','hint','undo','reverse','lit','feel-1','feel-2','feel-3'] as const;
export type StatKind=typeof statKinds[number];
export type StatEvent={p:string;k:StatKind;n:number};
const bucket=/^(?:[1-9]|[1-8][0-9]|90|daily|drift|pulse|c[0-8])$/;
export function cleanEvents(raw:unknown):StatEvent[]{
 if(!Array.isArray(raw)||raw.length>200)throw Error('Invalid statistics');
 return raw.map(e=>{
  const v=e as {p?:unknown;k?:unknown;n?:unknown};
  if(!v||typeof v.p!=='string'||!bucket.test(v.p)||!statKinds.includes(v.k as StatKind)||!Number.isInteger(v.n)||(v.n as number)<1||(v.n as number)>50)throw Error('Invalid statistic');
  return {p:v.p,k:v.k as StatKind,n:v.n as number};
 });
}
export const statSql='INSERT INTO stats(day,puzzle,kind,n) VALUES(?,?,?,?) ON CONFLICT(day,puzzle,kind) DO UPDATE SET n=n+excluded.n';
export const statBucket=(key:string)=>/^\d+$/.test(key)?key:key.startsWith('daily-')?'daily':key;
