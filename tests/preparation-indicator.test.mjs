import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationIndicator,preparationIndicatorBounds} from '../dist/domain/preparation-indicator.js';
import {DuelStore} from '../dist/domain/store.js';
import {deck,catalog,scene} from './fixtures/scenes.mjs';
const selected={id:deck.id,name:deck.name,revision:10};
function view(extra={}){const store=new DuelStore();store.catalog=catalog;store.accept({...scene(),status:'menu',session:null,deckSource:'preparation',preparationVisible:true,readerPid:42,deckSelection:selected,deck:{...deck,revision:10},...extra});return store.view();}
test('preparation indicator is ready only for the selected matching deck and loaded attributes',()=>{
 const v=view();assert.equal(preparationIndicator(v,42).ready,true);assert.match(preparationIndicator(v,42).info,/主卡组/);
 assert.equal(preparationIndicator(view({deck:{...deck,revision:9}}),42).ready,false);
 assert.equal(preparationIndicator(view({deck:null}),42).status,'卡表尚未获取');
 assert.equal(preparationIndicator(view({deck:null,deckSelection:null}),42).status,'等待选择卡组');
 assert.equal(preparationIndicator({...v,deckAttributesReady:false,deckReady:false},42).status,'卡片属性待更新');
});
test('preparation indicator hides outside the actual preparation screen and on stale/paused/wrong-process data',()=>{
 const v=view();for(const change of [{stale:true},{paused:true},{snapshot:{...v.snapshot,status:'duel'}},{snapshot:{...v.snapshot,status:'error'}},{snapshot:{...v.snapshot,preparationVisible:undefined}}])assert.equal(preparationIndicator({...v,...change},42),null);
 assert.equal(preparationIndicator(v,43),null);assert.equal(preparationIndicator(v,undefined),null);
});
test('switching decks cannot reuse readiness or contents of previous deck',()=>{
 const v=view();v.snapshot={...v.snapshot,deckSelection:{...selected,id:'other',name:'新卡组'}};
 const indicator=preparationIndicator(v,42);assert.equal(indicator.ready,false);assert.equal(indicator.name,'新卡组');assert.doesNotMatch(indicator.info,/主卡组/);
});
test('preparation badge bounds stay inside letterboxed viewport and scale on window move',()=>{
 const base=preparationIndicatorBounds({x:0,y:0,width:1366,height:768});
 assert.ok(base.x+base.width<=1366);assert.ok(base.y+base.height<=768);
 const small=preparationIndicatorBounds({x:-500,y:80,width:683,height:384});
 assert.ok(Math.abs(small.x+500-base.x/2)<=1);assert.ok(Math.abs(small.y-80-base.y/2)<=1);
 const wide=preparationIndicatorBounds({x:0,y:0,width:1800,height:768});assert.equal(wide.x-base.x,217);
});
