import {database} from '@/db/client';
import {cleanEvents,statSql} from '@/lib/analytics';
export const dynamic='force-dynamic';
// Anonymous counters only. Nothing here identifies a player, device or address.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
 const raw=await request.text();if(raw.length>20000)return new Response(null,{status:413});
 let events;try{events=cleanEvents(JSON.parse(raw));}catch{return new Response(null,{status:400});}
 if(!events.length)return new Response(null,{status:204});
 try{const db=database(),day=new Date().toISOString().slice(0,10);await db.batch(events.map(e=>db.prepare(statSql).bind(day,e.p,e.k,e.n)));}catch{return new Response(null,{status:503});}
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
