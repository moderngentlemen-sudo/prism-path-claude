export const unlocks=[
 {id:'aurora',name:'Aurora palette',cost:150},
 {id:'sunset',name:'Sunset palette',cost:150},
 {id:'music',name:'Night music',cost:200},
 {id:'sfx',name:'Crystal sounds',cost:100},
 {id:'pack',name:'After hours chapter',cost:500},
] as const;
export function unlockProgress(cost:number,wallet:number,pending:number){
 const safe=(n:number)=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
 const credited=safe(wallet),waiting=safe(pending),earned=credited+waiting;
 return {earned,progress:Math.min(cost,earned),remaining:Math.max(0,cost-earned),affordable:credited>=cost,needsSync:credited<cost&&earned>=cost};
}
export function dustForStreak(kind:string,count:number){
 return kind==='daily'?5*Math.min(count,7):kind==='weekly'?25*Math.min(count,4):100*Math.min(count,3);
}
export const redemptionSql=`INSERT OR IGNORE INTO wallet_entries(uid,reason,amount)
 SELECT ?,?,? WHERE (SELECT COALESCE(SUM(amount),0) FROM wallet_entries WHERE uid=?)>=?`;
export const constellationGrantSql='INSERT OR IGNORE INTO wallet_entries(uid,reason,amount) SELECT ?,?,25 WHERE (SELECT COUNT(*) FROM (SELECT puzzle FROM best WHERE uid=? UNION SELECT puzzle FROM guest_claims WHERE uid=?) WHERE puzzle IN (?,?,?,?,?,?,?,?,?,?))=10';
