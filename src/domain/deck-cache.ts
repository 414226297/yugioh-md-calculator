import {validateDeck,type Deck,type DeckSelection} from './model.js';
/** A selection proves identity, not contents: cached contents require the exact live revision. */
export function resolveSelectedDeck(selection:DeckSelection,own:unknown,companion:unknown):Deck|null{
 if(!Number.isSafeInteger(selection.revision)||selection.revision<=0)return null;
 const known=own&&typeof own==='object'?(own as Record<string,unknown>)[selection.id]:null;
 if(validateDeck(known)&&known.id===selection.id&&known.revision===selection.revision&&(known.name===selection.name||selection.localizedName))return {...known,name:selection.name,readAt:Date.now()};
 const external=selection.cacheId&&companion&&typeof companion==='object'?(companion as Record<string,any>)[selection.cacheId]:null;
 if(!external||String(external.id)!==selection.cacheId||external.edited!==selection.revision||external.name!==selection.name&&!selection.localizedName)return null;
 const deck:Deck={id:selection.id,name:selection.name,revision:selection.revision,readAt:Date.now(),main:external.main,extra:external.extra};
 return validateDeck(deck)?deck:null;
}
