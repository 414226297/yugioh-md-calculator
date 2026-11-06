import {emptyCounts,type Card,type HandChange,type PublicHandEvent,type SetCard,type PublicDrawState} from './model.js';
import {publicHand} from './public-hand.js';

/** Owned by the store, so a disposable native reader cannot erase public memory. */
export class PublicHandTracker {
  private session='';
  private cursor=0;
  private count=0;
  get committedHandCount(){return this.count;}
  private prefix='';
  private serial=0;
  pending=false;
  private pendingAt:number|null=null;
  private events:PublicHandEvent[]=[];
  private lastVisible='';
  private deckTop:number|undefined;
  get knownDeckTop(){return this.deckTop??null;}
  private deckCount:number|undefined;
  private drawnTurn=-1;
  private naturalDraws=new Map<number,string>();
  private sets=new Map<number,SetCard>();
  private setCounts=new Map<string,number>();
  private setHistories=new Map<string,PublicHandEvent[]>();
  private handAt(events:PublicHandEvent[],count:number,logLength:number,catalog:Record<number,Card>){
    return publicHand({status:'duel',session:this.session,timestamp:0,counts:{...emptyCounts(),opponentHand:count},monsters:[],myTeam:0,extraCount:null,banishedCount:null,moves:[],logLength,completeLog:true,deck:null,publicHandEvents:events},false,catalog);
  }
  private candidates(events:PublicHandEvent[],count:number,logLength:number,catalog:Record<number,Card>,normalSet=false){
    const hand=this.handAt(events,count,logLength,catalog);
    const possible=[...hand.cards,...hand.uncertainCards].filter(c=>catalog[c.id]?.category!=='monster'&&!catalog[c.id]?.fieldSpell);
    const candidates=[...new Set(possible.map(c=>c.id))];
    // Special effects may place monsters as spells/traps, so those prevent
    // treating a spell/trap-only candidate list as exhaustive.
    // Anonymous sets obscure which copy remains, not whether all remaining
    // copies were publicly known. Keep that coverage separate from per-ID minima.
    let coverage=0;
    for(const event of events){
      if(event.type==='invalidate')coverage=0;
      else if(event.type==='reveal')coverage=event.full?event.cards.length:Math.max(coverage,event.cards.length);
      else if(event.type==='enter'&&event.cardId!==null)coverage++;
      else if(event.type==='leave')coverage=Math.max(0,coverage-1);
    }
    const unknownPossible=coverage!==count||!normalSet&&[...hand.cards,...hand.uncertainCards].some(c=>catalog[c.id]?.category==='monster')||possible.some(c=>!catalog[c.id]?.category);
    const searched=new Map<number,number>();
    for(const event of events){
      if(event.type==='invalidate'||event.type==='reveal'&&event.full)searched.clear();
      if(event.type==='enter'&&event.source==='search'&&event.cardId!==null)searched.set(event.cardId,(searched.get(event.cardId)??0)+1);
      if(event.type==='leave'&&event.cardId!==null)searched.set(event.cardId,Math.max(0,(searched.get(event.cardId)??0)-1));
    }
    return {candidates,unknownPossible,searchedCandidates:candidates.filter(id=>(searched.get(id)??0)>0)};
  }
  private refineSets(logLength:number,catalog:Record<number,Card>){
    // Keep original evidence for still-set cards even after hand redisclosure
    // supersedes live hand memory. Updating this archive must not deduct anew.
    for(const history of new Set([this.events,...this.setHistories.values()]))for(let i=0;i<history.length;i++){
      const event=history[i],set=[...this.sets.values()].find(s=>s.origin===event.key);
      const count=this.setCounts.get(event.key);
      if(!set||set.slot<7||count===undefined||event.type!=='leave')continue;
      if(set.publicId!==undefined||set.positionChanged)continue;
      const inference=this.candidates(history.slice(0,i),count,logLength,catalog,event.normalSet);
      Object.assign(set,inference);delete set.confirmedId;
      event.cardId=null;
      if(!inference.unknownPossible&&inference.candidates.length===1){set.confirmedId=inference.candidates[0];event.cardId=set.confirmedId;}
    }
  }
  setCards(){return structuredClone([...this.sets.values()].filter(s=>s.slot>=7).sort((a,b)=>a.slot-b.slot));}
  private recordField(change:HandChange){
    if(change.slot===undefined)return;
    const previous=change.type==='fieldConfirm'?this.sets.get(change.slot):undefined;
    const id=change.cardId;
    if(previous?.origin&&id!==undefined){
      const origin=this.events.find(e=>e.key===previous.origin)??this.setHistories.get(previous.origin)?.find(e=>e.key===previous.origin);
      if(origin?.type==='leave')origin.cardId=id;
    }
    this.sets.set(change.slot,{...previous,slot:change.slot,candidates:id===undefined?[]:[id],unknownPossible:id===undefined,...(id===undefined?{}:{confirmedId:id,publicId:id,positionChanged:undefined})});
  }
  private recordHandReveal(change:HandChange){
    if(change.cardId===undefined)return;
    const draw=change.drawKey?this.events.find(e=>e.type==='enter'&&e.origin===change.drawKey):undefined;
    // An actual public draw disclosure outranks a prior deck-order inference.
    if(draw?.type==='enter')draw.cardId=change.cardId;
    else if(!draw)this.events.push({key:`observed:${this.serial++}`,index:change.index,type:'reveal',cards:[change.cardId]});
  }
  private recordDeck(change:HandChange):boolean {
    if(change.type==='deckTop'){
      this.deckTop=Number.isInteger(change.cardId)&&change.cardId!>0&&change.cardId!<=65535?change.cardId:undefined;
      return true;
    }
    if(change.type==='deckReset'){this.deckTop=undefined;return true;}
    if(change.type==='invalidate')this.deckTop=undefined;
    return false;
  }
  private recordEnter(change:HandChange){
    const id=change.cardId??(change.source==='draw'?this.deckTop:undefined);
    // A known top is consumed once. Searching also destroys its ordering proof;
    // a later shuffle cannot undo identities already drawn into the hand.
    if(change.source==='draw'||change.source==='search')this.deckTop=undefined;
    this.events.push({key:`observed:${this.serial++}`,index:change.index,type:'enter',cardId:id??null,origin:change.key,...(change.source?{source:change.source}:{})});
  }
  reset(){this.session='';this.cursor=0;this.count=0;this.prefix='';this.events=[];this.lastVisible='';this.deckTop=undefined;this.deckCount=undefined;this.drawnTurn=-1;this.naturalDraws.clear();this.sets.clear();this.setCounts.clear();this.setHistories.clear();this.pending=false;this.pendingAt=null;}
  update(session:string,logLength:number,count:number,visible:number[],changes:HandChange[],_now:number,settled=true,slots?:number[],catalog:Record<number,Card>={},fieldSettled=settled,drawState?:PublicDrawState):PublicHandEvent[]{
    const fresh=session!==this.session;
    if(fresh){this.reset();this.session=session;}
    const index=Math.max(0,logLength-1);
    const append=(event:{type:'invalidate'}|{type:'reveal';cards:number[];full:boolean})=>this.events.push({...event,key:`observed:${this.serial++}`,index});
    const prior=changes.filter(c=>c.index<this.cursor);
    // Elapsed time alone does not invalidate a complete, unchanged log prefix.
    const broken=!fresh&&(logLength<this.cursor||JSON.stringify(prior)!==this.prefix);
    const addedChanges=changes.filter(c=>c.index>=this.cursor);
    const acknowledged=new Set<string>(),ackTurns=new Set<number>();
    if(!broken)for(const change of addedChanges){
      const turn=change.normalDrawTurn;
      if(change.type==='enter'&&change.source==='draw'&&turn!==undefined&&this.naturalDraws.has(turn)&&!ackTurns.has(turn)){
        acknowledged.add(change.key);ackTurns.add(turn);
      }
    }
    const additions=addedChanges.filter(c=>!acknowledged.has(c.key));
    const deckCount=drawState&&Number.isInteger(drawState.deckCount)&&drawState.deckCount>=0&&drawState.deckCount<=200?drawState.deckCount:undefined;
    const window=drawState?.window;
    const eligible=!fresh&&!broken&&deckCount!==undefined&&this.deckCount!==undefined&&!!window&&Number.isInteger(window.turnIndex)&&Number.isInteger(window.index)&&window.turnIndex>=0&&window.turnIndex>this.drawnTurn&&window.index>=window.turnIndex&&window.index<logLength&&!addedChanges.some(c=>['enter','leave','invalidate','deckReset'].includes(c.type));
    // Normal phase draws can precede their ShowAction row. Require paired public
    // count changes, an otherwise empty draw-phase window, and a prior sample.
    // Keep this synthetic event OUT of the immutable log-prefix comparison.
    const naturalDraw=eligible&&count===this.count+1&&deckCount===this.deckCount!-1;
    const drawRace=eligible&&(count===this.count+1&&deckCount===this.deckCount||count===this.count&&deckCount===this.deckCount!-1);
    if(drawRace){
      this.pendingAt??=_now;
      if(_now-this.pendingAt<1500){this.pending=true;return structuredClone(this.events);}
      this.deckTop=undefined;
    }
    const expectedCount=this.count+additions.filter(c=>c.type==='enter').length-additions.filter(c=>c.type==='leave').length+(naturalDraw?1:0);
    // During a summon the count and public movement log can arrive on separate
    // frames. Do not commit the cursor or an irreversible invalidation mid-race.
    if(!fresh&&!broken&&expectedCount!==count&&(visible.length!==count||count===0&&!settled)&&!addedChanges.some(c=>c.type==='invalidate')&&(!settled||this.pending)){
      this.pendingAt??=_now;
      if(_now-this.pendingAt<1500){this.pending=true;return this.events.map(e=>({...e}));}
    }
    this.pending=false;this.pendingAt=null;
    if(broken){
      this.deckTop=undefined;
      this.drawnTurn=-1;
      this.naturalDraws.clear();
      // Keep prior disclosures as uncertain history after a log discontinuity.
      this.events=this.events.map(e=>({...e,index:0}));
      append({type:'invalidate'});this.lastVisible='';
      this.sets.clear();
      this.setHistories.clear();this.setCounts.clear();
    }
    if(fresh||broken){
      // Reconstruct only explicit public field evidence, never past hand guesses.
      for(const change of changes){
        if(change.type==='invalidate'){if(change.scope!=='hand')this.sets.clear();}
        else if(change.type==='fieldSet'||change.type==='fieldConfirm'||change.type==='leave'&&change.slot!==undefined)this.recordField(change);
        else if((change.type==='fieldReveal'||change.type==='fieldLeave')&&change.slot!==undefined)this.sets.delete(change.slot);
      }
    }
    if(fresh){
      // Replay identities explicitly disclosed in the public log. Unknown
      // draws stay anonymous, and subsequent departures still consume them.
      for(const change of changes){
        if(this.recordDeck(change))continue;
        if(change.type==='enter')this.recordEnter(change);
        else if(change.type==='handReveal')this.recordHandReveal(change);
        else if(change.type==='leave'){
          const key=`observed:${this.serial++}`;
          this.events.push({key,index:change.index,type:'leave',cardId:change.cardId??null,...(change.normalSet?{normalSet:true}:{})});
          if(change.slot!==undefined&&change.slot<7)this.sets.set(change.slot,{slot:change.slot,candidates:[],unknownPossible:true,origin:key});
        }
        else if(change.slot!==undefined&&change.slot<7){
          if(change.type==='fieldReveal')this.recordField({...change,type:'fieldConfirm'});
          if(change.type==='fieldReveal'||change.type==='fieldLeave')this.sets.delete(change.slot);
          else if(change.type==='fieldSet')this.recordField(change);
        }
        else if(change.type==='invalidate')this.events.push({key:`observed:${this.serial++}`,index:change.index,type:'invalidate'});
      }
    }
    if(!fresh&&!broken){
      const added=changes.filter(c=>c.index>=this.cursor);
      const coherent=expectedCount===count&&!added.some(c=>c.type==='invalidate');
      let expected=this.count;
      for(const change of added){
        if(acknowledged.has(change.key)){
          const origin=this.naturalDraws.get(change.normalDrawTurn!);
          const event=this.events.find(e=>e.type==='enter'&&e.origin===origin);
          if(event?.type==='enter'){event.origin=change.key;if(change.cardId!==undefined)event.cardId=change.cardId;}
          this.naturalDraws.delete(change.normalDrawTurn!);
          continue;
        }
        if(this.recordDeck(change))continue;
        if(change.type==='handReveal'){this.recordHandReveal(change);continue;}
        if(change.type==='fieldSet'||change.type==='fieldConfirm'){
          this.recordField(change);
          if(change.type==='fieldConfirm')this.refineSets(logLength,catalog);
          continue;
        }
        if(change.type==='fieldReveal'||change.type==='fieldLeave'){
          const set=change.slot===undefined?undefined:this.sets.get(change.slot);
          if(set&&change.type==='fieldReveal'&&change.cardId){
            // Resolve the ORIGINAL anonymous departure; a field activation is
            // not a second departure from hand. Full redisclosure may have
            // already superseded this event, in which case do not touch hand.
            const origin=this.events.find(e=>e.key===set.origin)??this.setHistories.get(set.origin??'')?.find(e=>e.key===set.origin);
            if(origin?.type==='leave')origin.cardId=change.cardId;
          }
          if(change.slot!==undefined)this.sets.delete(change.slot);
          if(set?.origin){this.setHistories.delete(set.origin);this.setCounts.delete(set.origin);}
          if(change.type==='fieldReveal')this.refineSets(logLength,catalog);
          continue;
        }
        if(change.type==='enter'){
          expected++;
          this.recordEnter(change);
          continue;
        }
        if(change.type==='leave'){
          const eventKey=`observed:${this.serial++}`;
          let identity=change.cardId;
          if(change.slot!==undefined){
            const inference=change.slot<7?{candidates:[],unknownPossible:true,searchedCandidates:[]}:this.candidates(this.events,expected,logLength,catalog,change.normalSet);
            const {candidates}=inference,unknownPossible=!coherent||inference.unknownPossible;
            if(!unknownPossible&&candidates.length===1)identity=candidates[0];
            this.sets.set(change.slot,{slot:change.slot,candidates:change.cardId!==undefined?[change.cardId]:candidates,unknownPossible:change.cardId!==undefined?false:unknownPossible,searchedCandidates:inference.searchedCandidates,...(identity?{confirmedId:identity}:{}),...(change.cardId!==undefined?{publicId:change.cardId}:{}),origin:eventKey});
            this.setCounts.set(eventKey,expected);
            this.setHistories.set(eventKey,this.events);
          }
          expected--;
          this.events.push({key:eventKey,index:change.index,type:'leave',cardId:identity??null,...(change.normalSet?{normalSet:true}:{})});
        }else{this.events.push({key:`observed:${this.serial++}`,index:change.index,type:'invalidate'});if(change.scope!=='hand')this.sets.clear();}
      }
      if(added.length)this.lastVisible='';
      if(naturalDraw){
        const key=`normal-draw:${window!.turnIndex}`;
        this.recordEnter({key,index:window!.index,type:'enter',source:'draw'});
        this.naturalDraws.set(window!.turnIndex,key);
        this.drawnTurn=window!.turnIndex;expected++;this.lastVisible='';
      }
      if(expected!==count){append({type:'invalidate'});this.lastVisible='';this.deckTop=undefined;}
    }
    if(!fresh&&deckCount!==this.deckCount&&!naturalDraw&&!addedChanges.some(c=>c.type==='deckTop'))this.deckTop=undefined;
    this.deckCount=deckCount;
    const full=visible.length===count&&(count>0||settled);
    const current=JSON.stringify([full,[...visible].sort((a,b)=>a-b)]);
    if((visible.length||full)&&current!==this.lastVisible){
      if(full)this.events=[]; // A fresh complete disclosure supersedes older evidence.
      append({type:'reveal',cards:[...visible],full});
    }
    this.lastVisible=current;this.cursor=logLength;this.count=count;
    this.prefix=JSON.stringify(changes);
    if(slots){
      if(fieldSettled){
        const displaced=[...this.sets.values()].filter(s=>s.slot>=7&&!slots.includes(s.slot));
        const appeared=slots.filter(slot=>!this.sets.has(slot));
        // A location-only rearrangement has no known identity mapping. Keep
        // public candidates as a pool, never transfer a definite identity.
        if(displaced.length&&appeared.length){
          const candidates=[...new Set(displaced.flatMap(s=>s.candidates))];
          for(const slot of appeared)this.sets.set(slot,{slot,candidates,unknownPossible:true,positionChanged:true});
        }
      }
      if(fieldSettled)for(const slot of this.sets.keys())if(slot>=7&&!slots.includes(slot))this.sets.delete(slot);
      for(const slot of slots)if(!this.sets.has(slot))this.sets.set(slot,{slot,candidates:[],unknownPossible:true});
      // Hand-count races can discard inferred history, but cannot erase a name
      // explicitly confirmed in the public field log. Replay zone lifetimes so
      // a previous occupant's identity never leaks into a reused slot.
      if(fieldSettled){
        const explicit=new Map<number,number>();
        for(const change of changes){
          if(change.type==='invalidate'){if(change.scope!=='hand')explicit.clear();continue;}
          if(change.slot===undefined)continue;
          if(change.type==='fieldLeave'||change.type==='fieldReveal')explicit.delete(change.slot);
          else if(change.type==='fieldSet'||change.type==='leave'){
            explicit.delete(change.slot);
            if(change.cardId!==undefined)explicit.set(change.slot,change.cardId);
          }else if(change.type==='fieldConfirm'&&change.cardId!==undefined)explicit.set(change.slot,change.cardId);
        }
        for(const [slot,cardId] of explicit)if(slots.includes(slot)&&!this.sets.get(slot)?.positionChanged)this.recordField({key:'restore',index,type:'fieldConfirm',slot,cardId});
      }
    }
    const origins=new Set([...this.sets.values()].map(s=>s.origin));
    for(const key of this.setHistories.keys())if(!origins.has(key)){this.setHistories.delete(key);this.setCounts.delete(key);}
    return structuredClone(this.events);
  }
}
