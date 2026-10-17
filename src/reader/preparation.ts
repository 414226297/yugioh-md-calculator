import {validateDeck,type Deck,type DeckSelection} from '../domain/model.js';
import {dictionary,list,type Ref} from './collections.js';

function at(root:Ref,parts:string[]):any{
 let value:any=root;for(const key of parts){if(!value)return null;value=dictionary(value).get(key);}return value;
}
/** Resolve the active UI widget's own-deck path; never infer selection from deck name. */
export function readPreparation(view:Ref,root:Ref):{deck:Deck|null;deckSelection:DeckSelection|null;reason?:string}{
 const widget=view.get('modeBehaviour')?.get('colosseumDeckWidget');
 if(!widget)return {deck:null,deckSelection:null,reason:'当前准备模式尚未识别牌组'};
 const group=widget.get('toggleGroup');
 const index=group?group.get('m_ToggleGroupWidget').get('m_CurrentIdx'):0;
 const items=list(widget.get('colosseumDecks'),10);
 if(!Number.isInteger(index)||index<0||index>=items.length)throw Error('牌组选项无效');
 const info=items[index].get('buttonInfo');
 if(!info.get('isSetDeck'))return {deck:null,deckSelection:null,reason:'请在游戏准备页面选择牌组'};
 if(info.get('rentalState')>0)return {deck:null,deckSelection:null,reason:'租借牌组暂需核对完整卡表'};
 const path=info.get('deckManager').get('pm').get('path').get('deck_list');
 if(typeof path!=='string'||!/^\$\.(?:(Deck|EXHDeck|CUPDeck|WCSDeck|RDCDeck|REDeck|DTDeck|VDeck|DRDeck)\.(?:list\.)?\d+(?:\.\d+)*|CUPDeck|WCSDeck|RDCDeck)$/.test(path))throw Error('未识别的牌组路径');
 const parts=path.slice(2).split('.'),family=parts[0],suffix=parts.filter((p,i)=>i>0&&p!=='list');
 const meta=dictionary(at(root,parts));
 const revision=meta.get('et'),name=meta.get('name');
 if(!Number.isSafeInteger(revision)||revision<0||typeof name!=='string')throw Error('牌组版本信息缺失');
 const id=family==='Deck'?suffix.join(':'):suffix.length?`${family}:${suffix.join(':')}`:family;
 const cacheId=family==='Deck'?id:family==='EXHDeck'?`EXH_${suffix[0]}_Deck`:['CUPDeck','WCSDeck','RDCDeck'].includes(family)?family.replace('Deck','_Deck'):undefined;
 const localizedName=family!=='Deck'&&name.startsWith('IDS_');
 const displayName=localizedName&&typeof info.get('deckLabel')==='string'?info.get('deckLabel'):name;
 const deckSelection:DeckSelection={id,name:displayName,revision,cacheId,...(localizedName?{localizedName:true}:{})};
 const contents=at(root,[family.replace(/Deck$/,'DeckList'),...suffix]);
 if(!contents)return {deck:null,deckSelection,reason:'当前牌组卡表未加载，正在核对本地记录'};
 const counts=(zone:string)=>{const cards=at(contents,[zone,'ids']);if(!cards)throw Error('牌组区域卡表缺失');const ids=list(cards,100);const values:Record<string,number>={};for(const id of ids){if(!Number.isSafeInteger(id)||id<=0)throw Error('卡片编号异常');values[id]=(values[id]??0)+1;}return values;};
 const deck={id,name:displayName,revision,readAt:Date.now(),main:counts('m'),extra:counts('e')};
 if(!validateDeck(deck))throw Error('牌组卡表不完整');
 return {deck,deckSelection};
}
