import { countTotal, emptyCounts,validateDeck, type Card,type Counts,type Deck,type Inventory,type Monster,type Snapshot } from './model.js';
import {rebuildInventory,validateStock,type Checkpoint} from './inventory.js';
import {solve} from './solver.js';
export class DuelStore {
  snapshot:Snapshot|null=null;deck:Deck|null=null;catalog:Record<number,Card>={};
  boundSession:string|null=null;overrides:Partial<Counts>={};monsterOverride:Monster[]|null=null;checkpoint?:Checkpoint;
  paused=false;error='';lastSession:string|null=null;
  deckVerified=false;
  deckManual=false;
  private deckPrepared=false;
  accept(s:Snapshot){
    if(s.status==='duel'&&s.session!==this.lastSession){this.overrides={};this.monsterOverride=null;this.checkpoint=undefined;this.boundSession=this.deckPrepared&&this.deck?s.session:null;this.deckPrepared=false;this.lastSession=s.session;}
    if(s.status==='menu'||s.status==='waiting'){this.overrides={};this.monsterOverride=null;this.checkpoint=undefined;this.boundSession=null;this.lastSession=null;}
    if(s.status==='waiting'){this.deckPrepared=false;this.deckVerified=false;}
    this.snapshot=s;if(s.deck&&(!this.deckManual||s.deck.id!==this.deck?.id)){this.deck=s.deck;this.deckVerified=true;this.deckManual=false;this.deckPrepared=s.status==='menu';}this.error=s.status==='error'?(s.reason??'读取失败'):'';
  }
  confirmDeck(){if(!this.deck)throw Error('尚未读取牌组');this.deckVerified=true;this.boundSession=this.snapshot?.session??null;this.deckPrepared=this.snapshot?.status==='menu';}
  setDeck(deck:Deck){if(!validateDeck(deck))throw Error('牌组须为40至60张主牌组、最多15张额外，每种卡最多3张');
    if(Object.keys(deck.extra).some(id=>!this.catalog[+id]))throw Error('额外牌组卡片属性缺失');
    this.deck=structuredClone({...deck,readAt:Date.now()});this.deckVerified=true;this.deckManual=true;this.boundSession=null;this.checkpoint=undefined;this.deckPrepared=this.snapshot?.status==='menu';
  }
  setCounts(value:Partial<Counts>){
    for(const [key,v] of Object.entries(value))if(!(key in emptyCounts())||!Number.isInteger(v)||v===null||v<0||v>200)throw Error('数量必须为0至200的整数');
    this.overrides={...this.overrides,...value};
  }
  setMonsters(value:Monster[]){
    if(!Array.isArray(value)||value.length>20||value.some(m=>!['level','rank'].includes(m.kind)||!Number.isInteger(m.value)||m.value!<=0||m.value!>99))throw Error('怪兽数值无效');
    this.monsterOverride=structuredClone(value);
  }
  setInventory(extra:unknown,banished:unknown){
    if(!this.snapshot?.session)throw Error('需要在对局中核对库存');
    const e=validateStock(extra),b=validateStock(banished);
    if(e.reduce((a,s)=>a+s.count,0)!==this.snapshot.extraCount||b.reduce((a,s)=>a+s.count,0)!==this.snapshot.banishedCount)throw Error('核对后的数量必须与当前区域总数一致');
    this.checkpoint={session:this.snapshot.session,cursor:this.snapshot.logLength,inventory:{extra:e,banished:b,quality:'manual',reasons:[]}};
  }
  restore(){this.overrides={};this.monsterOverride=null;this.checkpoint=undefined;this.deckManual=false;}
  view(now=Date.now()){
    const s=this.snapshot;const counts={...(s?.counts??emptyCounts()),...this.overrides};
    const monsters=this.monsterOverride??s?.monsters??[];
    const stale=!s||now-s.timestamp>2000||s.status==='error'||this.paused||!!this.error;
    let inventory:Inventory={extra:[],banished:[],quality:'unknown',reasons:['请先确认本次牌组']};
    if(this.deck&&s?.status==='duel'&&this.boundSession===s.session)inventory=rebuildInventory(this.deck,s,this.checkpoint);
    const missing=!!this.deck&&Object.keys(this.deck.extra).some(id=>!this.catalog[Number(id)]);
    const blocked=stale||s?.status!=='duel'||missing||this.boundSession!==s?.session||!!s?.busy;
    const result=blocked?{status:'uncertain' as const,plans:[],reason:this.error||(this.paused?'读取已暂停':stale?'数据过期，等待更新':s?.status==='waiting'?'等待 MD 启动':s?.status!=='duel'?'等待进入对局':missing?'卡片属性尚未获取完整':this.boundSession!==s?.session?'请确认本次使用的牌组':'场面处理中，等待稳定')}:solve(counts,monsters,inventory,this.catalog);
    return {snapshot:s,deck:this.deck,counts,total:countTotal(counts),monsters,inventory,result,stale,paused:this.paused,manual:Object.keys(this.overrides).length>0||!!this.monsterOverride||!!this.checkpoint,deckReady:this.deckVerified&&!!this.deck&&!missing&&(s?.status!=='duel'||this.boundSession===s.session),catalog:this.catalog};
  }
}
