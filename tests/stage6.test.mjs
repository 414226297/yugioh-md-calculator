import test from 'node:test';import assert from 'node:assert/strict';
import {DuelStore} from '../dist/domain/store.js';import {scene,deck,catalog,move} from './fixtures/scenes.mjs';
test('session reset clears cursor and overrides; stale connection cannot show old ready plan',()=>{
 const store=new DuelStore();store.deck=deck;store.catalog=catalog;const s=scene();store.accept(s);store.confirmDeck();assert.equal(store.view().result.status,'ready');
 store.accept({...s,status:'error',reason:'native disconnected'});assert.equal(store.view().result.plans.length,0);
 store.accept({...s,status:'menu',session:null});store.accept({...s,session:'new'});assert.equal(store.view().deckReady,false);assert.equal(store.boundSession,null);
 store.confirmDeck();assert.equal(store.view().inventory.extra.reduce((a,s)=>a+s.count,0),15);
});
test('material move does not reduce inventory or independently derive field counts',()=>{
 const store=new DuelStore();store.deck=deck;store.catalog=catalog;const s=scene();s.moves=[move(30,12326,5,16,{action:24,affectsInventory:false})];store.accept(s);store.confirmDeck();
 assert.equal(store.view().inventory.extra.reduce((a,s)=>a+s.count,0),15);assert.equal(store.view().counts.opponentField,2);
});
test('manual deck edits are not overwritten by polling same editor',()=>{
 const store=new DuelStore();store.catalog=catalog;store.accept({...scene(),status:'menu',session:null,deck});
 const revised=structuredClone(deck);delete revised.extra[9612];store.setDeck(revised);
 store.accept({...scene(),status:'menu',session:null,deck});assert.equal(store.deck.extra[9612],undefined);
 store.restore();store.accept({...scene(),status:'menu',session:null,deck});assert.equal(store.deck.extra[9612],1);
});
test('changed level uses current value; missing current value remains uncertain',()=>{
 const store=new DuelStore();store.catalog=catalog;store.deck=deck;const s=scene();store.accept(s);store.confirmDeck();
 const changed=structuredClone(s);changed.monsters=[{uid:87,kind:'level',value:6,faceUp:true}];store.accept(changed);assert.ok(store.view().result.plans.every(p=>p.target===6));
 changed.monsters[0].value=null;store.accept(changed);assert.equal(store.view().result.status,'uncertain');
});
test('manual inventory checkpoint applies later return only once',()=>{
 const store=new DuelStore();store.deck=deck;store.catalog=catalog;const s=scene();s.moves=[move(10,9612,14,17)];s.extraCount=14;s.banishedCount=1;s.logLength=11;store.accept(s);store.confirmDeck();
 const i=store.view().inventory;store.setInventory(i.extra,i.banished);
 const after={...s,moves:[...s.moves,move(12,9612,17,14)],extraCount:15,banishedCount:0,logLength:13};store.accept(after);
 assert.equal(store.view().inventory.extra.find(s=>s.id===9612).count,1);store.accept(after);assert.equal(store.view().inventory.extra.find(s=>s.id===9612).count,1);
});
