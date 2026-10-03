// Applies the migrations in drizzle/ to the local D1 database that `pnpm dev` creates.
// Start the dev server once first so the database file exists. Safe to run again.
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
const dir=new URL('../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',import.meta.url);
const file=existsSync(dir)&&readdirSync(dir).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');
if(!file){console.error('No local database yet: run `pnpm dev` once, then try again.');process.exit(1);}
const db=new DatabaseSync(new URL(file,dir).pathname);
db.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
const done=new Set(db.prepare('SELECT name FROM _local_migrations').all().map(r=>r.name));
for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){
 if(done.has(name))continue;
 const sql=readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8');
 db.exec('BEGIN');
 try{for(const part of sql.split('--> statement-breakpoint'))if(part.trim())db.exec(part);db.prepare('INSERT INTO _local_migrations VALUES (?)').run(name);db.exec('COMMIT');}
 catch(e){db.exec('ROLLBACK');console.error(`${name} failed: ${e.message}`);process.exit(1);}
 console.log('applied',name);
}
console.log('local database is up to date');
