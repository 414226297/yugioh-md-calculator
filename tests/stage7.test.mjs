import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDeck} from '../dist/domain/model.js';
import {deck} from './fixtures/scenes.mjs';
import {DuelStore} from '../dist/domain/store.js';
import {catalog,scene,move} from './fixtures/scenes.mjs';
import {SceneStability} from '../dist/reader/native-reader.js';

test('stable public scene becomes usable without input permission; changes and gaps recheck',()=>{
 const gate=new SceneStability();
 assert.equal(gate.busy('scene-a',100),true);
 assert.equal(gate.busy('scene-a',600),false);
 assert.equal(gate.busy('scene-b',1100),true);
 assert.equal(gate.busy('scene-b',1600),false);
 assert.equal(gate.busy('scene-b',5000),true);
 assert.equal(gate.busy('scene-b',5500),false);
});

test('validated owned scenes tolerate slow reads but still recheck changes and clock rollback',()=>{
 const gate=new SceneStability();
 assert.equal(gate.busy('scene-a',100,Infinity),true);
 assert.equal(gate.busy('scene-a',3100,Infinity),false);
 assert.equal(gate.busy('scene-b',6100,Infinity),true);
 assert.equal(gate.busy('scene-b',9100,Infinity),false);
 assert.equal(gate.busy('scene-b',8100,Infinity),true);
});

test('damaged persisted deck is rejected without crashing startup',()=>{
 for(const value of [null,{},'deck',{id:'x'}, {...deck,main:null},{...deck,extra:[]},{...deck,readAt:'yesterday'},{...deck,extra:{'1.5':1}}]){
  assert.equal(validateDeck(value),false);
 }
 assert.equal(validateDeck(deck),true);
});

test('known non-material extra cards remain in inventory without becoming cannon materials',()=>{
 const store=new DuelStore();store.catalog={...catalog,999:{id:999,name:'non-material extra monster',kind:'other',value:8}};
 const revised=structuredClone(deck);delete revised.extra[4740];revised.extra[999]=1;
 store.setDeck(revised);store.accept(scene());store.confirmDeck();
 assert.equal(store.view().inventory.extra.reduce((n,s)=>n+s.count,0),15);
 assert.equal(store.view().result.plans.length,0);
});

test('two identical xyz copies banished then one returned leaves one in each zone',()=>{
 const store=new DuelStore();store.deck=deck;store.catalog=catalog;
 const s=scene();s.extraCount=14;s.banishedCount=1;s.logLength=115;
 s.moves=[move(104,17645,14,17,{key:'104:0'}),move(104,17645,14,17,{key:'104:1'}),move(104,17746,14,17,{key:'104:2'}),move(108,17645,17,null,{action:23}),move(110,17645,17,14),move(112,17746,17,null,{action:23}),move(114,17746,17,14)];
 store.accept(s);store.confirmDeck();
 const inv=store.view().inventory;
 assert.equal(inv.quality,'confirmed');
 assert.equal(inv.extra.find(c=>c.id===17645).count,1);
 assert.equal(inv.extra.find(c=>c.id===17746).count,1);
 assert.deepEqual(inv.banished,[{id:17645,count:1,face:'up'}]);
 assert.equal(inv.extra.reduce((n,c)=>n+c.count,0),14);
});
