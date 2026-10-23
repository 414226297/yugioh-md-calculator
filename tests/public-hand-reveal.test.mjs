import test from 'node:test';
import assert from 'node:assert/strict';
import {readActions,readActionsIncremental} from '../dist/reader/native-reader.js';
import {handChange,PublicHandTracker} from '../dist/reader/public-hand.js';
import {publicHand} from '../dist/domain/public-hand.js';
import {scene} from './fixtures/scenes.mjs';
const ref=o=>({get:k=>o[k]});
const list=a=>ref({_size:a.length,_items:{at:i=>a[i],getBaseAddress:()=>65536}});
const action=(code,player=1,to=null)=>ref({datal:{get:k=>{if(k==='dataint')throw Error('Hidden identity read');return {datatype:1,databyte0:13,databyte1:player}[k];}},datac:ref({datatype:3,databyte1:code}),datar:ref({datatype:to===null?0:1,databyte0:to,databyte1:player})});
function log(rows){
 const base=[],actions=[],names=[];
 for(const r of rows){if(r.name){base.push(ref({loglabel:'ShowCardName',dataindex:names.length}));names.push(ref({cardid:r.name}));}else{base.push(ref({loglabel:'ShowAction',dataindex:actions.length}));actions.push(r.action);}}
 return ref({m_LogBaseItemList:list(base),m_DataList_ShowAction:list(actions),m_DataList_ShowCardName:list(names),m_DataList_MoveMulti:list([]),m_DataList_ShowChain:list([])});
}
const disclosed=id=>[{action:action(1)},{name:id},{action:action(31)}];
const view=(events,count,length)=>publicHand({...scene(),counts:{...scene().counts,opponentHand:count},logLength:length,publicHandEvents:events});

test('three public draw confirmations survive missed visual displays, both full and incremental readers',()=>{
 const rows=[...disclosed(5979),...disclosed(21612),...disclosed(20500)];
 for(const parse of [l=>readActions(l,0),l=>readActionsIncremental(l,0,'coach',null).result]){
  const result=parse(log(rows)),tracker=new PublicHandTracker();
  assert.equal(result.handChanges.filter(c=>c.type==='enter').length,3);
  assert.equal(result.handChanges.filter(c=>c.type==='handReveal').length,3);
  const events=tracker.update('coach',9,3,[],result.handChanges,1000);
  assert.deepEqual(view(events,3,9).cards,[{id:5979,count:1},{id:20500,count:1},{id:21612,count:1}]);
  const after=parse(log([...rows,{name:21612},{action:action(11,1,8)}]));
  assert.deepEqual(view(tracker.update('coach',11,2,[],after.handChanges,1100),2,11).cards,[{id:5979,count:1},{id:20500,count:1}]);
 }
});

test('confirmation arriving after an already cached anonymous draw identifies exactly that copy',()=>{
 for(const displayed of [false,true]){
  const tracker=new PublicHandTracker();tracker.update('a',1,1,[5979],[],1000);
  const first=readActionsIncremental(log([{action:action(1)}]),0,'a',null);
  const draw={...first.result.handChanges[0],index:1,key:'1:0'};
  tracker.update('a',2,2,displayed?[5979,5979]:[],[draw],1100);
  const second=readActionsIncremental(log(disclosed(5979)),0,'a',first.history);
  const confirmation={...second.result.handChanges[1],index:3,key:'3:0',drawKey:'1:0'};
  const changes=[draw,confirmation];
  assert.deepEqual(view(tracker.update('a',4,2,[],changes,1200),2,4).cards,[{id:5979,count:2}]);
  assert.deepEqual(view(tracker.update('a',4,2,[],changes,1300),2,4).cards,[{id:5979,count:2}]);
 }
});

test('repeated public hand confirmations do not add copies; unnamed confirmations and own hand are ignored',()=>{
 const rows=[{name:5979},{action:action(31)},{name:5979},{action:action(31)}];
 const result=readActions(log(rows),0),tracker=new PublicHandTracker();
 assert.deepEqual(view(tracker.update('a',4,2,[],result.handChanges,1000),2,4).cards,[{id:5979,count:1}]);
 assert.deepEqual(handChange(action(31),1,0,0),[]);
 assert.deepEqual(handChange(action(31,0),1,0,0,ref({cardid:5979})),[]);
 assert.deepEqual(handChange(action(31),1,0,0,ref({cardid:0})),[]);
 assert.equal(handChange(action(1),1,0,0)[0].cardId,undefined);
});
