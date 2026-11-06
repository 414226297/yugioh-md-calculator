import type {HandChange} from '../domain/model.js';
import type {Ref} from './collections.js';

// Verified OCG texts (db.yugioh-card.com, cid = ID): Mix, Reco, Trackmaker,
// Kewl Tune Synchro and JJ only search their controller's deck / affect field
// cards. They cannot reorder the OTHER main deck. Any actual deck movement
// below still overrides this narrow whitelist; copy/apply effects are excluded.
const ownDeckOnlyEffects=new Set([21953,21955,21957,21961,21962]);

/** Public-log proof for Cue only. Excavation alone proves neither the final top
 * nor a hand identity. The two disclosed cards, exact banish and TOP selection
 * must all occur in the same resolving effect. */
export interface DeckProof {cue:boolean;revealed:number[];banished?:number;invalid:boolean;knownTop:boolean}
export const emptyDeckProof=():DeckProof=>({cue:false,revealed:[],invalid:false,knownTop:false});
export class PublicDeckLog {
  state:DeckProof;
  constructor(private myTeam:number,previous?:DeckProof){this.state=previous?structuredClone(previous):emptyDeckProof();}
  chain(chain:Ref|undefined,index:number):HandChange[]{
    if(chain?.get('type')===3){this.boundary();return [];}
    // LogShowChain.team is a near-side flag, unlike absolute player IDs in
    // ShowAction. Numeric team values remain absolute for normalized inputs.
    const team=chain?.get('team');
    const player=typeof team==='boolean'?(team?this.myTeam:1-this.myTeam):team;
    if(chain&&[0,1].includes(chain.get('type'))&&player===this.myTeam&&ownDeckOnlyEffects.has(chain.get('cardid'))){
      this.boundary();return [];
    }
    const reset=this.invalidate(index);
    this.state=emptyDeckProof();
    if(chain?.get('type')===1&&chain.get('cardid')===21956&&player===this.myTeam)this.state.cue=true;
    // Other effect resolutions can shuffle without a card-movement row. Until
    // that effect is modeled, discard top ordering rather than guess a draw.
    return reset;
  }
  action(action:Ref,index:number,sub:number,name?:Ref):HandChange[]{
    const l=action.get('datal'),m=action.get('datac'),r=action.get('datar');
    if(l.get('datatype')!==1||m.get('datatype')!==3){this.state.invalid=true;return this.invalidate(index,sub);}
    const from=l.get('databyte0'),player=l.get('databyte1'),code=m.get('databyte1');
    const to=r.get('datatype')===1?r.get('databyte0'):null,target=to===null?null:r.get('databyte1');
    if(code===1){if(player===1-this.myTeam)this.state=emptyDeckProof();return [];}
    const touches=from===15&&player===1-this.myTeam||to===15&&target===1-this.myTeam;
    if(!touches)return [];
    const id=name?.get('cardid'),valid=Number.isInteger(id)&&id>0&&id<=65535;
    if(this.state.cue&&from===15&&player===1-this.myTeam){
      if(code===19&&to===null&&valid&&this.state.banished===undefined&&this.state.revealed.length<2)this.state.revealed.push(id);
      else if(code===18&&to===17&&target===player&&valid&&this.state.banished===undefined&&this.state.revealed.includes(id))this.state.banished=id;
      else this.state.invalid=true;
    }else this.state.invalid=true;
    const reset=this.state.knownTop?[{key:`${index}:${sub}:deck`,index,type:'deckReset' as const}]:[];
    this.state.knownTop=false;
    return reset;
  }
  text(text:unknown,index:number):HandChange[]{
    if(!this.state.cue)return this.invalidate(index);
    const proof=this.state;this.state=emptyDeckProof();
    // Exact observed public Chinese UI selection; never search arbitrary effect
    // descriptions for the word "top". Other locales safely remain unknown.
    const top=typeof text==='string'&&text.replace(/<[^>]*>/g,'').trim()==='选择了"卡组顶端"。';
    const remaining=proof.revealed.slice(),at=remaining.indexOf(proof.banished!);
    if(at>=0)remaining.splice(at,1);
    if(top&&!proof.invalid&&proof.revealed.length===2&&at>=0&&remaining.length===1){
      this.state.knownTop=true;
      return [{key:`${index}:deck`,index,type:'deckTop',cardId:remaining[0]}];
    }
    return [];
  }
  invalidate(index:number,sub=0):HandChange[]{
    const known=this.state.knownTop;this.state=emptyDeckProof();
    return known?[{key:`${index}:${sub}:deck`,index,type:'deckReset'}]:[];
  }
  boundary(){const knownTop=this.state.knownTop;this.state={...emptyDeckProof(),knownTop};}
}
