import test from 'node:test';
import assert from 'node:assert/strict';
import {DuelStore} from '../dist/domain/store.js';
import {scene,deck,catalog} from './fixtures/scenes.mjs';
const live=(session='first',d=deck)=>({...scene(),session,deck:d,deckSource:'duel'});
const store=()=>{const s=new DuelStore();s.catalog=catalog;return s;};

test('fresh startup in a duel binds its actual deck without editor or confirmation',()=>{
 const s=store();s.accept(live());assert.equal(s.view().deckReady,true);
 assert.equal(s.view().inventory.quality,'confirmed');assert.equal(s.view().result.status,'ready');
});
test('consecutive duels reacquire the actual deck and discard old manual inventory',()=>{
 const s=store();s.accept(live());s.setCounts({myHand:20});
 const inv=s.view().inventory;s.setInventory(inv.extra,inv.banished);
 s.accept({...scene(),status:'menu',session:null});s.accept(live('second'));
 assert.equal(s.view().deckReady,true);assert.equal(s.view().manual,false);
 assert.equal(s.boundSession,'second');assert.equal(s.view().inventory.quality,'confirmed');
});
test('switching decks replaces cached or manually edited deck even without a menu sample',()=>{
 const s=store();s.accept(live());s.setDeck({...deck,name:'manual'});s.confirmDeck();
 const other={...deck,id:'changed',name:'new deck',extra:{}};
 s.accept({...live('second',other),extraCount:0});
 assert.equal(s.deck.id,'changed');assert.equal(s.deckManual,false);
 assert.equal(s.view().deckReady,true);assert.equal(s.view().inventory.extra.length,0);
 assert.equal(s.view().result.plans.length,0);
});
test('late duel deck arrival binds once available and never trusts cached deck before then',()=>{
 const s=store();s.deck=deck;s.accept(scene());assert.equal(s.view().deckReady,false);
 s.accept(live(scene().session));assert.equal(s.view().deckReady,true);
});
test('manual corrections survive same-session samples, next session resets them',()=>{
 const s=store();s.accept(live());s.setDeck({...deck,name:'manual'});s.confirmDeck();
 s.accept(live());assert.equal(s.deck.name,'manual');
 s.accept(live('second'));assert.equal(s.deck.name,deck.name);assert.equal(s.view().deckReady,true);
});
test('invalid authoritative deck cannot reuse an old confirmed deck',()=>{
 const s=store();s.accept(live());s.accept(live('second',{...deck,main:{}}));
 assert.equal(s.view().deckReady,false);assert.equal(s.boundSession,null);
 assert.equal(s.view().result.plans.length,0);
});
test('initial deck auto acquisition still requires complete history and card attributes',()=>{
 const s=store();s.accept({...live(),completeLog:false});assert.equal(s.view().result.plans.length,0);
 s.catalog={};s.accept(live());assert.equal(s.view().deckReady,false);
 assert.equal(s.view().result.plans.length,0);
});
