import type {DuelStore} from './store.js';
import type {Bounds} from './overlay-layout.js';
type View=ReturnType<DuelStore['view']>;
export function preparationIndicator(view:View,pid:number|undefined){
 const s=view.snapshot;
 if(view.paused||view.stale||s?.status!=='menu'||s.preparationVisible!==true||s.readerPid!==pid||!pid)return null;
 const selection=s.deckSelection,deck=view.deck;
 const matches=!!selection&&!!deck&&deck.id===selection.id&&deck.revision===selection.revision;
 const ready=matches&&view.deckReady;
 const status=ready?'准备好决斗了':!selection?'等待选择卡组':!deck||deck.id!==selection.id?'卡表尚未获取':!matches?'卡组版本待核对':!view.deckAttributesReady?'卡片属性待更新':'卡组待核对';
 const info=matches&&deck?`主卡组 ${Object.values(deck.main).reduce((a,b)=>a+b,0)} · 额外 ${Object.values(deck.extra).reduce((a,b)=>a+b,0)}`:'请在MD助手主界面核对卡组';
 return {ready,status,name:selection?.name??'尚未选择卡组',info};
}
/** Stack below the Untapped icon with the same horizontal center and an 8px gap. */
export function preparationIndicatorBounds(client:Bounds):Bounds{
 const width=Math.min(client.width,client.height*16/9),height=width*9/16;
 const left=client.x+(client.width-width)/2,top=client.y+(client.height-height)/2;
 return {x:Math.round(left+width*1164/1366),y:Math.round(top+height*475/768),width:Math.round(width*202/1366),height:Math.round(height*92/768)};
}
