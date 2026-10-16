import { createRequire } from 'node:module';
import { emptyCounts, type Deck, type Move, type Snapshot } from '../domain/model.js';
type Ref = { get: (key: string) => any; getClassName: () => string; getBaseAddress?: () => number };
export function list(ref: Ref | null, max = 10000): any[] {
  if (!ref) return [];
  const n = ref.get('_size');
  if (!Number.isInteger(n) || n < 0 || n > max) throw Error('列表长度异常，需要重新读取');
  const items = ref.get('_items');
  return Array.from({length:n},(_,i)=>items.at(i));
}
export function dictionary(ref: Ref): Map<string, any> {
  let n, entries;
  try { n=ref.get('_count'); entries=ref.get('_entries'); }
  catch { n=ref.get('count'); entries=ref.get('entries'); }
  if (!Number.isInteger(n)||n<0||n>10000) throw Error('字典长度异常');
  const result = new Map<string, any>();
  for(let i=0;i<n;i++) { const e=entries.at(i); const key=e.get('key'); if(key!==null&&key!==undefined)result.set(String(key),e.get('value')); }
  return result;
}
const num = (v: unknown) => { if(!Number.isInteger(v) || (v as number)<0 || (v as number)>1000)throw Error('读数异常');return v as number; };
export function cardId(v: unknown): number { if(!Number.isInteger(v)||(v as number)<=0||(v as number)>10000000)throw Error('卡片编号异常');return v as number; }
export function decodeAction(a: Ref, index: number, sub: number, myTeam: number, runningCard: number): Move | null {
  const l=a.get('datal'),m=a.get('datac'),r=a.get('datar');
  if(l.get('datatype')!==1 || m.get('datatype')!==3 || l.get('databyte1')!==myTeam)return null;
  const action=m.get('databyte1'), from=l.get('databyte0'), to=r.get('datatype')>0?r.get('databyte0'):null;
  return {key:`${index}:${sub}`,index,action,cardId:l.get('dataint')&65535,player:myTeam,from,to,targetPlayer:to===null?null:r.get('databyte1'),
    // Only this observed, publicly resolving effect is confirmed here. Other banishes need confirmation.
    face:action===18&&runningCard===19921?'up':'unknown',
    affectsInventory:[14,17].includes(from)||to!==null&&[14,17].includes(to)};
}
export function readActions(log: Ref, myTeam: number) {
  const base=list(log.get('m_LogBaseItemList'));
  const singles=list(log.get('m_DataList_ShowAction'),5000), batches=list(log.get('m_DataList_MoveMulti'),5000),chains=list(log.get('m_DataList_ShowChain'),5000);
  const moves: Move[]=[];let runningCard=0;
  for(let i=0;i<base.length;i++) {
    const label=base[i].get('loglabel'), idx=base[i].get('dataindex');
    if(label==='ShowChain') {
      const chain=chains[idx];if(chain){ const type=chain.get('type'); if(type===1)runningCard=chain.get('cardid');else if(type===3)runningCard=0; }
    }
    if(label==='ShowTurn'||label==='ShowPhase')runningCard=0;
    const items=label==='ShowAction'?[singles[idx]]:label==='CardMoveMulti'?list(batches[idx]?.get('actionDatas'),1000):[];
    for(let j=0;j<items.length;j++){if(!items[j])throw Error('日志条目缺失');const m=decodeAction(items[j],i,j,myTeam,runningCard);if(m)moves.push(m);}
  }
  // The opening draw blocks must be present. Absence is not silently treated as a complete history.
  const opening = base.slice(0,8).filter(x=>x.get('loglabel')==='CardMoveMulti').length>=2;
  return {moves,logLength:base.length,completeLog:opening};
}
/** Input permission also changes at prompts/opponent turns; it is not a scene-stability signal. */
export class SceneStability {
  private previous = '';
  private at = 0;
  busy(key: string, now: number) {
    const busy = key !== this.previous || now - this.at > 2000 || now < this.at;
    this.previous = key; this.at = now;
    return busy;
  }
}
export class NativeReader {
  private context: any;
  private stability = new SceneStability();
  constructor(modulePath: string, private pid: number, unityVersion: string) {
    const native=createRequire(import.meta.url)(modulePath);
    this.context=new native.Il2CppScry(native.Scry.connect(pid),{enumerateProperties:false}).getMetadataContext(unityVersion,'DuelClient');
  }
  read(): Snapshot {
    const c=this.context;
    const views=list(c.getClass('YgomGame.Menu.ContentViewControllerManager').get('Instance')?.get('viewStack'),30);
    const current=views.at(-1);let deck: Deck|null=null;
    if(current?.getClassName()==='YgomGame.DeckEditViewController2') {
      const counts=(field:string)=>{const ids:Record<string,number>={};for(const item of list(current.get(field),100)){const id=cardId(item.get('CardID'));ids[id]=(ids[id]??0)+1;}return ids;};
      deck={id:String(current.get('m_DeckID')),name:current.get('m_DeckName'),main:counts('m_MainDeckCards'),extra:counts('m_ExtraDeckCards'),readAt:Date.now()};
    }
    const result: Snapshot={status:'menu',session:null,timestamp:Date.now(),counts:emptyCounts(),monsters:[],myTeam:0,extraCount:null,banishedCount:null,moves:[],logLength:0,completeLog:false,deck};
    const d=c.getClass('YgomGame.Duel.DuelClient').get('instance');
    if(!d||!current?.getClassName()?.startsWith('YgomGame.Duel.')){this.stability=new SceneStability();return result;}
    const w=d.get('effectWorker'),g=w.get('goManager'),f=g.get('duelField'),h=d.get('handCardManager'),log=d.get('duelHUD').get('duellog');
    const myTeam=num(f.get('nearHandPlace').get('team'));if(myTeam>1)throw Error('无法确认玩家方位');
    const before=num(log.get('m_LogBaseItemList').get('_size'));
    const counts={myHand:list(h.get('nearHandInfoList'),200).length,opponentHand:list(h.get('farHandInfoList'),200).length,myField:0,opponentField:0};
    const seen=new Set<string>();
    for(const card of list(g.get('cardRoots'),300)) {
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
    for(const place of list(f.get('cardPlaces'),100))if(place.get('team')===myTeam){
      if(place.get('position')===14)result.extraCount=num(place.get('localCardNum'));
      if(place.get('position')===17)result.banishedCount=num(place.get('localCardNum'));
    }
    const events=readActions(log,myTeam);
    if(before!==log.get('m_LogBaseItemList').get('_size'))throw Error('场面更新中，等待稳定数据');
    let identity='';try{const settings=dictionary(d.get('engineInitializer').get('duelSettings'));identity=String(settings.get('duel_start_timestamp')??'');}catch{}
    const session=`${this.pid}:${d.getBaseAddress()}:${identity}`,timestamp=Date.now();
    const key=JSON.stringify({session,counts,monsters:result.monsters,extra:result.extraCount,banished:result.banishedCount,events});
    return {...result,...events,status:'duel',counts,myTeam,busy:this.stability.busy(key,timestamp),session,timestamp};
  }
}
