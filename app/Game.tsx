'use client';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {PlayScreen,clearRuns,type Outcome} from './play/PlayScreen';
import {SkyHub} from './sky/SkyHub';
import {Drift} from './modes/Drift';
import {Pulse} from './modes/Pulse';
import {SettingsPanel} from './panels/SettingsPanel';
import {ShopPanel} from './panels/ShopPanel';
import {PlayerPanel} from './panels/PlayerPanel';
import {DailyPanel} from './panels/DailyPanel';
import {useSettings} from './useSettings';
import {usePlayer} from './usePlayer';
import {useStats} from './useStats';
import {audio} from './audio/engine';
import {palettes as beams} from './board/render';
import {campaign,constellationNames,dailyFor,dayKey,ideas,weekdayIdeas} from '@/lib/content';
import {restoreSave,blankSave,nextPlayable,solvedCount,canPlay,chapterOpen,type Save} from '@/lib/save';
import {palettes,constellationDone} from '@/lib/rewards';
import {dailyStreak} from '@/lib/streaks';
import {story,prologue} from '@/lib/story';
import {shareText} from '@/lib/share';
import type {InstrumentId} from '@/lib/music';

type Screen={name:'play';index:number}|{name:'daily'}|{name:'sky';chapter:number}|{name:'drift'}|{name:'pulse'};
type Panel='settings'|'shop'|'player'|'daily';
const SAVE='prism-path-save-v3',PREVIEW='prism-full-sky-preview';
const weekdayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ideaLines=['Turn the tiles so light runs from every inlet to every outlet.','Pinned tiles never turn. Read them first, then build around them.','A bridge lets two beams cross without touching.','A mirror bounces light around a corner. Turn it to choose where each beam goes.','A prism splits white light: amber ▲ left, mint ● straight, violet ■ right.','Where colours meet, they mix. Feed each receiver exactly its colours.','Two inlets, two colours: keep them apart, or blend them on purpose.','A filter passes only its colours.','Every idea at once: read the receivers first.'];
const themeWhite:Record<string,string>={sunset:'#fff0dc',aurora:'#efe6ff'};
const panelTitles:Record<Panel,[string,string]>={settings:['Settings','Sound, light, controls and privacy.'],shop:['A little more light','Stardust buys sounds and music. Palettes are earned in the sky.'],player:['Your place in the sky','Profile, friends and boards.'],daily:['Today’s light','One puzzle a day, ranked by fewest turns.']};

// The game renders only in the browser: the server sends the loading shell, then
// the first client render reads the save and opens the right screen.
const noSubscribe=()=>()=>{};
function boot(){
 let save=blankSave(),returning=false,preview=false,account=false;
 try{
  save=restoreSave(JSON.parse(localStorage.getItem(SAVE)||'null'),JSON.parse(localStorage.getItem('prism-path-save-v2')||localStorage.getItem('prism-path-save-v1')||'null'));
  returning=!localStorage.getItem(SAVE)&&solvedCount(save.stars)>0;preview=sessionStorage.getItem(PREVIEW)==='1';account=new URLSearchParams(location.search).get('account')==='1';
 }catch{}
 // First visit opens straight into puzzle 1; returning players continue where they left off.
 const target=nextPlayable(save.stars,preview,save.last);
 const screen:Screen=account?{name:'sky',chapter:Math.floor(Math.max(0,target)/10)}:target<0?{name:'sky',chapter:8}:{name:'play',index:canPlay(save.last,save.stars,false)&&!save.stars[String(save.last+1)]?save.last:target};
 return {save,returning,preview,screen,panel:account?'player' as const:null};
}

export default function Game(){
 const hydrated=useSyncExternalStore(noSubscribe,()=>true,()=>false);
 const {settings,update}=useSettings();
 const player=usePlayer();
 const stat=useStats(settings.stats);
 const [start]=useState(boot);
 const [save,setSave]=useState<Save>(start.save),[screen,setScreen]=useState<Screen>(start.screen),[panel,setPanel]=useState<Panel|null>(start.panel),[preview,setPreview]=useState(start.preview);
 const [toast,setToast]=useState(''),[feel,setFeel]=useState<{key:string;chapter:number}|null>(null),[storyFor,setStoryFor]=useState<{key:string;text:string}|null>(null),[today,setToday]=useState(()=>new Date());
 const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null),returning=start.returning;
 const say=(text:string)=>{setToast(text);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3500);};
 const keep=(next:Save)=>{setSave(next);try{localStorage.setItem(SAVE,JSON.stringify(next));}catch{say('This browser cannot save progress right now.');}};
 useEffect(()=>{const t=setInterval(()=>setToday(new Date()),60000);return()=>clearInterval(t);},[]);
 const owned=useMemo(()=>player.data?.owned??[],[player.data?.owned]);
 const fullSky=preview||owned.includes('pack');
 const earned=useMemo(()=>palettes.filter(p=>p.chapter>=0&&(constellationDone(save.stars,p.chapter)||owned.includes(p.id))).map(p=>p.id),[save.stars,owned]);
 useEffect(()=>{
  const instrument:InstrumentId=settings.instrument==='piano'||owned.includes(settings.instrument)?settings.instrument:'piano';
  const track=settings.track==='quiet-orbit'||owned.includes('music')?settings.track:'quiet-orbit';
  audio.configure({effects:settings.effects,music:settings.music,volume:settings.volume,instrument,track:screen.name==='drift'?'relax-tide':track});
 },[settings,owned,screen.name]);
 const palette=useMemo(()=>{const base=beams[settings.colours];const white=earned.includes(settings.theme)?themeWhite[settings.theme]:undefined;return white?{...base,white}:base;},[settings.colours,settings.theme,earned]);
 useEffect(()=>{document.documentElement.dataset.theme=earned.includes(settings.theme)?settings.theme:'mint';},[settings.theme,earned]);
 const solvedN=solvedCount(save.stars),showSky=solvedN>=1||returning,showShop=solvedN>=10||returning,showModes=constellationDone(save.stars,0)||returning;
 const todayKey=dayKey(today);
 const daily=useMemo(()=>dailyFor(todayKey)!,[todayKey]);
 const localStreak=dailyStreak(Object.keys(save.stars).filter(k=>k.startsWith('daily-')).map(k=>k.slice(6)),todayKey.slice(6)).count;
 const streak=player.data?.streak?.count??localStreak;
 const stardust=(player.data?.signedIn?player.data.wallet||0:0)+player.localDust;

 const record=(o:Outcome)=>{
  const before=save.stars[o.key]??0,chapter=/^\d+$/.test(o.key)?Math.floor((Number(o.key)-1)/10):-1;
  const stars={...save.stars,[o.key]:Math.max(before,o.stars)},completes=chapter>=0&&!constellationDone(save.stars,chapter)&&constellationDone(stars,chapter);
  keep({...save,stars,perfect:o.perfect?{...save.perfect,[o.key]:1}:save.perfect,routes:o.route&&chapter>=0?{...save.routes,[o.key]:o.route}:save.routes,story:completes?[...new Set([...save.story,chapter])]:save.story,last:chapter>=0?Number(o.key)-1:save.last});
  if(o.stars>before||o.key.startsWith('daily-'))void player.finish(o.key,o.actions,o.stars);
  if(completes){setStoryFor({key:o.key,text:story[chapter]});setFeel({key:o.key,chapter});if(chapter===2||chapter===8)say(`New palette: ${chapter===2?'Sunset':'Aurora'}. Choose it in Settings.`);}
 };
 const goSky=(chapter?:number)=>setScreen({name:'sky',chapter:chapter??Math.min(8,Math.floor(Math.max(0,nextPlayable(save.stars,fullSky,0))/10))});
 const next=()=>{
  if(!screen||screen.name!=='play'){goSky();return;}
  const i=nextPlayable(save.stars,fullSky,screen.index+1);
  if(i<0){goSky(8);return;}
  if(!chapterOpen(Math.floor(i/10),fullSky)||Math.floor(i/10)!==Math.floor(screen.index/10)&&showSky){goSky(Math.floor(i/10));return;}
  setScreen({name:'play',index:i});
 };
 const share=(o:Outcome,progress:number[])=>{
  const date=todayKey.slice(6),text=shareText({date,weekday:weekdayNames[today.getUTCDay()],stars:o.stars,radiant:o.radiant,perfect:o.perfect,turns:o.turns,hints:o.actions.filter(a=>a.k==='hint').length,progress});
  if(navigator.share)void navigator.share({text}).catch(()=>{});else void navigator.clipboard?.writeText(text).then(()=>say('Result copied. It shows your stars and turns, never the route.'));
 };
 const restart=async()=>{
  if(player.data?.profile&&!await player.reset()){say('Account progress could not be reset. Please retry.');return;}
  clearRuns();keep(blankSave());setPanel(null);setScreen({name:'play',index:0});say('A fresh journey begins. Your Stardust stays.');
 };
 const openFullSky=()=>{setPanel('shop');};
 const previewFullSky=()=>{setPreview(true);try{sessionStorage.setItem(PREVIEW,'1');}catch{}say('Full Sky preview is open for this session.');};
 const notice=player.notice,clearNotice=player.clearNotice;
 useEffect(()=>{if(!notice)return;const t=setTimeout(clearNotice,3600);return()=>clearTimeout(t);},[notice,clearNotice]);
 if(!hydrated)return <main className="loading" aria-busy="true"/>;
 // After a constellation is restored, one optional question rides along in the results card.
 const feelPrompt=feel&&<div className="feel"><p>You restored {constellationNames[feel.chapter]}. How did it feel?</p><div>{(['Too easy','Just right','Too hard'] as const).map((label,k)=><button key={label} className="secondary" onClick={()=>{stat('c'+feel.chapter,(`feel-${k+1}`) as 'feel-1');setFeel(null);say('Thank you.');}}>{label}</button>)}<button className="text-button" onClick={()=>setFeel(null)}>Skip</button></div></div>;
 let content;
 if(screen.name==='sky')content=<SkyHub still={settings.still} stars={save.stars} routes={save.routes} fullSky={fullSky} initial={screen.chapter} stardust={stardust} streak={streak} dailyDone={!!save.stars[todayKey]} showModes={showModes} showShop={showShop}
  onPlay={i=>setScreen({name:'play',index:i})} onDaily={()=>setPanel('daily')} onDrift={()=>setScreen({name:'drift'})} onPulse={()=>setScreen({name:'pulse'})} onShop={()=>setPanel('shop')} onPlayer={()=>setPanel('player')} onSettings={()=>setPanel('settings')} onFullSky={openFullSky}/>;
 else if(screen.name==='drift')content=<Drift settings={settings} palette={palette} onBack={()=>goSky()} onSettings={()=>setPanel('settings')}/>;
 else if(screen.name==='pulse')content=<Pulse settings={settings} palette={palette} player={player} onBack={()=>goSky()} onAccount={()=>setPanel('player')}/>;
 else if(screen.name==='daily')content=<PlayScreen key={daily.key} puzzle={daily} title={`Today · ${weekdayNames[today.getUTCDay()]}`} subtitle={`${ideas[weekdayIdeas[today.getUTCDay()]]} · ${todayKey.slice(6)}`} caption={ideaLines[weekdayIdeas[today.getUTCDay()]]} best={save.stars[todayKey]??0} settings={settings} palette={palette} showSky nextLabel="Back to the sky" onBack={()=>goSky()} onNext={()=>goSky()} onSettings={()=>setPanel('settings')} onRecord={record} onShare={share} stat={stat} dust={notice}/>;
 else{const p=campaign[screen.index],chapter=Math.floor(screen.index/10),last=screen.index%10===9;
  content=<PlayScreen key={p.key} puzzle={p} title={`${screen.index+1} · ${p.name}`} subtitle={`${constellationNames[chapter]} · ${ideas[chapter]}`} caption={screen.index===0&&!solvedN?`${prologue} ${p.lesson}`:p.lesson} best={save.stars[p.key]??0} settings={settings} palette={palette} showSky={showSky} nextLabel={last?'See the sky':'Next puzzle'} story={storyFor?.key===p.key?storyFor.text:undefined} extra={feel?.key===p.key?feelPrompt:undefined}
   onBack={()=>goSky(chapter)} onNext={last&&showSky?()=>goSky(chapter):next} onSettings={()=>setPanel('settings')} onRecord={record} stat={stat} dust={notice}/>;}
 return <div className={'app atmo-'+(screen.name==='play'?Math.floor(screen.index/10):screen.name==='sky'?screen.chapter:0)+(settings.still?' still':'')}>
  {content}
  <Dialog open={panel!==null} onOpenChange={o=>{if(!o)setPanel(null);}}>
   <DialogContent className="panel">{panel&&<><DialogTitle>{panelTitles[panel][0]}</DialogTitle><DialogDescription>{panelTitles[panel][1]}</DialogDescription>
    {panel==='settings'&&<SettingsPanel settings={settings} update={update} owned={owned} earnedPalettes={earned} onRestart={()=>void restart()}/>}
    {panel==='shop'&&<ShopPanel player={player} fullSky={fullSky} earnedPalettes={earned} onFullSky={previewFullSky} onAccount={()=>setPanel('player')}/>}
    {panel==='player'&&<PlayerPanel player={player} localStreak={localStreak}/>}
    {panel==='daily'&&<DailyPanel stars={save.stars} today={today} streak={streak} onPlay={()=>{setPanel(null);setScreen({name:'daily'});}}/>}
   </>}</DialogContent>
  </Dialog>
  {(toast||notice)&&<div className="toasts">
   {toast&&<output className="toast">{toast}</output>}
   {notice&&<output className="dust-toast" key={notice.id}>+{notice.amount} ✧ <small>{notice.label}</small></output>}
  </div>}
 </div>;
}
