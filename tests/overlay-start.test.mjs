import test from 'node:test';
import assert from 'node:assert/strict';
import {readActions,readActionsIncremental} from '../dist/reader/native-reader.js';
import {DuelStore} from '../dist/domain/store.js';
import {scene} from './fixtures/scenes.mjs';
const ref=value=>({get:key=>value[key]});
const list=values=>ref({_size:values.length,_items:{at:i=>values[i]}});
const log=labels=>ref({m_LogBaseItemList:list(labels.map(loglabel=>ref({loglabel,dataindex:0}))),m_DataList_ShowAction:list([]),m_DataList_MoveMulti:list([]),m_DataList_ShowChain:list([]),m_DataList_ShowCardName:list([])});
test('both readers require public turn/phase evidence, including incremental updates and replay entry',()=>{
 for(const labels of [[],['ShowFirstPlayer'],['ShowText'],['ShowFirstPlayer','ShowTurn'],['ShowPhase']]){
  const expected=labels.includes('ShowTurn')||labels.includes('ShowPhase');
  assert.equal(readActions(log(labels),0).duelStarted,expected);
  assert.equal(readActionsIncremental(log(labels),0,'a',null).result.duelStarted,expected);
 }
 const before=readActionsIncremental(log(['ShowFirstPlayer']),0,'a',null);
 const started=readActionsIncremental(log(['ShowFirstPlayer','ShowTurn']),0,'a',before.history);
 assert.equal(started.result.duelStarted,true);
 assert.equal(readActionsIncremental(log([]),0,'b',started.history).result.duelStarted,false);
});
test('start confirmation persists only within the same duel and survives temporary read gaps',()=>{
 const store=new DuelStore();store.accept({...scene(),duelStarted:false});
 assert.equal(store.view().overlaySnapshot.duelStarted,false);
 store.accept({...scene(),duelStarted:true});assert.equal(store.view().overlaySnapshot.duelStarted,true);
 store.accept({...scene(),status:'error',session:null});assert.equal(store.view().overlaySnapshot.duelStarted,true);
 store.accept({...scene(),duelStarted:false});assert.equal(store.view().overlaySnapshot.duelStarted,true);
 store.accept({...scene(),session:'next',duelStarted:false});assert.equal(store.view().overlaySnapshot.duelStarted,false);
 store.accept({...scene(),status:'menu',session:null});assert.equal(store.view().overlaySnapshot,null);
 store.accept({...scene(),duelStarted:undefined});assert.equal(store.view().overlaySnapshot.duelStarted,false);
});
