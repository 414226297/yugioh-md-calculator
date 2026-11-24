import type {Card,Deck,Snapshot} from '../domain/model.js';

const hour=60*60*1000;
/** Automatic requests are throttled even when the upstream has not added a card yet. */
export class CatalogRefresh {
  private lastAttempt:number|null=null;
  private failed=false;
  constructor(private fetchedAt=0,private invalid=false){}
  due(now:number,missing:boolean|(()=>boolean)){
    if(this.lastAttempt!==null&&now>=this.lastAttempt&&now-this.lastAttempt<hour)return false;
    if(this.failed||this.invalid||!Number.isFinite(this.fetchedAt)||this.fetchedAt<=0||now<this.fetchedAt||now-this.fetchedAt>=24*hour)return true;
    return typeof missing==='function'?missing():missing;
  }
  start(now:number){this.lastAttempt=now;}
  finish(now:number,success:boolean){this.failed=!success;if(success){this.fetchedAt=now;this.invalid=false;}}
}

/** Only inspect identities already supplied to the assistant, never hidden game data. */
export function missingCatalogCards(cards:Record<number,Card>,deck:Deck|null,snapshot:Snapshot|null):boolean {
  const ids:number[]=[];
  for(const d of [deck,snapshot?.deck,snapshot?.cachedPreparationDeck])if(d)ids.push(...Object.keys(d.main).map(Number),...Object.keys(d.extra).map(Number));
  ids.push(...(snapshot?.moves??[]).map(m=>m.cardId),...(snapshot?.publicHandObservation?.cards??[]));
  for(const change of snapshot?.publicHandObservation?.changes??[])if(change.cardId)ids.push(change.cardId);
  for(const event of snapshot?.publicHandEvents??[]){
    if(event.type==='reveal')ids.push(...event.cards);
    else if((event.type==='enter'||event.type==='leave')&&event.cardId)ids.push(event.cardId);
  }
  return ids.some(id=>id>0&&(!cards[id]?.name||!cards[id]?.category||!cards[id]?.password));
}
