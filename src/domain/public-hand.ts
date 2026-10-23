import type {Snapshot} from './model.js';

export interface PublicHandView {
  cards:{id:number;count:number}[];
  uncertainCards:{id:number;count:number}[];
  status:'ready'|'partial'|'unavailable';
  reason:string;
}

/** Keep confirmed quantities separate from disclosures whose whereabouts are uncertain. */
export function publicHand(snapshot:Snapshot|null,stale=false):PublicHandView {
  const empty=(reason:string):PublicHandView=>({cards:[],uncertainCards:[],status:'unavailable',reason});
  if(snapshot?.status!=='duel'||!snapshot.session)return empty('进入对局后记录公开手牌');
  if(!snapshot.publicHandEvents)return empty('公开手牌读取待确认');
  const hand=snapshot.counts.opponentHand;
  const invalidCount=hand===null||!Number.isInteger(hand)||hand<0;
  const known=new Map<number,{min:number;max:number}>(),seen=new Set<string>();
  let partial=!snapshot.completeLog;
  const uncertain=()=>{for(const value of known.values())value.min=0;partial=true;};
  const valid=(id:number)=>Number.isSafeInteger(id)&&id>0&&id<=65535;
  for(const event of [...snapshot.publicHandEvents].sort((a,b)=>a.index-b.index)){
    if(seen.has(event.key))continue;seen.add(event.key);
    if(!Number.isInteger(event.index)||event.index<0||event.index>=Math.max(1,snapshot.logLength)){uncertain();continue;}
    switch(event.type){
      case 'reveal':{
        if(event.cards.some(id=>!valid(id))){uncertain();break;}
        if(event.full){known.clear();partial=false;}
        const batch=new Map<number,number>();
        for(const id of event.cards)batch.set(id,(batch.get(id)??0)+1);
        // Repeated disclosure is not evidence of another copy. A simultaneous
        // public batch can establish multiple copies of the same name.
        for(const [id,count] of batch){const old=known.get(id);known.set(id,{min:Math.max(old?.min??0,count),max:Math.max(old?.max??0,count)});}
        break;
      }
      case 'enter':
        if(event.cardId===null)break; // An anonymous draw adds no public identity.
        if(valid(event.cardId)){const old=known.get(event.cardId);known.set(event.cardId,{min:(old?.min??0)+1,max:(old?.max??0)+1});}
        else uncertain();
        break;
      case 'leave':
        if(event.cardId!==null&&valid(event.cardId)){const old=known.get(event.cardId);if(old){old.min=Math.max(0,old.min-1);old.max=Math.max(0,old.max-1);}}
        else{
          // An unidentified departure could be any known card. Keep only
          // copies which must remain regardless of which identity departed.
          for(const value of known.values())value.min=Math.max(0,value.min-1);
          partial=true;
        }
        break;
      case 'invalidate':uncertain();break;
      default:uncertain();
    }
  }
  const mismatch=!invalidCount&&[...known.values()].reduce((n,c)=>n+c.min,0)>hand!;
  const refreshing=stale||!!(snapshot.publicHandBusy??snapshot.busy);
  if((invalidCount||mismatch)&&!snapshot.publicHandBusy)uncertain();
  if(hand===0&&!refreshing)known.clear();
  const cards=[...known].filter(([,v])=>v.min>0).map(([id,v])=>({id,count:v.min})).sort((a,b)=>a.id-b.id);
  const uncertainCards=[...known].filter(([,v])=>v.max>v.min).map(([id,v])=>({id,count:v.max-v.min})).sort((a,b)=>a.id-b.id);
  return {cards,uncertainCards,status:partial?'partial':'ready',reason:refreshing?'读取更新中，保留上次手牌记录':mismatch||invalidCount?'手牌数量待核对，保留已公开记录':uncertainCards.length?'部分离手记录无法对应卡名，下列为剩余候选':partial?'仅显示已观察到的公开记录':cards.length?'仅记录已公开且仍可确认留在手中的卡片':'暂无已确认的公开手牌'};
}
