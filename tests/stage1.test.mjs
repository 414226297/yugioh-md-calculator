import test from 'node:test';
import assert from 'node:assert/strict';
import { countTotal,targetKinds,validateDeck } from '../dist/domain/model.js';
import {deck,scene,inventory} from './fixtures/scenes.mjs';
test('count detail totals nine; unknown never becomes zero',()=>{
 assert.equal(countTotal(scene().counts),9);
 assert.equal(countTotal({...scene().counts,myHand:null}),null);
 assert.equal(countTotal({...scene().counts,myHand:-1}),null);
});
test('type and value deduplication preserves level/rank distinction',()=>{
 const m=(kind,value,faceUp=true)=>({uid:1,kind,value,faceUp});
 assert.deepEqual(targetKinds([m('level',4),m('level',4),m('rank',4),m('level',5),m('none',0),m('level',6,false)]),[{kind:'level',value:4},{kind:'rank',value:4},{kind:'level',value:5}]);
});
test('fixture has 40 main,15 extra,13 kinds; invalid counts rejected',()=>{
 assert.equal(validateDeck(deck),true);
 assert.equal(inventory().extra.reduce((a,c)=>a+c.count,0),15);
 assert.equal(inventory().extra.length,13);
 assert.equal(validateDeck({...deck,extra:{4740:16}}),false);
});
