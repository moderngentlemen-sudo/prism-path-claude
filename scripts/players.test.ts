import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {redemptionSql,walletGrantSql,guestClaimSql,guestCreditSql,grantsFor} from '../lib/rewards.ts';
import {finishSql,bestSql,pulseSql,starBoardSql,dailyBoardSql,pulseBoardSql,friendsSql,communitySql,rankParts} from '../lib/sql.ts';
import {statSql} from '../lib/analytics.ts';
const schema=readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort().map(f=>readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8')).join('\n').replaceAll('--> statement-breakpoint','');
const open=()=>{const db=new DatabaseSync(':memory:');db.exec(schema);return db;};

void test('Migrations apply in order and keep version 2 rows readable',()=>{
 const db=open();
 db.prepare('INSERT INTO finishes(id,uid,puzzle,points,stars,moves,hints,seconds,day) VALUES(?,?,?,?,?,?,?,?,?)').run('old','a','1',1500,3,1,0,4,'2026-09-12');
 const row=db.prepare('SELECT version,radiant,perfect FROM finishes WHERE id=?').get('old') as {version:number;radiant:number;perfect:number};
 assert.deepEqual({...row},{version:2,radiant:0,perfect:0});
 db.close();
});
void test('Best results keep the highest stars and radiant flag and the fewest turns',()=>{
 const db=open(),best=db.prepare(bestSql);
 best.run('a','7',2,20,0,0);best.run('a','7',3,25,1,0);best.run('a','7',1,12,0,0);
 assert.deepEqual({...db.prepare('SELECT stars,moves,radiant FROM best WHERE uid=? AND puzzle=?').get('a','7') as object},{stars:3,moves:12,radiant:1});
 db.close();
});
void test('Leaderboards: stars for the journey, fewest turns for the daily, best run for Pulse',()=>{
 const db=open(),player=db.prepare('INSERT INTO players(uid,name,listed,code) VALUES(?,?,?,?)');
 player.run('a','Ada',1,'AAAAAA');player.run('b','Bo',1,'BBBBBB');player.run('c','Hidden',0,'CCCCCC');
 const best=db.prepare(bestSql),finish=db.prepare(finishSql);
 best.run('a','1',3,5,1,1);best.run('a','2',3,6,1,0);best.run('b','1',2,9,0,0);best.run('c','1',3,1,1,1);best.run('a','daily-2026-10-03',3,9,1,0);
 assert.deepEqual(db.prepare(starBoardSql).all().map(r=>(r as {name:string}).name+':'+(r as {stars:number}).stars),['Ada:6','Bo:2']);
 finish.run('a:1','a','daily-2026-10-03',3,22,0,'2026-10-03',1,0);finish.run('a:2','a','daily-2026-10-03',2,15,1,'2026-10-03',0,0);
 finish.run('b:1','b','daily-2026-10-03',3,19,0,'2026-10-03',1,1);finish.run('c:1','c','daily-2026-10-03',3,10,0,'2026-10-03',1,1);
 const daily=db.prepare(dailyBoardSql).all('daily-2026-10-03') as {name:string;rank:number}[];
 assert.deepEqual(daily.map(r=>[r.name,rankParts(r.rank)]),[['Bo',{turns:19,hints:0}],['Ada',{turns:22,hints:0}]]);
 const pulse=db.prepare(pulseSql);pulse.run('a:p1','a',2961,450,3,30,170,'2026-10-03');pulse.run('a:p2','a',2961,600,4,40,175,'2026-10-03');pulse.run('b:p1','b',2961,500,3,20,160,'2026-10-03');pulse.run('b:p1','b',2961,999,9,9,9,'2026-10-03');
 assert.deepEqual(db.prepare(pulseBoardSql).all(2961).map(r=>(r as {score:number}).score),[600,500]);
 db.prepare('INSERT INTO friends(uid,friend) VALUES(?,?)').run('a','b');
 assert.deepEqual((db.prepare(friendsSql).all('daily-2026-10-03','a') as {name:string;rank:number}[]).map(r=>[r.name,rankParts(r.rank)]),[['Bo',{turns:19,hints:0}]]);
 assert.throws(()=>player.run('d','Dee',1,'AAAAAA'),'friend codes are unique');
 db.close();
});
void test('Stardust ledger: grants once, redemption is atomic, guest receipts bind to one account',()=>{
 const db=open(),grant=db.prepare(walletGrantSql),redeem=db.prepare(redemptionSql);
 for(const g of grantsFor({key:'1',stars:3},[]))grant.run('a',g.reason,g.amount);
 for(const g of grantsFor({key:'1',stars:3},[]))grant.run('a',g.reason,g.amount);
 assert.equal((db.prepare('SELECT SUM(amount) AS n FROM wallet_entries WHERE uid=?').get('a') as {n:number}).n,15);
 grant.run('a','earned',200);
 redeem.run('a','shop:sfx',-100,'a',100);redeem.run('a','shop:sfx',-100,'a',100);redeem.run('a','shop:glass',-200,'a',200);
 assert.equal((db.prepare('SELECT SUM(amount) AS n FROM wallet_entries WHERE uid=?').get('a') as {n:number}).n,115);
 const claim=(uid:string)=>{db.prepare(guestClaimSql).run('receipt',uid,'2','2026-10-03',1);for(const g of grantsFor({key:'2',stars:3},[]))db.prepare(guestCreditSql).run(uid,g.reason,g.amount,'receipt',uid);};
 claim('b');claim('b');claim('c');
 assert.equal((db.prepare('SELECT SUM(amount) AS n FROM wallet_entries WHERE uid=?').get('b') as {n:number}).n,15);
 assert.equal((db.prepare('SELECT COUNT(*) AS n FROM wallet_entries WHERE uid=?').get('c') as {n:number}).n,0);
 db.close();
});
void test('Anonymous counters add up per day, puzzle and kind',()=>{
 const db=open(),stat=db.prepare(statSql);
 stat.run('2026-10-03','12','solve',1);stat.run('2026-10-03','12','solve',2);stat.run('2026-10-03','12','lit',40);stat.run('2026-09-01','1','lit',99);
 assert.equal((db.prepare('SELECT n FROM stats WHERE day=? AND puzzle=? AND kind=?').get('2026-10-03','12','solve') as {n:number}).n,3);
 assert.equal((db.prepare(communitySql).get('2026-09-28') as {tiles:number}).tiles,40);
 assert.equal(db.prepare("SELECT * FROM pragma_table_info('stats')").all().length,4,'no identifying columns');
 db.close();
});
