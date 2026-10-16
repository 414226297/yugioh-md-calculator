import test from 'node:test';
import assert from 'node:assert/strict';
import {DuelStore} from '../dist/domain/store.js';
import {scene,deck,catalog} from './fixtures/scenes.mjs';
const menu=(d=null)=>({...scene(),status:'menu',session:null,deck:d});
test('fresh editor acquisition survives menu/loading and automatically initializes next duel',()=>{
 const store=new DuelStore();store.catalog=catalog;
 store.accept(menu(deck));assert.equal(store.view().deckReady,true);
 store.accept(menu());store.accept({...menu(),status:'error',reason:'loading'});
 store.accept(scene());
 assert.equal(store.view().deckReady,true);assert.equal(store.boundSession,scene().session);
 assert.equal(store.view().inventory.extra.reduce((n,c)=>n+c.count,0),15);
 assert.equal(store.view().result.status,'ready');
});
test('prepared deck is consumed once and never carries manual inventory to another duel',()=>{
 const store=new DuelStore();store.catalog=catalog;store.accept(menu(deck));store.accept(scene());
 store.setCounts({myHand:9});const i=store.view().inventory;store.setInventory(i.extra,i.banished);
 store.accept(menu());store.accept({...scene(),session:'next'});
 assert.equal(store.boundSession,null);assert.equal(store.view().manual,false);
 assert.equal(store.view().result.plans.length,0);assert.deepEqual(store.deck,deck);
});
test('cached or pre-restart deck requires confirmation rather than automatic binding',()=>{
 const store=new DuelStore();store.catalog=catalog;store.deck=deck;store.accept(scene());
 assert.equal(store.view().deckReady,false);
 store.accept(menu(deck));store.accept({...menu(),status:'waiting'});store.accept(menu());store.accept({...scene(),session:'restarted'});
 assert.equal(store.boundSession,null);assert.equal(store.view().deckReady,false);
});
test('latest acquired deck and explicit pre-duel confirmation prepare next duel',()=>{
 const store=new DuelStore();store.catalog=catalog;store.accept(menu(deck));
 const next={...deck,id:'another',name:'another'};store.accept(menu(next));store.accept(scene());
 assert.equal(store.deck.id,'another');assert.equal(store.view().deckReady,true);
 store.accept(menu());store.confirmDeck();store.accept({...scene(),session:'confirmed-next'});
 assert.equal(store.view().deckReady,true);
});
