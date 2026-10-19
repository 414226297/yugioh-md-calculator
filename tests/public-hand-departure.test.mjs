import test from 'node:test';
import assert from 'node:assert/strict';
import {readActions} from '../dist/reader/native-reader.js';
import {handChange,PublicHandTracker} from '../dist/reader/public-hand.js';
import {publicHand} from '../dist/domain/public-hand.js';
import {scene} from './fixtures/scenes.mjs';
const ref=o=>({get:k=>o[k]});
const list=a=>ref({_size:a.length,_items:{at:i=>a[i]}});
const hidden=o=>({get:k=>{if(k==='dataint')throw Error('hidden source identity read');return o[k];}});
const action=(code,from,to,bits=5,player=1)=>ref({datal:hidden({datatype:1,databyte0:from,databyte1:player}),datac:ref({datatype:3,databyte1:code}),datar:ref({datatype:to===null?0:1,databyte0:to,databyte1:player,boolbits:bits})});
function log(rows){
 const base=[],names=[],actions=[],batches=[];
 for(const row of rows){
  if(row.name!==undefined){base.push(ref({loglabel:'ShowCardName',dataindex:names.length}));names.push(ref({cardid:row.name,team:false}));}
  else if(row.action){base.push(ref({loglabel:'ShowAction',dataindex:actions.length}));actions.push(row.action);}
  else if(row.batch){base.push(ref({loglabel:'CardMoveMulti',dataindex:batches.length}));batches.push(ref({actionDatas:list(row.batch)}));}
  else base.push(ref({loglabel:row.label??'SeparateLine',dataindex:0}));
 }
 return ref({m_LogBaseItemList:list(base),m_DataList_ShowCardName:list(names),m_DataList_ShowAction:list(actions),m_DataList_MoveMulti:list(batches),m_DataList_ShowChain:list([])});
}
const view=(events,count)=>publicHand({...scene(),logLength:100,counts:{...scene().counts,opponentHand:count},publicHandEvents:events});

test('public face-up return enters once, preserves duplicate copies and can leave again',()=>{
 // Actual 2026-10-18 public return #235: source 2/bits13 -> hand13/bits9.
 const bounce=ref({datal:hidden({datatype:1,databyte0:2,databyte1:1,boolbits:13}),datac:ref({datatype:3,databyte1:33}),datar:ref({datatype:1,databyte0:13,databyte1:1,boolbits:9})});
 const changes=readActions(log([{label:'SeparateLine'},{name:12307},{action:bounce}]),0).handChanges;
 assert.equal(changes[0].cardId,12307);
 const tracker=new PublicHandTracker();tracker.update('bounce',1,1,[12307],[],0);
 const events=tracker.update('bounce',3,2,[],changes,1);
 assert.deepEqual(view(events,2).cards,[{id:12307,count:2}]);
 assert.deepEqual(view(tracker.update('bounce',3,2,[],changes,2),2).cards,[{id:12307,count:2}]);
 assert.deepEqual(view(tracker.update('bounce',4,1,[],[...changes,{key:'3:0',index:3,type:'leave',cardId:12307}],3),1).cards,[{id:12307,count:1}]);
});

test('return without a public name never reads hidden source identities',()=>{
 for(const bits of [undefined,9,1]){
  const bounce=ref({datal:hidden({datatype:1,databyte0:2,databyte1:1,boolbits:bits}),datac:ref({datatype:3,databyte1:33}),datar:ref({datatype:1,databyte0:13,databyte1:1,boolbits:9})});
  assert.equal(handChange(bounce,2,0,0)[0].cardId,undefined);
 }
});

// Observed public schema: hand(13) -> monster(3), SPSUMMON(3), rightBits=7;
// adjacent ShowCardName is Digital Bug Cocoondenser (12305).
test('public special summon removes exactly Cocoondenser, not the effect owner or other hand cards',()=>{
 const data=readActions(log([{label:'SeparateLine'},{name:12307},{action:action(11,2,null)},{name:12305},{action:action(3,13,3,7)}]),0);
 assert.deepEqual(data.handChanges,[{key:'4:0',index:4,type:'leave',cardId:12305}]);
 const tracker=new PublicHandTracker();tracker.update('a',1,3,[12305,12307,100],[],0);
 const after=tracker.update('a',5,2,[],data.handChanges,1000);
 assert.deepEqual(view(after,2).cards,[{id:100,count:1},{id:12307,count:1}]);assert.deepEqual(view(after,2).uncertainCards,[]);
 assert.deepEqual(view(tracker.update('a',5,2,[],data.handChanges,1500),2),view(after,2));
});
test('a public departure consumes one duplicate and removes an uncertain copy too',()=>{
 const tracker=new PublicHandTracker();tracker.update('a',1,3,[12305,12305,100],[],0);
 const move={key:'1:0',index:1,type:'leave',cardId:12305};
 assert.deepEqual(view(tracker.update('a',2,2,[],[move],500),2).cards,[{id:100,count:1},{id:12305,count:1}]);
 const events=[{key:'r',index:0,type:'reveal',cards:[12305,100]},{key:'u',index:1,type:'invalidate'},{key:'l',index:2,type:'leave',cardId:12305}];
 assert.deepEqual(view(events,1).uncertainCards,[{id:100,count:1}]);
});
test('spell activation from hand to field is a departure, in-hand effect and card selection are not',()=>{
 const data=readActions(log([{name:5236},{action:action(11,13,9)},{name:100},{action:action(11,13,null)},{name:100},{action:action(23,13,7)}]),0);
 assert.deepEqual(data.handChanges,[{key:'1:0',index:1,type:'leave',cardId:5236}]);
});
test('public graveyard departures can match names without inspecting source identities',()=>{
 for(const code of [24,25])assert.deepEqual(handChange(action(code,13,16),1,0,0,ref({cardid:12305})),[{key:'1:0',index:1,type:'leave',cardId:12305}]);
});
test('hidden movements without public name rows stay anonymous',()=>{
 const forbidden={get:()=>{throw Error('name read for hidden/non-public action');}};
 for(const [code,to,bits] of [[13,7,9],[14,7,9],[36,2,9],[33,15,1],[3,2,9]]){
  const result=handChange(action(code,13,to,bits),1,0,0);
  assert.equal(result[0].type,'leave');assert.equal(result[0].cardId,undefined);
 }
 assert.equal(handChange(action(3,13,2),1,0,0)[0].cardId,undefined);
 for(const id of [0,-1,65536,undefined])assert.equal(handChange(action(3,13,2),1,0,0,ref({cardid:id}))[0].cardId,undefined);
 assert.deepEqual(handChange(action(1,13,null),1,0,0,forbidden).map(c=>c.type),['enter']);
});
test('an old effect name cannot leak across separators or be assigned to multiple moves',()=>{
 const data=readActions(log([{name:12307},{label:'SeparateLine'},{action:action(3,13,3,7)},{name:12305},{batch:[action(3,13,1),action(3,13,2)]}]),0);
 assert.equal(data.handChanges.length,3);assert.equal(data.handChanges.every(c=>c.cardId===undefined),true);
});
test('field-to-material movements following a summon do not remove another hand copy',()=>{
 const data=readActions(log([{name:12305},{action:action(3,13,3,7)},{name:12305},{action:action(28,3,5,133)},{name:12305},{action:action(30,18,null)}]),0);
 assert.equal(data.handChanges.length,1);assert.equal(data.handChanges[0].cardId,12305);
});

test('recorded chain return and hand-to-material sequence adds and removes the exact public card',()=>{
 const returned=ref({datal:hidden({datatype:1,databyte0:3,databyte1:1,boolbits:15}),datac:ref({datatype:3,databyte1:33}),datar:ref({datatype:1,databyte0:13,databyte1:1,boolbits:9})});
 const rows=[{label:'ShowChain'},{name:12305},{action:returned}];
 const tracker=new PublicHandTracker();tracker.update('chain',1,1,[100],[],0);
 let changes=readActions(log(rows),0).handChanges;
 assert.deepEqual(changes,[{key:'2:0',index:2,type:'enter',cardId:12305}]);
 assert.deepEqual(view(tracker.update('chain',3,2,[],changes,1),2).cards,[{id:100,count:1},{id:12305,count:1}]);
 rows.push({name:12336},{action:action(11,12,null)},{label:'ShowChain'},{name:12305},{action:action(28,13,5,133)});
 changes=readActions(log(rows),0).handChanges;
 const result=tracker.update('chain',rows.length,1,[],changes,2);
 assert.deepEqual(view(result,1).cards,[{id:100,count:1}]);assert.deepEqual(view(result,1).uncertainCards,[]);
 assert.deepEqual(tracker.update('chain',rows.length,1,[],changes,3),result);
});

test('material departure consumes one recorded duplicate and does not use stale effect owner names',()=>{
 const tracker=new PublicHandTracker();tracker.update('mat',1,3,[12305,12305,100],[],0);
 const data=readActions(log([{label:'ShowChain'},{name:12305},{action:action(28,13,5,133)}]),0);
 assert.deepEqual(view(tracker.update('mat',3,2,[],data.handChanges,1),2).cards,[{id:100,count:1},{id:12305,count:1}]);
 const anonymous=readActions(log([{name:12336},{label:'ShowChain'},{action:action(28,13,5,133)}]),0).handChanges;
 assert.equal(anonymous[0].type,'leave');assert.equal(anonymous[0].cardId,undefined);
 const forbidden={get:()=>{throw Error('non-public material name');}};
 assert.equal(handChange(action(28,13,5,129),1,0,0)[0].cardId,undefined);
 assert.equal(handChange(action(33,13,15,133),1,0,0)[0].cardId,undefined);
});

test('public log names identify every supported hand departure independently of destination visibility flags',()=>{
 const movements=[2,3,4,5,6,7,8,9,13,14,15,18,20,21,22,24,25,26,27,28,29,33,34,35,36,39,49,51];
 for(const code of movements)for(const to of [0,5,7,12,14,15,16,17,18])for(const bits of [1,5,7,9,13,15,129,133]){
  const result=handChange(action(code,13,to,bits),1,0,0,ref({cardid:12305}));
  assert.equal(result[0].type,'leave',`${code}/${to}/${bits}`);assert.equal(result[0].cardId,12305);
  const tracker=new PublicHandTracker();tracker.update('matrix',1,2,[12305,100],[],0);
  const events=tracker.update('matrix',2,1,[],result,1);
  assert.deepEqual(view(events,1).cards,[{id:100,count:1}]);
  assert.deepEqual(tracker.update('matrix',2,1,[],result,2),events);
 }
});

test('a valid public name does not turn selection, an in-hand effect or malformed coordinates into departures',()=>{
 const forbidden={get:()=>{throw Error('non-movement name access');}};
 for(const code of [0,10,12,16,17,19,23,30,31,32,37,38,40])assert.deepEqual(handChange(action(code,13,7),1,0,0,forbidden),[]);
 assert.deepEqual(handChange(action(11,13,null),1,0,0,forbidden),[]);
 for(const to of [-1,19,NaN])assert.equal(handChange(action(33,13,to),1,0,0,forbidden)[0].type,'invalidate');
 assert.equal(handChange(action(99,13,16),1,0,0,forbidden)[0].type,'invalidate');
});

test('one-item batches use adjacent public names while multi-card batches remain anonymous',()=>{
 const single=readActions(log([{name:12305},{batch:[action(33,13,15,1)]}]),0);
 assert.equal(single.handChanges[0].cardId,12305);
 const multiple=readActions(log([{name:12305},{batch:[action(33,13,15,1),action(33,13,15,1)]}]),0);
 assert.equal(multiple.handChanges.length,2);assert.equal(multiple.handChanges.every(c=>c.cardId===undefined),true);
});
