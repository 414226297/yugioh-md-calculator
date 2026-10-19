import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleHand,handChange,PublicHandTracker} from '../dist/reader/public-hand.js';
import {publicHand} from '../dist/domain/public-hand.js';
import {readActions} from '../dist/reader/native-reader.js';
import {scene} from './fixtures/scenes.mjs';
const ref=o=>({get:k=>o[k]});
const lst=a=>ref({_size:a.length,_items:{at:i=>a[i]}});
const privateRef=o=>({get:k=>{if(['dataint','m_Mrk','m_UniqueId'].includes(k))throw Error('hidden identity accessed');return o[k];}});
const action=(type,from,player,to=null,target=player)=>ref({datal:privateRef({datatype:1,databyte0:from,databyte1:player}),datac:ref({datatype:3,databyte1:type}),datar:ref({datatype:to===null?0:1,databyte0:to,databyte1:target})});
function view(events,count=5,logLength=100){return publicHand({...scene(),logLength,counts:{...scene().counts,opponentHand:count},publicHandEvents:events});}
test('display gate reads identities only for explicit non-hidden entries',()=>{
 assert.deepEqual(visibleHand([privateRef({m_IsHide:true}),ref({m_IsHide:false,m_Mrk:100})]),[100]);
 assert.throws(()=>visibleHand([privateRef({m_IsHide:undefined})]),/显示状态/);
 assert.throws(()=>visibleHand([ref({m_IsHide:false,m_Mrk:0})]),/编号/);
});
test('opponent draws, searches and departures read metadata without hidden identity',()=>{
 assert.equal(handChange(action(1,13,1),1,0,0)[0].type,'enter');
 assert.equal(handChange(action(26,15,1,13),1,0,0)[0].type,'enter');
 assert.equal(handChange(action(2,13,1,0),1,0,0)[0].type,'leave');
 assert.equal(handChange(action(13,13,1,7),1,0,0)[0].type,'leave');
 assert.equal(handChange(action(24,13,1,16),1,0,0)[0].type,'leave');
 assert.equal(handChange(action(33,13,1,15),1,0,0)[0].type,'leave');
 assert.deepEqual(handChange(action(26,15,0,13),1,0,0),[]);
 assert.equal(handChange(action(33,16,0,13,1),1,0,0)[0].type,'enter');
 assert.equal(handChange(action(2,13,0,0),1,0,1)[0].type,'leave');
});
test('selection and an in-hand effect preserve cards; unknown hand operations invalidate',()=>{
 for(const type of [11,17,23,30,31])assert.deepEqual(handChange(action(type,13,1),1,0,0),[]);
 assert.equal(handChange(action(99,13,1),1,0,0)[0].type,'invalidate');
 assert.equal(handChange(action(28,13,1,13),1,0,0)[0].type,'invalidate');
});
test('reader logs sanitize opponent movements while preserving own-inventory exclusion',()=>{
 const log=ref({m_LogBaseItemList:lst([ref({loglabel:'ShowAction',dataindex:0}),ref({loglabel:'ShowText',dataindex:0})]),m_DataList_ShowAction:lst([action(13,13,1,7)]),m_DataList_MoveMulti:lst([]),m_DataList_ShowChain:lst([])});
 const result=readActions(log,0);assert.deepEqual(result.moves,[]);
 assert.deepEqual(result.handChanges.map(c=>c.type),['leave']);
 assert.equal(JSON.stringify(result).includes('cardId'),false);
});
test('public display closes without a departure: all observed cards remain',()=>{
 const tracker=new PublicHandTracker();
 const first=tracker.update('a',34,5,[100,101,102,103,104],[],1000);
 assert.equal(view(first).cards.length,5);
 const closed=tracker.update('a',36,5,[],[],1500);
 assert.deepEqual(view(closed).cards,view(first).cards);
 assert.deepEqual(tracker.update('a',36,5,[],[],1800),closed);
});
test('repeated display, hidden draw, anonymous departure and later re-reveal',()=>{
 const tracker=new PublicHandTracker();tracker.update('a',10,3,[100,100,200],[],1000);
 const repeated=tracker.update('a',10,3,[100,100,200],[],1100);assert.equal(repeated.length,1);
 const draw={key:'10:0',index:10,type:'enter'};
 assert.deepEqual(view(tracker.update('a',11,4,[],[draw],1200),4).cards,[{id:100,count:2},{id:200,count:1}]);
 const out={key:'11:0',index:11,type:'leave'};
 const after=tracker.update('a',12,3,[],[draw,out],1300);
 assert.deepEqual(view(after,3).cards,[{id:100,count:1}]);
 assert.deepEqual(view(tracker.update('a',12,3,[100,200,300],[draw,out],1400),3).cards,[{id:100,count:1},{id:200,count:1},{id:300,count:1}]);
});
test('elapsed time with a continuous log keeps previously disclosed cards',()=>{
 const tracker=new PublicHandTracker();tracker.update('a',10,1,[100],[],1000);
 assert.deepEqual(view(tracker.update('a',10,1,[],[],60000)).cards,[{id:100,count:1}]);
});
test('log replacement and unexplained quantity changes retain only uncertain history; new sessions clear it',()=>{
 for(const scenario of ['rollback','rewrite','quantity','session']){
  const tracker=new PublicHandTracker();tracker.update('a',10,1,[100],[],1000);
  let next;
  if(scenario==='rollback')next=tracker.update('a',9,1,[],[],1100);
  if(scenario==='rewrite')next=tracker.update('a',10,1,[],[{key:'1:0',index:1,type:'enter'}],1100);
  if(scenario==='quantity')next=tracker.update('a',10,2,[],[],1100);
  if(scenario==='session')next=tracker.update('b',10,1,[],[],1100);
  assert.deepEqual(view(next).cards,[],scenario);
  assert.deepEqual(view(next).uncertainCards,scenario==='session'?[]:[{id:100,count:1}],scenario);
 }
});
test('unrecognized hand operation keeps uncertain history, fresh full disclosure replaces it',()=>{
 const tracker=new PublicHandTracker();tracker.update('a',10,2,[100,200],[],1000);
 const changes=[{key:'10:0',index:10,type:'invalidate'}];
 const uncertain=view(tracker.update('a',11,2,[],changes,1100));
 assert.deepEqual(uncertain.cards,[]);assert.equal(uncertain.uncertainCards.length,2);
 const refreshed=view(tracker.update('a',11,2,[200,300],changes,1200),2);
 assert.deepEqual(refreshed.cards,[{id:200,count:1},{id:300,count:1}]);assert.deepEqual(refreshed.uncertainCards,[]);
 tracker.reset();assert.deepEqual(view(tracker.update('a',11,2,[],changes,1300)).cards,[]);
});
test('turn, phase and ordinary text logs do not erase or downgrade hand knowledge',()=>{
 const log=ref({m_LogBaseItemList:lst(['ShowTurn','ShowPhase','ShowText'].map(loglabel=>ref({loglabel,dataindex:0}))),m_DataList_ShowAction:lst([]),m_DataList_MoveMulti:lst([]),m_DataList_ShowChain:lst([])});
 assert.deepEqual(readActions(log,0).handChanges,[]);
});
