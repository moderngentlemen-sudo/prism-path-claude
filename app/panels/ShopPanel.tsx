'use client';
import {unlocks,unlockProgress,palettes} from '@/lib/rewards';
import {constellationNames} from '@/lib/content';
import {audio} from '@/app/audio/engine';
import type {Player} from '@/app/usePlayer';
import type {InstrumentId} from '@/lib/music';

export function ShopPanel({player,fullSky,earnedPalettes,onFullSky,onAccount}:{player:Player;fullSky:boolean;earnedPalettes:string[];onFullSky:()=>void;onAccount:()=>void}){
 const d=player.data,wallet=d?.signedIn?d.wallet||0:0,owned=d?.owned??[];
 return <div className="panel-body">
  <section className="balance"><span className="eyebrow">Stardust</span><strong>✧ {(wallet+player.localDust).toLocaleString()}</strong>
   <p className="note">Earn 10 for each first solve, 5 for each first radiant board, 25 for each constellation and 25 for every seventh day of a daily streak. Stardust buys sounds and music; it has no cash value.</p>
   {!d?.profile&&<p className="note">{d?.signedIn?'Create your player profile to spend Stardust.':'Stardust earned here is kept on this device. Connect an account to spend it.'}</p>}
   {d?.signedIn&&player.localDust>0&&<p className="note">{player.localDust} waiting to sync. <button className="text-button" onClick={()=>void player.retry()} disabled={player.busy}>Sync now</button></p>}
  </section>
  <section><h3>Sounds and music</h3>
   {unlocks.map(item=>{const has=owned.includes(item.id),p=unlockProgress(item.cost,wallet,player.localDust);return <article key={item.id} className="shop-item">
    <div><strong>{item.name}</strong><small>{item.description}</small>{!has&&<progress max={item.cost} value={p.progress} aria-label={`${p.progress} of ${item.cost} Stardust`}/>}</div>
    <div className="shop-actions"><button className="secondary" onClick={()=>item.kind==='instrument'?audio.preview(item.id as InstrumentId):audio.previewTrack('moonrise')}>Listen</button>
     <button className="primary" disabled={has||player.busy||(!!d?.profile&&!p.affordable&&!p.needsSync)} onClick={()=>{if(!d?.profile)onAccount();else if(p.needsSync)void player.retry();else void player.redeem(item.id);}}>{has?'Owned':!d?.profile?'Connect':p.affordable?`Unlock · ${item.cost} ✧`:p.needsSync?'Sync to unlock':`${p.remaining} ✧ to go`}</button></div>
   </article>;})}
  </section>
  <section><h3>Palettes</h3><p className="note">Palettes are earned by restoring constellations.</p>
   {palettes.map(p=><div key={p.id} className="shop-item"><div><strong><i className="swatch" style={{background:p.color}}/>{p.name}</strong><small>{p.chapter<0?'Included':`Complete ${constellationNames[Math.max(0,p.chapter)]}`}</small></div><span className="owned">{p.chapter<0||earnedPalettes.includes(p.id)?'Yours':'Not yet'}</span></div>)}
  </section>
  <section className="full-sky"><h3>Full Sky</h3>
   <p>Six more constellations, from The Comet to The Aurora: 60 puzzles of mirrors, prisms, mixing light, twin inlets and filters. Three constellations, the daily puzzle and Drift stay free.</p>
   {fullSky?<p className="owned">Full Sky is open.</p>:<><p className="note">$3.99 planned one-time price. This preview build takes no payment.</p><button className="primary" onClick={onFullSky}>Preview Full Sky</button></>}
  </section>
 </div>;
}
