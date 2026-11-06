import test from 'node:test';
import assert from 'node:assert/strict';
import {CatalogRefresh,missingCatalogCards} from '../dist/data/catalog-refresh.js';
const hour=3600000,now=100*hour;
test('fresh cache waits one day; expired, invalid and missing cards trigger refresh',()=>{
  assert.equal(new CatalogRefresh(now).due(now,false),false);
  assert.equal(new CatalogRefresh(now).due(now+24*hour,false),true);
  assert.equal(new CatalogRefresh(now,true).due(now,false),true);
  assert.equal(new CatalogRefresh(now).due(now,true),true);
  assert.equal(new CatalogRefresh().due(now,false),true);
  assert.equal(new CatalogRefresh(now+hour).due(now,false),true);
});
test('failed requests retry hourly while successful unknown-card checks are also limited',()=>{
  for(const success of [true,false]){
    const policy=new CatalogRefresh(now);
    policy.start(now);policy.finish(now,success);
    assert.equal(policy.due(now+hour-1,true),false);
    assert.equal(policy.due(now+hour,true),true);
    assert.equal(policy.due(now+hour,false),!success);
  }
});
test('successful refresh clears stale cache and failure state',()=>{
  const policy=new CatalogRefresh(0,true);
  policy.start(now);policy.finish(now,false);
  policy.start(now+hour);policy.finish(now+hour,true);
  assert.equal(policy.due(now+2*hour,false),false);
  assert.equal(policy.due(now+25*hour,false),true);
});
test('missing identity detection includes local deck, public draws and remembered disclosures',()=>{
  const cards={1:{id:1,name:'Known',category:'spell',password:123}};
  assert.equal(missingCatalogCards(cards,null,null),false);
  assert.equal(missingCatalogCards(cards,{main:{1:1},extra:{}},null),false);
  assert.equal(missingCatalogCards(cards,{main:{2:1},extra:{}},null),true);
  for(const snapshot of [
    {publicHandObservation:{cards:[2],changes:[]}},
    {publicHandObservation:{cards:[],changes:[{type:'deckTop',cardId:2}]}},
    {publicHandEvents:[{type:'reveal',cards:[2]}]},
    {moves:[{cardId:2}]},
  ])assert.equal(missingCatalogCards(cards,null,snapshot),true);
  assert.equal(missingCatalogCards({1:{id:1,name:'Incomplete'}},{main:{1:1},extra:{}},null),true);
});
