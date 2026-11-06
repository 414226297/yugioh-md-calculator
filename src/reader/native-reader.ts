import {PublicDeckLog,type DeckProof} from './public-deck.js';
import { createRequire } from 'node:module';
import { emptyCounts, type Deck, type Move, type Snapshot } from '../domain/model.js';
import {dictionary,list,type Ref} from './collections.js';
import {readPreparation} from './preparation.js';
import {SnapshotUpdatingError} from './snapshot-error.js';
import {handChange,visibleHand,facedownBackrow,faceupBackrow,type HandChange} from './public-hand.js';
export {dictionary,list} from './collections.js';
const num = (v: unknown) => { if(!Number.isInteger(v) || (v as number)<0 || (v as number)>1000)throw Error('读数异常');return v as number; };
export function cardId(v: unknown): number { if(!Number.isInteger(v)||(v as number)<=0||(v as number)>10000000)throw Error('卡片编号异常');return v as number; }
/** The sampled public log must still be in an empty Draw phase (phase=0).
 * Any action/effect after the turn boundary rules out a natural-draw inference. */
export function normalDrawWindow(log:Ref,prefix:Array<{label:string;index:number}>){
  let turnIndex=-1;for(let i=prefix.length-1;i>=0;i--)if(prefix[i].label==='ShowTurn'){turnIndex=i;break;}
  if(turnIndex<0)return;
  let phaseIndex=-1;
  for(let i=turnIndex+1;i<prefix.length;i++){
    if(prefix[i].label==='ShowPhase'){
      if(indexed(log.get('m_DataList_ShowPhase'),prefix[i].index)?.get('phase')!==0)return;
      phaseIndex=i;
    }else if(prefix[i].label!=='SeparateLine')return;
  }
  return phaseIndex<0?undefined:{turnIndex,index:phaseIndex};
}
function tagNormalDraw(changes:HandChange[],log:Ref,prefix:Array<{label:string;index:number}>,index:number){
  if(!changes.some(c=>c.type==='enter'&&c.source==='draw'))return changes;
  const window=normalDrawWindow(log,prefix.slice(0,index));
  return window?changes.map(c=>c.type==='enter'&&c.source==='draw'?{...c,normalDrawTurn:window.turnIndex}:c):changes;
}
export function decodeAction(a: Ref, index: number, sub: number, myTeam: number, runningCard: number): Move | null {
  const l=a.get('datal'),m=a.get('datac'),r=a.get('datar');
  if(l.get('datatype')!==1 || m.get('datatype')!==3 || l.get('databyte1')!==myTeam)return null;
  const action=m.get('databyte1'), from=l.get('databyte0'), to=r.get('datatype')>0?r.get('databyte0'):null;
  return {key:`${index}:${sub}`,index,action,cardId:l.get('dataint')&65535,player:myTeam,from,to,targetPlayer:to===null?null:r.get('databyte1'),
    // Only this observed, publicly resolving effect is confirmed here. Other banishes need confirmation.
    face:action===18&&runningCard===19921?'up':'unknown',
    affectsInventory:[14,17].includes(from)||to!==null&&[14,17].includes(to)};
}
export function readActions(log: Ref, myTeam: number, textTable:string[]=[]) {
  const base=list(log.get('m_LogBaseItemList'));
  const singles=list(log.get('m_DataList_ShowAction'),5000), batches=list(log.get('m_DataList_MoveMulti'),5000),chains=list(log.get('m_DataList_ShowChain'),5000);
  const names=list(log.get('m_DataList_ShowCardName'),5000),texts=list(log.get('m_DataList_ShowText'),5000);
  const deckLog=new PublicDeckLog(myTeam);
  const prefix=base.map(row=>({label:row.get('loglabel'),index:row.get('dataindex')}));
  const moves: Move[]=[];const handChanges:HandChange[]=[];let runningCard=0;
  for(let i=0;i<base.length;i++) {
    const label=base[i].get('loglabel'), idx=base[i].get('dataindex');
    if(label==='ShowChain') {
      const chain=chains[idx];handChanges.push(...deckLog.chain(chain,i));if(chain){ const type=chain.get('type'); if(type===1)runningCard=chain.get('cardid');else if(type===3)runningCard=0; }
    }
    if(label==='ShowTurn'||label==='ShowPhase'||label==='SeparateLine'){runningCard=0;deckLog.boundary();}
    if(label==='ShowText')handChanges.push(...deckLog.text(textTable[texts[idx]?.get('textid')],i));
    // Turn/phase/text presentation is not evidence of a hand movement.
    if(!['ShowAction','CardMoveMulti','SeparateLine','CardMoveMultiHeader','ShowFirstPlayer','ShowTurn','ShowPhase','ShowChain','ShowTag','ShowCardName','ShowText'].includes(label)){deckLog.invalidate(i);handChanges.push({key:`${i}:unknown`,index:i,type:'invalidate'});}
    const items=label==='ShowAction'?[singles[idx]]:label==='CardMoveMulti'?list(batches[idx]?.get('actionDatas'),1000):[];
    // Associate only one directly adjacent public name with one movement.
    // Multi-card batches cannot share one identity; a single-item batch can.
    const previous=base[i-1];
    const publicName=items.length===1&&previous?.get('loglabel')==='ShowCardName'?names[previous.get('dataindex')]:undefined;
    const beforeName=base[i-2],drawAction=publicName&&beforeName?.get('loglabel')==='ShowAction'?singles[beforeName.get('dataindex')]:undefined;
    const priorDraw=drawAction?{key:`${i-2}:0`,action:drawAction}:undefined;
    for(let j=0;j<items.length;j++){if(!items[j])throw Error('日志条目缺失');const m=decodeAction(items[j],i,j,myTeam,runningCard);if(m)moves.push(m);handChanges.push(...deckLog.action(items[j],i,j,publicName),...tagNormalDraw(handChange(items[j],i,j,myTeam,publicName,priorDraw,runningCard!==0),log,prefix,i));}
  }
  // The opening draw blocks must be present. Absence is not silently treated as a complete history.
  const opening = base.slice(0,8).filter(x=>x.get('loglabel')==='CardMoveMulti').length>=2;
  const duelStarted=base.some(x=>['ShowTurn','ShowPhase'].includes(x.get('loglabel')));
  return {moves,logLength:base.length,completeLog:opening,handChanges,duelStarted,normalDraw:normalDrawWindow(log,prefix)};
}
type ActionHistory={session:string;team:number;length:number;baseIdentity:number|null;frames:number;prefix:Array<{label:string;index:number}>;runningCard:number;moves:Move[];handChanges:HandChange[];deckProof:DeckProof;textSignature:string};
function indexed(ref:Ref|null,index:number,max=5000):Ref|undefined{
  if(!ref||!Number.isInteger(index)||index<0)return;
  const size=ref.get('_size');if(!Number.isInteger(size)||size<0||size>max)throw Error('列表长度异常，需要重新读取');
  if(index>=size)return;
  return ref.get('_items').at(index);
}
/** Read the immutable log prefix from cache; sample anchors each frame and fully
 * revalidate periodically. List growth/reallocation and any mismatch fall back
 * to a complete prefix read before history can be reused. */
export function readActionsIncremental(log:Ref,myTeam:number,session:string,previous:ActionHistory|null,textTable:string[]=[]){
  const base=log.get('m_LogBaseItemList') as Ref;
  const length=base.get('_size');if(!Number.isInteger(length)||length<0||length>10000)throw Error('列表长度异常，需要重新读取');
  const items=base.get('_items') as Ref;
  let baseIdentity:number|null=null;try{const address=items.getBaseAddress?.();if(typeof address==='number'&&Number.isSafeInteger(address)&&address>0)baseIdentity=address;}catch{}
  const at=(i:number)=>{const item=(items as Ref&{at:(index:number)=>Ref}).at(i);return {label:item.get('loglabel'),index:item.get('dataindex')};};
  const same=(a:{label:string;index:number},b:{label:string;index:number})=>a.label===b.label&&a.index===b.index;
  const textSignature=JSON.stringify(textTable);
  const candidate=!!previous&&previous.textSignature===textSignature&&previous.session===session&&previous.team===myTeam&&length>=previous.length;
  let fast=candidate&&baseIdentity!==null&&previous!.baseIdentity===baseIdentity&&previous!.frames%64!==0;
  if(fast){
    const anchors=new Set<number>();for(let i=0;i<Math.min(3,previous!.length);i++)anchors.add(i);
    if(previous!.length>6)anchors.add(Math.floor(previous!.length/2));
    for(let i=Math.max(0,previous!.length-3);i<previous!.length;i++)anchors.add(i);
    for(const i of anchors)if(!same(at(i),previous!.prefix[i])){fast=false;break;}
  }
  let prefix:Array<{label:string;index:number}>;
  if(fast){prefix=previous!.prefix.slice();for(let i=previous!.length;i<length;i++)prefix.push(at(i));}
  else prefix=Array.from({length},(_,i)=>at(i));
  // A failed anchor, relocated list or periodic audit must re-decode payloads,
  // not just recheck labels and then reuse old public identities.
  const reusable=!!fast&&previous!.prefix.every((entry,i)=>same(entry,prefix[i]));
  const start=reusable?previous!.length:0;
  const singles=log.get('m_DataList_ShowAction') as Ref,batches=log.get('m_DataList_MoveMulti') as Ref,chains=log.get('m_DataList_ShowChain') as Ref,names=log.get('m_DataList_ShowCardName') as Ref;
  const moves=reusable?previous!.moves.slice():[],handChanges=reusable?previous!.handChanges.slice():[];
  let runningCard=reusable?previous!.runningCard:0;
  const deckLog=new PublicDeckLog(myTeam,reusable?previous!.deckProof:undefined);
  const texts=log.get('m_DataList_ShowText') as Ref;
  for(let i=start;i<length;i++){
    const {label,index}=prefix[i];
    if(label==='ShowChain'){
      const chain=indexed(chains,index);handChanges.push(...deckLog.chain(chain,i));if(chain){const type=chain.get('type');if(type===1)runningCard=chain.get('cardid');else if(type===3)runningCard=0;}
    }
    if(label==='ShowTurn'||label==='ShowPhase'||label==='SeparateLine'){runningCard=0;deckLog.boundary();}
    if(label==='ShowText')handChanges.push(...deckLog.text(textTable[indexed(texts,index)?.get('textid')],i));
    if(!['ShowAction','CardMoveMulti','SeparateLine','CardMoveMultiHeader','ShowFirstPlayer','ShowTurn','ShowPhase','ShowChain','ShowTag','ShowCardName','ShowText'].includes(label)){deckLog.invalidate(i);handChanges.push({key:`${i}:unknown`,index:i,type:'invalidate'});}
    const batch=label==='CardMoveMulti'?indexed(batches,index):undefined;
    const items=label==='ShowAction'?[indexed(singles,index)]:label==='CardMoveMulti'?list(batch?.get('actionDatas'),1000):[];
    const prior=i>0?prefix[i-1]:undefined;
    const publicName=items.length===1&&prior?.label==='ShowCardName'?indexed(names,prior.index):undefined;
    const beforeName=i>1?prefix[i-2]:undefined,drawAction=publicName&&beforeName?.label==='ShowAction'?indexed(singles,beforeName.index):undefined;
    const priorDraw=drawAction?{key:`${i-2}:0`,action:drawAction}:undefined;
    for(let j=0;j<items.length;j++){const item=items[j];if(!item)throw Error('日志条目缺失');const move=decodeAction(item,i,j,myTeam,runningCard);if(move)moves.push(move);handChanges.push(...deckLog.action(item,i,j,publicName),...tagNormalDraw(handChange(item,i,j,myTeam,publicName,priorDraw,runningCard!==0),log,prefix,i));}
  }
  const completeLog=prefix.slice(0,8).filter(x=>x.label==='CardMoveMulti').length>=2;
  const history:ActionHistory={session,team:myTeam,length:prefix.length,baseIdentity,frames:reusable?previous!.frames+1:1,prefix,runningCard,moves,handChanges,deckProof:deckLog.state,textSignature};
  const duelStarted=prefix.some(x=>x.label==='ShowTurn'||x.label==='ShowPhase');
  return {result:{moves,logLength:length,completeLog,handChanges,duelStarted,normalDraw:normalDrawWindow(log,prefix)},history};
}
/** Input permission also changes at prompts/opponent turns; it is not a scene-stability signal. */
export class SceneStability {
  private previous = '';
  private at = 0;
  busy(key: string, now: number, maxGap = 2000) {
    const busy = key !== this.previous || now - this.at > maxGap || now < this.at;
    this.previous = key; this.at = now;
    return busy;
  }
}
export class NativeReader {
  private context: any;
  private deferStability=false;
  private stability = new SceneStability();
  private preparationSeen=false;
  private actionHistory:ActionHistory|null=null;
  private pendingActionHistory:ActionHistory|null=null;
  constructor(modulePath: string, private pid: number, unityVersion: string, context?:{getClass:(name:string)=>any}) {
    if(context){this.context=context;this.deferStability=true;return;}
    const native=createRequire(import.meta.url)(modulePath);
    this.context=new native.Il2CppScry(native.Scry.connect(pid),{enumerateProperties:false}).getMetadataContext(unityVersion,'DuelClient');
  }
  read(): Snapshot {
    if(this.deferStability)this.pendingActionHistory=null;
    const c=this.context;
    const views=list(c.getClass('YgomGame.Menu.ContentViewControllerManager').get('Instance')?.get('viewStack'),30);
    const current=views.at(-1);let deck: Deck|null=null;
    if(current?.getClassName()==='YgomGame.DeckEditViewController2') {
      const counts=(field:string)=>{const ids:Record<string,number>={};for(const item of list(current.get(field),100)){const id=cardId(item.get('CardID'));ids[id]=(ids[id]??0)+1;}return ids;};
      deck={id:String(current.get('m_DeckID')),name:current.get('m_DeckName'),main:counts('m_MainDeckCards'),extra:counts('m_ExtraDeckCards'),readAt:Date.now()};
    }
    const result: Snapshot={status:'menu',session:null,readerPid:this.pid,timestamp:Date.now(),counts:emptyCounts(),monsters:[],myTeam:0,extraCount:null,banishedCount:null,moves:[],logLength:0,completeLog:false,deck};
    if(deck)result.deckSource='editor';
    // Capture server-backed contents while an editor/selection child view is open.
    // Do not stamp the editor's potentially unsaved card list with a saved revision.
    const preparation=views.find(v=>v.getClassName()==='YgomGame.Colosseum.ColosseumInfoViewController');
    if(preparation&&preparation!==current){
      try{const saved=readPreparation(preparation,c.getClass('YgomSystem.Utility.ClientWork').get('s_data')).deck;if(saved)result.cachedPreparationDeck=saved;}catch{}
    }
    if(current?.getClassName()==='YgomGame.Colosseum.ColosseumInfoViewController'){
      this.preparationSeen=true;
      result.preparationVisible=true;
      result.deckSource='preparation';
      try{Object.assign(result,readPreparation(current,c.getClass('YgomSystem.Utility.ClientWork').get('s_data')));}
      catch{result.deck=null;result.deckSelection=null;result.reason='准备页面牌组尚未读取完整，等待更新';}
    }else if(this.preparationSeen&&!deck&&['YgomGame.Menu.HomeViewController','YgomGame.Colosseum.ColosseumViewController','YgomGame.DeckSelectViewController2','YgomGame.DeckBrowserViewController'].includes(current?.getClassName())){
      result.deckSource='preparation';result.deckSelection=null;result.deck=null;
      result.reason='等待对战准备页面确认当前牌组';
      this.preparationSeen=views.some(v=>v.getClassName()==='YgomGame.Colosseum.ColosseumInfoViewController');
    }
    const d=c.getClass('YgomGame.Duel.DuelClient').get('instance');
    if(!d&&current?.getClassName()?.startsWith('YgomGame.Duel.'))throw new SnapshotUpdatingError('对局场面更新中，保留记录等待重读');
    if(!d||!current?.getClassName()?.startsWith('YgomGame.Duel.')){this.stability=new SceneStability();return result;}
    const w=d.get('effectWorker'),g=w.get('goManager'),f=g.get('duelField'),h=d.get('handCardManager'),log=d.get('duelHUD').get('duellog');
    const myTeam=num(f.get('nearHandPlace').get('team'));if(myTeam>1)throw Error('无法确认玩家方位');
    const before=num(log.get('m_LogBaseItemList').get('_size'));
    const opponentHand=list(h.get('farHandInfoList'),200);
    const counts={myHand:list(h.get('nearHandInfoList'),200).length,opponentHand:opponentHand.length,myField:0,opponentField:0};
    // Snapshot the public display before reading logs; verify it again before committing.
    let displayed:number[]|null=null;
    try{displayed=visibleHand(opponentHand);}catch{}
    const seen=new Set<string>();
    const roots=list(g.get('cardRoots'),300);
    try{result.opponentSetSlots=facedownBackrow(roots,myTeam);result.opponentPublicSlots=faceupBackrow(roots,myTeam);}catch{}
    for(const card of roots) {
      const place=card.get('cardLocator')?.get('cardPlace')?.get('position'),team=card.get('team');
      if(!Number.isInteger(place)||place<0||place>12||(team!==0&&team!==1))continue;
      const uid=card.get('uniqueId'), key=`${team}:${place}:${uid}`;
      if(seen.has(key))continue;seen.add(key);
      if(team===myTeam)counts.myField++;else counts.opponentField++;
      if(team!==myTeam&&place<=6&&card.get('isFace')){
        const rank=num(card.get('m_Rank')),level=num(card.get('m_Level'));
        result.monsters.push({uid,kind:rank>0?'rank':level>0?'level':'none',value:rank||level||0,faceUp:true});
      }
    }
    let opponentDeckCount:number|undefined;
    for(const place of list(f.get('cardPlaces'),100)){
      if(place.get('team')===myTeam){
        if(place.get('position')===14)result.extraCount=num(place.get('localCardNum'));
        if(place.get('position')===17)result.banishedCount=num(place.get('localCardNum'));
      }else if(place.get('team')===1-myTeam&&place.get('position')===15){
        // Deck counts only support delayed-draw inference. A missing optional
        // count must not discard otherwise valid public hand observations.
        try{opponentDeckCount=num(place.get('localCardNum'));}catch{}
      }
    }
    let identity='';try{const settings=dictionary(d.get('engineInitializer').get('duelSettings'));identity=String(settings.get('duel_start_timestamp')??'');}catch{}
    const session=`${this.pid}:${d.getBaseAddress()}:${identity}`;
    let textTable:string[]=[];
    try{textTable=list(c.getClass('YgomGame.Duel.LogShowText').get('m_TextTable'),5000);}catch{}
    let actionData:ReturnType<typeof readActions>;
    if(this.deferStability){const incremental=readActionsIncremental(log,myTeam,session,this.actionHistory,textTable);actionData=incremental.result;this.pendingActionHistory=incremental.history;}
    else actionData=readActions(log,myTeam,textTable);
    const {handChanges,normalDraw,...events}=actionData;
    if(before!==log.get('m_LogBaseItemList').get('_size'))throw new SnapshotUpdatingError('场面更新中，等待稳定数据');
    let publicHandObservation:Snapshot['publicHandObservation'];
    try{
      const after=list(h.get('farHandInfoList'),200);
      if(displayed===null||after.length!==counts.opponentHand||JSON.stringify(visibleHand(after))!==JSON.stringify(displayed)||before!==log.get('m_LogBaseItemList').get('_size'))throw Error('公开手牌更新中');
      publicHandObservation={cards:displayed,changes:handChanges,...(opponentDeckCount===undefined?{}:{drawState:{deckCount:opponentDeckCount,window:normalDraw}})};
    }catch{}
    const key=JSON.stringify({session,counts,monsters:result.monsters,extra:result.extraCount,banished:result.banishedCount,events,publicHandObservation});
    // Timestamp after all consistency reads so expensive snapshots don't
    // age themselves before they are delivered to the host process.
    const timestamp=Date.now();
    return {...result,...events,publicHandObservation,status:'duel',counts,myTeam,busy:this.deferStability?undefined:this.stability.busy(key,timestamp),session,timestamp};
  }
  /** OwnedContext calls this only after its post-read memory consistency pass. */
  finalizeOwned(snapshot:Snapshot):Snapshot{
    const timestamp=Date.now();
    if(snapshot.status==='duel'&&this.pendingActionHistory)this.actionHistory=this.pendingActionHistory;
    if(snapshot.status!=='duel'||!snapshot.session)return {...snapshot,timestamp};
    const key=JSON.stringify({session:snapshot.session,counts:snapshot.counts,monsters:snapshot.monsters,extra:snapshot.extraCount,banished:snapshot.banishedCount,events:{moves:snapshot.moves,logLength:snapshot.logLength,completeLog:snapshot.completeLog},publicHandObservation:snapshot.publicHandObservation});
    // Every owned snapshot already passed memory consistency checks; slow reads
    // must not keep an unchanged scene busy forever. Consumer freshness checks remain.
    return {...snapshot,timestamp,busy:this.stability.busy(key,timestamp,Infinity)};
  }
}
