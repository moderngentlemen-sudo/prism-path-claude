// Statements shared by the player API and its tests.
export const finishSql='INSERT OR IGNORE INTO finishes(id,uid,puzzle,points,stars,moves,hints,seconds,day,radiant,perfect,version) VALUES(?,?,?,0,?,?,?,0,?,?,?,3)';
export const bestSql=`INSERT INTO best(uid,puzzle,points,stars,moves,radiant,perfect) VALUES(?,?,0,?,?,?,?) ON CONFLICT(uid,puzzle) DO UPDATE SET
 stars=MAX(best.stars,excluded.stars),moves=MIN(best.moves,excluded.moves),radiant=MAX(best.radiant,excluded.radiant),perfect=MAX(best.perfect,excluded.perfect)`;
export const activitySql='INSERT OR IGNORE INTO activity(uid,day) VALUES(?,?)';
export const pulseSql='INSERT OR IGNORE INTO pulse_runs(id,uid,week,score,boards,turns,seconds,day) VALUES(?,?,?,?,?,?,?,?)';
export const starBoardSql=`SELECT p.name,COALESCE((SELECT SUM(stars) FROM best WHERE uid=p.uid AND puzzle NOT LIKE 'daily-%'),0) AS stars,
 COALESCE((SELECT SUM(radiant) FROM best WHERE uid=p.uid),0) AS radiant FROM players p WHERE listed=1 ORDER BY stars DESC,radiant DESC,p.name LIMIT 50`;
// Daily rank: fewest hints first, then fewest turns; one row per player.
export const dailyBoardSql=`SELECT p.name,MIN(f.hints*100000+f.moves) AS rank,MAX(f.stars) AS stars FROM finishes f JOIN players p ON p.uid=f.uid
 WHERE f.puzzle=? AND f.version=3 AND p.listed=1 GROUP BY f.uid ORDER BY rank,p.name LIMIT 50`;
export const pulseBoardSql=`SELECT p.name,MAX(r.score) AS score,MAX(r.boards) AS boards FROM pulse_runs r JOIN players p ON p.uid=r.uid
 WHERE r.week=? AND p.listed=1 GROUP BY r.uid ORDER BY score DESC,p.name LIMIT 50`;
export const friendsSql=`SELECT p.name,p.code,(SELECT MIN(f.hints*100000+f.moves) FROM finishes f WHERE f.uid=p.uid AND f.puzzle=? AND f.version=3) AS rank
 FROM friends x JOIN players p ON p.uid=x.friend WHERE x.uid=? ORDER BY p.name`;
export const communitySql=`SELECT COALESCE(SUM(n),0) AS tiles FROM stats WHERE kind='lit' AND day>=?`;
export const rankParts=(rank:number)=>({turns:rank%100000,hints:Math.floor(rank/100000)});
