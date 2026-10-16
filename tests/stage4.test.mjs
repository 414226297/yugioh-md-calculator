import test from 'node:test';import assert from 'node:assert/strict';
import {rebuildInventory} from '../dist/domain/inventory.js';import {DuelStore} from '../dist/domain/store.js';
import {deck,scene,move,catalog} from './fixtures/scenes.mjs';
test('MOVE-01/02: 15→12→14 and 1→4→2, exact cards tracked',()=>{
 const s=scene();s.moves=[move(41,19921,15,17),move(117,9612,14,17),move(118,10942,14,17),move(119,4740,14,17)];s.extraCount=12;s.banishedCount=4;
 let i=rebuildInventory(deck,s);assert.equal(i.quality,'confirmed');assert.equal(i.extra.reduce((a,s)=>a+s.count,0),12);
 s.moves.push(move(123,9612,17,14),move(127,4740,17,14));s.extraCount=14;s.banishedCount=2;
 i=rebuildInventory(deck,s);assert.equal(i.quality,'confirmed');assert.deepEqual(i.banished.map(s=>s.id).sort((a,b)=>a-b),[10942,19921]);assert.equal(i.extra.find(s=>s.id===9612).count,1);
});
test('duplicate events and selections never double count',()=>{
 const s=scene(),m=move(10,9612,14,17);s.moves=[m,m,move(11,9612,17,null,{action:23})];s.extraCount=14;s.banishedCount=1;
 const i=rebuildInventory(deck,s);assert.equal(i.quality,'confirmed');assert.equal(i.banished[0].count,1);
});
test('unknown action, missing history and discrepancies remain uncertain',()=>{
 const s=scene();s.moves=[move(12,9612,14,17,{action:999})];assert.equal(rebuildInventory(deck,s).quality,'unknown');
 s.moves=[];s.completeLog=false;assert.equal(rebuildInventory(deck,s).quality,'unknown');
 s.completeLog=true;s.extraCount=14;assert.equal(rebuildInventory(deck,s).quality,'unknown');
});
test('MANUAL-01: manual override persists across automatic ticks, restores, resets next game',()=>{
 const store=new DuelStore();store.deck=deck;store.catalog=catalog;const s=scene();store.accept(s);store.confirmDeck();store.setCounts({myHand:4});
 store.accept({...s,counts:{...s.counts,myHand:2}});assert.equal(store.view().counts.myHand,4);
 store.restore();assert.equal(store.view().counts.myHand,2);store.setCounts({myHand:4});store.accept({...s,session:'next'});
 assert.equal(store.view().counts.myHand,1);assert.equal(store.boundSession,null);
});
test('manual checkpoint does not replay earlier movements',()=>{
 const store=new DuelStore();store.deck=deck;store.catalog=catalog;const s=scene();s.moves=[move(5,9612,14,17)];s.extraCount=14;s.banishedCount=1;store.accept(s);store.confirmDeck();
 const i=rebuildInventory(deck,s);store.setInventory(i.extra,i.banished);store.accept({...s,logLength:12});
 assert.equal(store.view().inventory.extra.reduce((a,s)=>a+s.count,0),14);
 assert.throws(()=>store.setInventory([],[]),/总数/);
});
test('stale, paused and uncertain numeric values suppress positive recommendations',()=>{
 const store=new DuelStore();store.deck=deck;store.catalog=catalog;const s=scene();store.accept(s);store.confirmDeck();assert.equal(store.view().result.status,'ready');
 assert.equal(store.view(s.timestamp+2100).result.status,'uncertain');store.paused=true;assert.equal(store.view().result.plans.length,0);
});
