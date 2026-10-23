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
test('confirmed zero hand clears records while a transitional zero preserves confirmed history',()=>{
 const store=new DuelStore();const obs=(count,cards,busy)=>({...scene(),session:'zero',logLength:10,counts:{...scene().counts,opponentHand:count},publicHandObservation:{cards,changes:[]},busy});
 store.accept(obs(2,[100,200],false));
 store.accept(obs(0,[],true));assert.equal(store.view().publicHand.cards.length,2);
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

test('summon count/log races retain other known cards and consume departure exactly once',()=>{
 for(const logFirst of [false,true]){
  const store=new DuelStore();const base=scene();
  const snap=(time,count,changes,busy)=>({...base,session:'42:race',timestamp:time,logLength:changes.length?11:10,busy,counts:{...base.counts,opponentHand:count},publicHandObservation:{cards:[],changes}});
  store.accept({...snap(1000,3,[],false),publicHandObservation:{cards:[100,200,300],changes:[]}});
  const leave={key:'10:leave',index:10,type:'leave',cardId:100};
  store.accept(snap(1100,logFirst?3:2,logFirst?[leave]:[],true));
  assert.equal(store.view(1100).publicHand.cards.length,3);
  store.accept(snap(1200,logFirst?3:2,logFirst?[leave]:[],true));
  assert.equal(store.view(1200).publicHand.cards.length,3);
  store.accept(snap(1300,2,[leave],false));
  assert.deepEqual(store.view(1300).publicHand.cards,[{id:200,count:1},{id:300,count:1}]);
  store.accept(snap(1400,2,[leave],false));
  assert.deepEqual(store.view(1400).publicHand.uncertainCards,[]);
 }
});
test('unresolved summon mismatch eventually becomes uncertain instead of inventing identities',()=>{
 const store=new DuelStore(),base=scene();
 const snap=(timestamp,busy,count,cards)=>({...base,timestamp,busy,counts:{...base.counts,opponentHand:count},publicHandObservation:{cards,changes:[]}});
 store.accept(snap(1000,false,3,[100,200,300]));
 store.accept(snap(1100,true,2,[]));
 assert.equal(store.view(1100).publicHand.cards.length,3);
 store.accept(snap(2800,false,2,[]));
 assert.equal(store.view(2800).publicHand.cards.length,0);
 assert.equal(store.view(2800).publicHand.uncertainCards.length,3);
});

test('overlay memory survives chain read gaps and missing busy roots, but obeys public departures and menu exit',()=>{
 const store=new DuelStore();store.catalog={300:{id:300,category:'trap'}};
 const changes=[{key:'4:set',index:4,type:'fieldSet',slot:9,cardId:300}];
 const base={...scene(),session:'42:chain',logLength:10,opponentSetSlots:[9],opponentPublicSlots:[],publicHandObservation:{cards:[100,200],changes}};
 store.accept(base);
 const busy={...base,busy:true,opponentSetSlots:[],publicHandObservation:{cards:[],changes}};
 store.accept(busy);store.accept(busy);
 assert.equal(store.view().backrow.cards[0].confirmedId,300);
 store.accept({...scene(),status:'error',session:null,reason:'场面更新中'});
 const retained=store.view(Date.now()+10000);
 assert.equal(retained.stale,true);assert.equal(retained.overlaySnapshot.session,'42:chain');
 assert.equal(retained.overlaySnapshot.counts.opponentHand,2);
 assert.equal(retained.backrow.cards[0].confirmedId,300);assert.equal(retained.publicHand.cards.length,2);
 const departure=[...changes,{key:'10:field',index:10,type:'fieldLeave',slot:9},{key:'11:hand',index:11,type:'leave',cardId:100}];
 store.accept({...busy,logLength:12,counts:{...base.counts,opponentHand:1},publicHandObservation:{cards:[],changes:departure}});
 assert.deepEqual(store.view().backrow.cards,[]);assert.deepEqual(store.view().publicHand.cards,[{id:200,count:1}]);
 assert.equal(store.view().overlaySnapshot.counts.opponentHand,1);
 store.accept({...scene(),status:'menu',session:null});
 assert.equal(store.view().overlaySnapshot,null);assert.deepEqual(store.view().backrow.cards,[]);
});
