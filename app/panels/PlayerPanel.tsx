'use client';
import {useState} from 'react';
import {SignInProviders} from '@/app/SignInProviders';
import type {Player} from '@/app/usePlayer';

export function PlayerPanel({player,localStreak}:{player:Player;localStreak:number}){
 const d=player.data,[code,setCode]=useState(''),[tab,setTab]=useState<'stars'|'daily'|'pulse'>('daily'),[copied,setCopied]=useState(false);
 const streak=d?.streak?.count??localStreak;
 const board=tab==='stars'?d?.stars:tab==='daily'?d?.daily:d?.pulse;
 return <div className="panel-body">
  {player.error&&<p role="alert" className="alert">{player.error} <button className="text-button" onClick={()=>void player.retry()} disabled={player.busy}>Retry</button></p>}
  {player.pending>0&&<p className="note">{player.pending} {player.pending===1?'result':'results'} waiting to sync. <button className="text-button" disabled={player.busy} onClick={()=>void player.retry()}>Retry</button>{player.error&&<button className="text-button" onClick={player.discardOldest}>Discard the oldest</button>}</p>}
  <section className="streak"><strong>{streak} day{streak===1?'':'s'}</strong><span>daily streak{d?.streak?.freezeReady!==false?' · ❄ freeze ready':''}</span><small>One missed day a week is covered automatically.</small></section>
  {!d?<p className="note">Loading player data…</p>:!d.signedIn?<section><h3>Save your sky</h3><p className="note">Connect an account to keep your Stardust, sync puzzles across devices and join the friend boards. Guest progress stays on this device until then.</p><p className="note">✧ {player.localDust.toLocaleString()} Stardust on this device.</p><SignInProviders/></section>:<>
   <section><h3>{d.profile?'Your profile':'Create your player profile'}</h3>
    <ProfileForm key={`${d.profile?.name}:${d.profile?.listed}`} player={player} profile={d.profile}/>
   </section>
   {d.profile&&<section><h3>Friends</h3>
    {d.profile.code&&<p className="note">Your friend code: <strong className="code">{d.profile.code}</strong> <button className="text-button" onClick={()=>{void navigator.clipboard?.writeText(d.profile!.code!).then(()=>setCopied(true));}}>{copied?'Copied':'Copy'}</button></p>}
    <form className="friend-form" onSubmit={e=>{e.preventDefault();void player.friend(code).then(()=>setCode(''));}}><label>Add a friend<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC123" autoCapitalize="characters"/></label><button className="secondary" disabled={player.busy||code.length!==6}>Add</button></form>
    {d.friends?.length?<ul className="friends">{d.friends.map(f=><li key={f.code}><span>{f.name}</span><span>{f.today?`${f.today.turns} turns${f.today.hints?` · ${f.today.hints} hints`:''}`:'Not played today'}</span><button className="text-button" onClick={()=>void player.friend(f.code,false)} aria-label={`Remove ${f.name}`}>Remove</button></li>)}</ul>:<p className="note">Share your code; friends’ daily results appear here, ranked by fewest turns.</p>}
   </section>}
   <a className="text-button" href={d.provider&&d.provider!=='chatgpt'?'/api/auth/signout?callbackUrl=%2Fsignout-with-chatgpt%3Freturn_to%3D%252F':'/signout-with-chatgpt?return_to=%2F'} target="_top">Sign out</a>
  </>}
  <section><h3>Boards</h3>
   <div className="tabs" role="tablist">{(['daily','stars','pulse'] as const).map(t=><button key={t} role="tab" aria-selected={tab===t} className={tab===t?'selected':''} onClick={()=>setTab(t)}>{t==='daily'?'Today':t==='stars'?'Stars':'Pulse'}</button>)}</div>
   <p className="note">{tab==='daily'?'Today’s puzzle: fewest automatic turns first, then fewest turns. No timers.':tab==='stars'?'Stars across the journey; radiant boards break ties.':'This week’s Pulse runs. Times are reported by the game.'}</p>
   {board?.length?<ol className="standings">{board.map((r,k)=><li key={k}><span>{k+1}</span><span>{r.name}</span><span>{tab==='daily'?`${r.turns} turns${r.hints?` · ${r.hints} hints`:''}`:tab==='stars'?`${r.stars} ★${r.radiant?` · ${r.radiant} radiant`:''}`:`${r.score} · ${r.boards} boards`}</span></li>)}</ol>:<p className="note">No public results yet.</p>}
   {!!d?.community&&<p className="community">This week, players lit {d.community.toLocaleString()} tiles together.</p>}
  </section>
 </div>;
}
function ProfileForm({player,profile}:{player:Player;profile:{name:string;listed:number}|null}){
 const [name,setName]=useState(profile?.name||''),[listed,setListed]=useState(!!profile?.listed);
 return <form className="profile-form" onSubmit={e=>{e.preventDefault();void player.saveProfile(name,listed);}}>
  <label>Player name<input required minLength={2} maxLength={24} value={name} onChange={e=>setName(e.target.value)} placeholder="A public nickname"/></label>
  <label className="check"><input type="checkbox" checked={listed} onChange={e=>setListed(e.target.checked)}/> Show my nickname on public boards</label>
  <button className="primary" disabled={player.busy}>{profile?'Save':'Create profile'}</button>
 </form>;
}
