import {preparationIndicator,preparationIndicatorBounds} from '../domain/preparation-indicator.js';
import {BrowserWindow,screen,ipcMain,type WebContents} from 'electron';
import {fileURLToPath} from 'node:url';
import type {DuelStore} from '../domain/store.js';
import type {Config} from './config.js';
import {overlayBounds,handOverlayBounds,overlayDetailBounds,clipOverlayRegions,backrowOverlayPreview,type Bounds} from '../domain/overlay-layout.js';
import {WindowTracker,type GameWindow} from './window-tracker.js';
import {moduleOverlayBounds} from '../domain/overlay-layout.js';
import {validateModules,type ModuleId} from '../domain/modules.js';
import {renderSidebar} from '../ui/sidebar.js';
type View=ReturnType<DuelStore['view']>;
type Entry={window:BrowserWindow;ready:boolean;signature:string;data:unknown};
export class CardOverlay {
 private entries=new Map<number,Entry>();
 private frame:GameWindow={active:false};private frameAt=0;
 private selected:number|null=null;private disposed=false;
 private lastClick:number|undefined;
 private preparationRegions:Bounds[]=[];private moduleRegions:Bounds[]=[];private moduleHeight=32;private moduleDetail:{id?:number;slot?:number}|null=null;
 private tracker=new WindowTracker(frame=>this.observe(frame));
 private timer:ReturnType<typeof setInterval>;
 constructor(private view:()=>View,private config:()=>Config,private saveModules:(ids:ModuleId[])=>void=()=>{}){
  ipcMain.handle('preparation:layout',(event,regions:Bounds[])=>{
   const entry=this.entries.get(101);if(!entry||entry.window.webContents!==event.sender)return;
   const bounds=entry.window.getBounds();this.preparationRegions=clipOverlayRegions(bounds.width,bounds.height,regions);this.refresh();
  });
  ipcMain.handle('modules:state',event=>this.entries.get(100)?.window.webContents===event.sender?this.entries.get(100)?.data:null);
  ipcMain.handle('modules:choose',(event,value:unknown)=>{
   if(this.entries.get(100)?.window.webContents!==event.sender)return;
   const ids=validateModules(value);this.saveModules(ids);this.refresh();return ids;
  });
  ipcMain.handle('modules:height',(event,layout:{height:number;regions:Bounds[]})=>{
   const entry=this.entries.get(100);
   if(!entry||entry.window.webContents!==event.sender||!layout||!Number.isFinite(layout.height))return;
   const bounds=entry.window.getBounds();
   this.moduleRegions=clipOverlayRegions(bounds.width,bounds.height,layout.regions);
   this.moduleHeight=Math.max(1,Math.ceil(layout.height));this.refresh();
  });
  ipcMain.handle('modules:detail',(event,value:{id?:number;slot?:number})=>{
   if(this.entries.get(100)?.window.webContents!==event.sender||!this.entries.get(100)?.window.isVisible())return;
   if(!value||(!Number.isSafeInteger(value.id)&&!Number.isSafeInteger(value.slot)))return;
   this.selected=null;this.moduleDetail={id:value.id,slot:value.slot};this.refresh();
  });
  ipcMain.handle('overlay:state',event=>this.entry(event.sender)?.data??null);
  ipcMain.handle('overlay:select',(event,slot:number,preview=false)=>{
   const source=this.entries.get(slot);
   if(source?.window.webContents!==event.sender||!source.window.isVisible())return;
   this.moduleDetail=null;this.selected=preview===true&&slot<0?slot:this.selected===slot?null:slot;this.refresh();
  });
  ipcMain.handle('overlay:close',event=>{if(this.entry(event.sender)){this.selected=null;this.moduleDetail=null;this.refresh();}});
  this.timer=setInterval(()=>this.refresh(),100);this.timer.unref();
  if(process.env.MD_TEST_MODE!=='1')this.tracker.start();
 }
 private entry(sender:WebContents){return [...this.entries.values()].find(e=>!e.window.isDestroyed()&&e.window.webContents===sender);}
 accepts(sender:WebContents){return !!this.entry(sender);}
 observe(frame:GameWindow){
  if(frame.click!==undefined&&frame.click!==this.lastClick){
   if(this.lastClick!==undefined&&Number.isFinite(frame.clickX)&&Number.isFinite(frame.clickY)){
    const p=screen.screenToDipPoint({x:frame.clickX!,y:frame.clickY!});
    const inside=[...this.entries.entries()].some(([key,e])=>{
     if(!e.window.isVisible())return false;const b=e.window.getBounds();
     if(key===100){const visibleHeight=Math.min(b.height,this.moduleHeight);b.y+=b.height-visibleHeight;b.height=visibleHeight;}
     return p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height;
    });
    if(!inside){this.selected=null;this.moduleDetail=null;}
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
  void window.loadFile(fileURLToPath(new URL(key===101?'../ui/preparation.html':key===100?'../ui/modules.html':'../ui/overlay.html',import.meta.url))).then(()=>{entry.ready=true;this.refresh();}).catch(()=>{window.hide();});
  return entry;
 }
 private place(key:number,bounds:Bounds,data:Record<string,unknown>){
  const entry=this.ensure(key);
  const dip=screen.screenToDipRect(null,bounds);
  if(key===100)dip.width=Math.min(dip.width,300);
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
  if(key===100){
   const h=Math.min(dip.height,this.moduleHeight),tab=Math.min(h,Math.ceil(30*dip.width/260));
   const shapes=[{x:0,y:dip.height-tab,width:Math.ceil(176*dip.width/260),height:tab}];
   if(h>tab)shapes.unshift({x:0,y:dip.height-h,width:dip.width,height:h-tab});
   entry.window.setShape(this.moduleRegions.length?clipOverlayRegions(dip.width,dip.height,this.moduleRegions):shapes);
  }else if(key===101){
   const regions=clipOverlayRegions(dip.width,dip.height,this.preparationRegions);
   entry.window.setShape(regions.length?regions:[{x:0,y:0,width:Math.ceil(dip.width*32/202),height:Math.ceil(dip.width*32/210)}]);
  }else if(key!==0)entry.window.setShape([{x:0,y:0,width:dip.width,height:dip.height}]);
  if(!entry.ready)return;
  const signature=JSON.stringify(data);
  if(entry.signature!==signature){entry.signature=signature;entry.window.webContents.send('overlay:state',data);}
  if(!entry.window.isVisible())entry.window.showInactive();
 }
 refresh(){
  if(this.disposed)return;
  const view=this.view(),config=this.config(),frame=this.frame,s=view.overlaySnapshot;
  const handEnabled=config.handOverlayEnabled??config.overlayEnabled,backrowEnabled=config.backrowOverlayEnabled??config.overlayEnabled;
  const visible=frame.active&&Date.now()-this.frameAt<600&&!view.paused&&s?.status==='duel'&&s.duelStarted===true&&Number(s.session?.split(':')[0])===frame.pid&&[frame.x,frame.y,frame.width,frame.height].every(v=>typeof v==='number'&&Number.isFinite(v));
  const active=new Set<number>();
  const preparation=preparationIndicator(view,frame.pid);
  if(preparation&&frame.active&&Date.now()-this.frameAt<600&&[frame.x,frame.y,frame.width,frame.height].every(v=>typeof v==='number'&&Number.isFinite(v))){
   active.add(101);this.place(101,preparationIndicatorBounds({x:frame.x!,y:frame.y!,width:frame.width!,height:frame.height!}),{kind:'preparation',...preparation});
  }
  if(visible){
   const client={x:frame.x!,y:frame.y!,width:frame.width!,height:frame.height!};
   if(config.infoOverlayEnabled!==false){active.add(100);this.place(100,moduleOverlayBounds(client),{kind:'modules',markup:renderSidebar({...view,config}),selectedModules:config.selectedModules??[],theme:config.theme});}else this.moduleDetail=null;
   const cards=view.backrow.cards.filter(c=>c.slot>=7&&c.slot<=11&&!view.backrow.publicSlots.includes(c.slot));
   for(const card of backrowEnabled?cards:[]){
    if(!card.confirmedId&&card.candidates.length===0)continue;
    const preview=backrowOverlayPreview(card,view.backrow.uncertain),knownId=preview.id,known=knownId?view.catalog[knownId]:undefined;
    const bounds=overlayBounds(client,card.slot,config.overlayOffsetX,config.overlayOffsetY,!!knownId);if(!bounds)continue;
    const category=known?.category;
    const label=card.positionChanged?'变动':knownId?(category?{monster:'怪',spell:'魔',trap:'陷'}[category]:'卡'):'未知';
    active.add(card.slot);this.place(card.slot,bounds,{kind:'tag',slot:card.slot,label,theme:config.theme,category,style:knownId?'thumbnail':'label',possible:preview.possible,name:known?.name,password:known?.password});
   }
   const handCards:typeof cards=[];
   const handCount=s.counts.opponentHand;
   let handIndex=0;
   if(handCount!==null&&Number.isInteger(handCount)&&handCount>0){
    for(const card of view.publicHand.cards){
     for(let copy=0;copy<card.count&&handIndex<handCount;copy++,handIndex++){
      const bounds=handOverlayBounds(client,handIndex,handCount,config.handOverlayStyle);if(!bounds)continue;
      // Stable identity prevents an open report changing when another card leaves.
      const slot=-(card.id*128+copy+1),category=view.catalog[card.id]?.category;
      handCards.push({slot,candidates:[card.id],confirmedId:card.id,unknownPossible:false});
      if(handEnabled){active.add(slot);this.place(slot,bounds,{kind:'tag',source:'hand',style:config.handOverlayStyle??'thumbnail',slot,label:category?{monster:'怪',spell:'魔',trap:'陷'}[category]:'卡',theme:config.theme,category,name:view.catalog[card.id]?.name,password:view.catalog[card.id]?.password});}
     }
    }
   }
   let chosen=[...cards,...handCards].find(c=>c.slot===this.selected);
   if(this.moduleDetail){
    const {id,slot}=this.moduleDetail;
    if(slot!==undefined)chosen=view.backrow.cards.find(c=>c.slot===slot);
    else if(view.publicHand.cards.some(c=>c.id===id))chosen={slot:-1,candidates:[id!],confirmedId:id,unknownPossible:false};
    else if(view.publicHand.uncertainCards.some(c=>c.id===id))chosen={slot:-1,candidates:[id!],unknownPossible:true};
    else chosen=view.backrow.cards.find(c=>c.candidates.includes(id!));
    if(!chosen)this.moduleDetail=null;
   }
   if(chosen&&(active.has(chosen.slot)||this.moduleDetail)){
    active.add(0);this.place(0,overlayDetailBounds(client),{kind:'detail',theme:config.theme,card:chosen,uncertain:!chosen.confirmedId||(chosen.slot>=7&&view.backrow.uncertain),candidates:chosen.candidates.map(id=>({id,name:view.catalog[id]?.name??`卡片 ${id}`,category:view.catalog[id]?.category,rarity:view.catalog[id]?.rarity}))});
   }else this.selected=null;
  }else {this.selected=null;this.moduleDetail=null;}
  for(const [key,entry] of this.entries)if(!active.has(key)&&!entry.window.isDestroyed()){
   if(key===101&&entry.window.isVisible())entry.window.webContents.send('preparation:hidden');
   if(key===100&&entry.window.isVisible())entry.window.webContents.send('modules:hidden');
   entry.window.hide();
  }
 }
 destroy(){this.disposed=true;clearInterval(this.timer);this.tracker.stop();for(const e of this.entries.values())e.window.destroy();this.entries.clear();for(const channel of ['preparation:layout','overlay:state','overlay:select','overlay:close','modules:state','modules:choose','modules:height','modules:detail'])ipcMain.removeHandler(channel);}
}

