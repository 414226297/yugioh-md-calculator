import type {HandChange} from '../domain/model.js';
import type {Ref} from './collections.js';
export type {HandChange} from '../domain/model.js';
export {PublicHandTracker} from '../domain/public-hand-tracker.js';
const movement=new Set([2,3,4,5,6,7,8,9,13,14,15,18,20,21,22,24,25,26,27,28,29,33,34,35,36,39,49,50,51]);
const stationary=new Set([0,10,11,12,16,17,19,23,30,31,32,37,38,40]);

/** Read no identity at all unless the game's hand-display flag is explicitly open. */
export function visibleHand(hand:Ref[]):number[]{
  const cards:number[]=[];
  for(const entry of hand){
    const hidden=entry.get('m_IsHide');
    if(hidden===true)continue;
    if(hidden!==false)throw Error('公开手牌显示状态无法确认');
    const id=entry.get('m_Mrk');
    if(!Number.isInteger(id)||id<=0||id>65535)throw Error('公开手牌编号无法确认');
    cards.push(id);
  }
  return cards;
}

/** Identity comes from the game's adjacent public name row, never a hidden
 * operand. A hidden destination does not undo a name already shown in the log. */
function publicCardName(name?:Ref):number|undefined {
  const id=name?.get('cardid');
  return Number.isInteger(id)&&id>0&&id<=65535?id:undefined;
}

/** Decode zone transitions once for all movement actions, independent of effects. */
export function handChange(a:Ref,index:number,sub:number,myTeam:number,publicName?:Ref):HandChange[]{
  const l=a.get('datal'),m=a.get('datac'),r=a.get('datar'),key=`${index}:${sub}`;
  const action=m.get('databyte1'),from=l.get('databyte0'),player=l.get('databyte1');
  const rightType=r.get('datatype'),to=rightType===1?r.get('databyte0'):null;
  const target=to===null?null:r.get('databyte1'),opponent=1-myTeam;
  const leaves=from===13&&player===opponent,enters=to===13&&target===opponent;
  const scope=from>=13&&(to===null||to>=13)?{scope:'hand' as const}:{};
  if(m.get('datatype')!==3||l.get('datatype')!==1)return leaves||enters?[{key,index,type:'invalidate',...scope}]:[];
  // Draw encodes destination on the left; no hidden draw identity is read.
  if(action===1)return player===opponent?[{key,index,type:'enter'}]:[];
  const destination=to!==null&&Number.isInteger(to)&&to>=0&&to<=18&&(target===0||target===1);
  const activationLeaves=action===11&&leaves&&destination&&to!<=12;
  const moved=destination&&(movement.has(action)||activationLeaves);
  const field:HandChange[]=[];
  // Confirmation discloses a card at its existing location; it does not leave.
  if(action===17&&player===opponent&&from>=7&&from<=11){
    const id=publicCardName(publicName);
    if(id!==undefined)field.push({key:`${key}:field`,index,type:'fieldConfirm',slot:from,cardId:id});
  }
  if(moved&&(action===13||action===14)&&!leaves&&target===opponent&&to!>=7&&to!<=11){
    const id=publicCardName(publicName);
    field.push({key:`${key}:set`,index,type:'fieldSet',slot:to!,...(id===undefined?{}:{cardId:id})});
  }
  if(player===opponent&&from>=7&&from<=11&&(action===11||moved&&(to!==from||target!==player))){
    const id=publicCardName(publicName);
    field.push({key:`${key}:field`,index,type:id===undefined?'fieldLeave':'fieldReveal',slot:from,...(id===undefined?{}:{cardId:id})});
  }
  if(!leaves&&!enters)return field;
  if(stationary.has(action)&&!activationLeaves)return field;
  if(!moved)return [...field,{key,index,type:'invalidate',...scope}];
  if(leaves&&enters)return [...field,{key,index,type:'invalidate',...scope}];
  const id=publicCardName(publicName);
  return [...field,{key,index,type:leaves?'leave':'enter',...(id===undefined?{}:{cardId:id}),...(enters&&from===15&&action===26&&id!==undefined?{source:'search' as const}:{}),...(leaves&&(action===13||action===14)&&target===opponent&&to!>=7&&to!<=11?{slot:to!}:{})}];
}
/** Read only location/team/face flags, never the identity of a set card. */
function backrowSlots(cards:Ref[],myTeam:number,faceUp:boolean):number[]{
 const slots=new Set<number>();
 for(const card of cards){
  const team=card.get('team'),slot=card.get('cardLocator')?.get('cardPlace')?.get('position');
  if(team!==1-myTeam||!Number.isInteger(slot)||slot<7||slot>11)continue;
  const face=card.get('isFace');if(typeof face!=='boolean')throw Error('盖放状态待确认');
  if(face===faceUp)slots.add(slot);
 }
 return [...slots].sort((a,b)=>a-b);
}


export const facedownBackrow=(cards:Ref[],myTeam:number)=>backrowSlots(cards,myTeam,false);
export const faceupBackrow=(cards:Ref[],myTeam:number)=>backrowSlots(cards,myTeam,true);
