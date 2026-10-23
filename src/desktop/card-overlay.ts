import {BrowserWindow,screen,ipcMain,type WebContents} from 'electron';
import {fileURLToPath} from 'node:url';
import type {DuelStore} from '../domain/store.js';
import type {Config} from './config.js';
import {overlayBounds,handOverlayBounds,overlayDetailBounds,type Bounds} from '../domain/overlay-layout.js';
import {WindowTracker,type GameWindow} from './window-tracker.js';
type View=ReturnType<DuelStore['view']>;
type Entry={window:BrowserWindow;ready:boolean;signature:string;data:unknown};
export class CardOverlay {
 private entries=new Map<number,Entry>();
 private frame:GameWindow={active:false};private frameAt=0;
 private selected:number|null=null;private disposed=false;
 private lastClick:number|undefined;
 private tracker=new WindowTracker(frame=>this.observe(frame));
 private timer:ReturnType<typeof setInterval>;
 constructor(private view:()=>View,private config:()=>Config){
  ipcMain.handle('overlay:state',event=>this.entry(event.sender)?.data??null);
  ipcMain.handle('overlay:select',(event,slot:number)=>{
   const source=this.entries.get(slot);
   if(source?.window.webContents!==event.sender||!source.window.isVisible())return;
   this.selected=this.selected===slot?null:slot;this.refresh();
  });
  ipcMain.handle('overlay:close',event=>{if(this.entry(event.sender)){this.selected=null;this.refresh();}});
  this.timer=setInterval(()=>this.refresh(),100);this.timer.unref();
  if(process.env.MD_TEST_MODE!=='1')this.tracker.start();
 }
 private entry(sender:WebContents){return [...this.entries.values()].find(e=>!e.window.isDestroyed()&&e.window.webContents===sender);}
 accepts(sender:WebContents){return !!this.entry(sender);}
 observe(frame:GameWindow){
  if(frame.click!==undefined&&frame.click!==this.lastClick){
   if(this.lastClick!==undefined&&Number.isFinite(frame.clickX)&&Number.isFinite(frame.clickY)){
    const p=screen.screenToDipPoint({x:frame.clickX!,y:frame.clickY!});
    const inside=[...this.entries.values()].some(e=>{
     if(!e.window.isVisible())return false;const b=e.window.getBounds();
     return p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height;
    });
    if(!inside)this.selected=null;
   }
   this.lastClick=frame.click;
  }
  this.frame=frame;this.frameAt=Date.now();this.refresh();
 }
 private ensure(key:number):Entry {
  const old=this.entries.get(key);if(old)return old;
  const window=new BrowserWindow({show:false,frame:false,transparent:true,backgroundColor:'#00000000',focusable:false,skipTaskbar:true,alwaysOnTop:true,resizable:false,movable:false,hasShadow:false,width:50,height:20,minWidth:1,minHeight:1,title:'MD助手 · 盖牌',webPreferences:{preload:fileURLToPath(new URL('./overlay-preload.cjs',import.meta.url)),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.setAlwaysOnTop(true,'pop-up-menu');window.setMenu(null);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());
  const entry:Entry={window,ready:false,signature:'',data:null};this.entries.set(key,entry);
  void window.loadFile(fileURLToPath(new URL('../ui/overlay.html',import.meta.url))).then(()=>{entry.ready=true;this.refresh();}).catch(()=>{window.hide();});
  return entry;
 }
 private place(key:number,bounds:Bounds,data:Record<string,unknown>){
  const entry=this.ensure(key);
  const dip=screen.screenToDipRect(null,bounds);
  if(key===0){
   const area=screen.getDisplayMatching(dip).workArea;
   dip.width=Math.min(dip.width,area.width);dip.height=Math.min(dip.height,area.height);
   dip.x=Math.max(area.x,Math.min(dip.x,area.x+area.width-dip.width));
   dip.y=Math.max(area.y,Math.min(dip.y,area.y+area.height-dip.height));
  }
  if(key!==0)data={...data,width:dip.width,height:dip.height};
  entry.data=data;
  const before=entry.window.getBounds();
  if(before.x!==dip.x||before.y!==dip.y||before.width!==dip.width||before.height!==dip.height)entry.window.setBounds(dip,false);
  // Windows may enforce a taller native window. Clip both paint and hit-test
  // regions to the requested card-sized rectangle.
  if(key!==0)entry.window.setShape([{x:0,y:0,width:dip.width,height:dip.height}]);
  if(!entry.ready)return;
  const signature=JSON.stringify(data);
  if(entry.signature!==signature){entry.signature=signature;entry.window.webContents.send('overlay:state',data);}
  if(!entry.window.isVisible())entry.window.showInactive();
 }
 refresh(){
  if(this.disposed)return;
  const view=this.view(),config=this.config(),frame=this.frame,s=view.overlaySnapshot;
  const handEnabled=config.handOverlayEnabled??config.overlayEnabled,backrowEnabled=config.backrowOverlayEnabled??config.overlayEnabled;
  const visible=(handEnabled||backrowEnabled)&&frame.active&&Date.now()-this.frameAt<600&&!view.paused&&s?.status==='duel'&&Number(s.session?.split(':')[0])===frame.pid&&[frame.x,frame.y,frame.width,frame.height].every(v=>typeof v==='number'&&Number.isFinite(v));
  const active=new Set<number>();
  if(visible){
   const client={x:frame.x!,y:frame.y!,width:frame.width!,height:frame.height!};
   const cards=backrowEnabled?view.backrow.cards.filter(c=>c.slot>=7&&c.slot<=11&&!view.backrow.publicSlots.includes(c.slot)):[];
   for(const card of cards){
    const bounds=overlayBounds(client,card.slot,config.overlayOffsetX,config.overlayOffsetY);if(!bounds)continue;
    const category=card.confirmedId?view.catalog[card.confirmedId]?.category:undefined;
    const label=card.positionChanged?'变动':card.confirmedId?(category?{monster:'怪',spell:'魔',trap:'陷'}[category]:'卡'):'未知';
    active.add(card.slot);this.place(card.slot,bounds,{kind:'tag',slot:card.slot,label,theme:config.theme,category});
   }
   const handCards:typeof cards=[];
   const handCount=s.counts.opponentHand;
   let handIndex=0;
   if(handEnabled&&handCount!==null&&Number.isInteger(handCount)&&handCount>0){
    for(const card of view.publicHand.cards){
     for(let copy=0;copy<card.count&&handIndex<handCount;copy++,handIndex++){
      const bounds=handOverlayBounds(client,handIndex,handCount);if(!bounds)continue;
      // Stable identity prevents an open report changing when another card leaves.
      const slot=-(card.id*128+copy+1),category=view.catalog[card.id]?.category;
      handCards.push({slot,candidates:[card.id],confirmedId:card.id,unknownPossible:false});
      active.add(slot);this.place(slot,bounds,{kind:'tag',source:'hand',slot,label:category?{monster:'怪',spell:'魔',trap:'陷'}[category]:'卡',theme:config.theme,category,name:view.catalog[card.id]?.name});
     }
    }
   }
   const chosen=[...cards,...handCards].find(c=>c.slot===this.selected);
   if(chosen&&active.has(chosen.slot)){
    active.add(0);this.place(0,overlayDetailBounds(client),{kind:'detail',theme:config.theme,card:chosen,uncertain:!chosen.confirmedId,candidates:chosen.candidates.map(id=>({id,name:view.catalog[id]?.name??`卡片 ${id}`,category:view.catalog[id]?.category,rarity:view.catalog[id]?.rarity}))});
   }else this.selected=null;
  }else this.selected=null;
  for(const [key,entry] of this.entries)if(!active.has(key)&&!entry.window.isDestroyed())entry.window.hide();
 }
 destroy(){this.disposed=true;clearInterval(this.timer);this.tracker.stop();for(const e of this.entries.values())e.window.destroy();this.entries.clear();for(const channel of ['overlay:state','overlay:select','overlay:close'])ipcMain.removeHandler(channel);}
}

