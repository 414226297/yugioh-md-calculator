import test from 'node:test';
import assert from 'node:assert/strict';
import {publicHand} from '../dist/domain/public-hand.js';
import {DuelStore} from '../dist/domain/store.js';
import {scene} from './fixtures/scenes.mjs';
const snapshot=(events,extra={})=>({...scene(),logLength:100,counts:{...scene().counts,opponentHand:6},publicHandEvents:events.map((e,index)=>({key:String(index),index,...e})),...extra});
const reveal=(...cards)=>({type:'reveal',cards});
const enter=cardId=>({type:'enter',cardId});
const leave=cardId=>({type:'leave',cardId});
test('revealed cards persist; repeated disclosure does not multiply copies',()=>{
 assert.deepEqual(publicHand(snapshot([reveal(100),reveal(100)])).cards,[{id:100,count:1}]);
 assert.deepEqual(publicHand(snapshot([reveal(100,100),reveal(100)])).cards,[{id:100,count:2}]);
});
test('public additions and one-copy departures respect duplicate quantities',()=>{
 assert.deepEqual(publicHand(snapshot([enter(100),enter(100),leave(100)])).cards,[{id:100,count:1}]);
 assert.deepEqual(publicHand(snapshot([enter(100),leave(100),enter(100)])).cards,[{id:100,count:1}]);
});
test('an unidentified departure never leaves an unsupported identity on screen',()=>{
 const v=publicHand(snapshot([reveal(100,100,200),leave(null)]));
 assert.deepEqual(v.cards,[{id:100,count:1}]);assert.equal(v.status,'partial');
 assert.deepEqual(v.uncertainCards,[{id:100,count:1},{id:200,count:1}]);
 assert.deepEqual(publicHand(snapshot([reveal(100,200),leave(null)])).cards,[]);
});
test('uncertain shuffle invalidates previous records but accepts later public evidence',()=>{
 assert.deepEqual(publicHand(snapshot([enter(100),{type:'invalidate'},enter(200)])).cards,[{id:200,count:1}]);
});
test('duplicate log entries are idempotent and snapshots replay without accumulating',()=>{
 const events=[{...enter(100),key:'same'},{...enter(100),key:'same'}];
 const s=snapshot(events);const a=publicHand(s);assert.deepEqual(a.cards,[{id:100,count:1}]);assert.deepEqual(publicHand(s),a);
});
test('busy and stale keep last confirmed hand; contradictory evidence still reduces certainty',()=>{
 assert.equal(publicHand(scene()).status,'unavailable');
 const stale=publicHand(snapshot([enter(100)]),true);assert.deepEqual(stale.cards,[{id:100,count:1}]);assert.deepEqual(stale.uncertainCards,[]);
 const busy=publicHand(snapshot([enter(100)],{busy:true}));assert.deepEqual(busy.cards,[{id:100,count:1}]);assert.deepEqual(busy.uncertainCards,[]);
 const mismatch=publicHand(snapshot([reveal(100,200)],{counts:{...scene().counts,opponentHand:1}}));assert.equal(mismatch.status,'partial');assert.deepEqual(mismatch.cards,[]);assert.equal(mismatch.uncertainCards.length,2);
 assert.deepEqual(publicHand(snapshot([enter(0)])).cards,[]);
 assert.deepEqual(publicHand(snapshot([{...enter(100),index:101}])).cards,[]);
});
test('partial logs report limited coverage and do not infer unobserved cards',()=>{
 const v=publicHand(snapshot([enter(100)],{completeLog:false}));assert.equal(v.status,'partial');assert.deepEqual(v.cards,[{id:100,count:1}]);
});
test('store clears public records outside duel and on next session without a deck dependency',()=>{
 const store=new DuelStore();store.accept(snapshot([enter(100)]));assert.equal(store.view().publicHand.cards.length,1);
 store.paused=true;assert.equal(store.view().publicHand.cards.length,1);store.paused=false;
 store.accept({...scene(),status:'menu',session:null});assert.deepEqual(store.view().publicHand.cards,[]);
 store.accept(snapshot([],{session:'next'}));assert.deepEqual(store.view().publicHand.cards,[]);
});
test('store preserves records through busy frames, read errors, worker recreation and pause',()=>{
 const store=new DuelStore();
 const observed=(cards,extra={})=>({...scene(),session:'persist',logLength:10,counts:{...scene().counts,opponentHand:2},publicHandObservation:{cards,changes:[]},...extra});
 store.accept(observed([100,200]));assert.equal(store.view().publicHand.cards.length,2);
 store.accept(observed([],{busy:true}));assert.equal(store.view().publicHand.cards.length,2);
 store.accept({...scene(),status:'error',session:null,reason:'temporary read failure'});assert.equal(store.view().publicHand.cards.length,2);
 store.accept(observed([],{timestamp:Date.now()-10000}));assert.equal(store.view().publicHand.cards.length,2);
 store.accept(observed([]));assert.equal(store.view().publicHand.cards.length,2);
 store.accept({...observed([]),publicHandObservation:undefined});assert.equal(store.view().publicHand.cards.length,2);
 store.accept(observed([]));store.paused=true;assert.equal(store.view().publicHand.cards.length,2);
 store.paused=false;assert.equal(store.view().publicHand.cards.length,2);
 store.accept(observed([],{session:'new-duel'}));assert.deepEqual(store.view().publicHand.uncertainCards,[]);assert.deepEqual(store.view().publicHand.cards,[]);
});
test('confirmed zero hand clears records while a transitional zero preserves uncertain history',()=>{
 const store=new DuelStore();const obs=(count,cards,busy)=>({...scene(),session:'zero',logLength:10,counts:{...scene().counts,opponentHand:count},publicHandObservation:{cards,changes:[]},busy});
 store.accept(obs(2,[100,200],false));
 store.accept(obs(0,[],true));assert.equal(store.view().publicHand.uncertainCards.length,2);
 store.accept(obs(0,[],false));assert.deepEqual(store.view().publicHand.cards,[]);assert.deepEqual(store.view().publicHand.uncertainCards,[]);
});

test('unrelated busy scene updates do not repeatedly toggle hand certainty',()=>{
 const store=new DuelStore();const base={...scene(),session:'hand-stable',logLength:10,counts:{...scene().counts,opponentHand:2},publicHandObservation:{cards:[100,200],changes:[]}};
 store.accept(base);
 store.accept({...base,busy:true,publicHandObservation:{cards:[],changes:[]}});
 assert.equal(store.view().publicHand.cards.length,2);
 for(const busy of [true,false,true,false,true]){
  store.accept({...base,logLength:20,busy,publicHandObservation:{cards:[],changes:[]}});
  assert.equal(store.view().publicHand.cards.length,2);assert.equal(store.view().publicHand.uncertainCards.length,0);
 }
 store.paused=true;assert.equal(store.view().publicHand.cards.length,2);
});
