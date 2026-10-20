import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicHandTracker} from '../dist/domain/public-hand-tracker.js';
import {publicHand} from '../dist/domain/public-hand.js';
import {handChange,facedownBackrow,faceupBackrow} from '../dist/reader/public-hand.js';
import {scene} from './fixtures/scenes.mjs';
const catalog={100:{id:100,name:'A',kind:'other',value:0,category:'trap'},200:{id:200,name:'B',kind:'other',value:0,category:'spell'},300:{id:300,name:'C',kind:'other',value:0,category:'monster'}};
const ref=o=>({get:k=>{if(['dataint','cardId','m_Mrk','uniqueId'].includes(k))throw Error('hidden identity read');return o[k];}});
const action=(code,from,to,sourceBits=1)=>ref({datal:ref({datatype:1,databyte0:from,databyte1:1,boolbits:sourceBits}),datac:ref({datatype:3,databyte1:code}),datar:ref({datatype:to===null?0:1,databyte0:to,databyte1:1,boolbits:1})});
const set={key:'10:0',index:10,type:'leave',slot:9};
const reveal={key:'12:0:field',index:12,type:'fieldReveal',slot:9,cardId:100};
const view=(events,count)=>publicHand({...scene(),logLength:100,counts:{...scene().counts,opponentHand:count},publicHandEvents:events});
const update=(t,len,count,visible,changes,slots)=>t.update('a',len,count,visible,changes,0,true,slots,catalog);

test('field spells cannot be inferred into backrow and remain in hand after another card is set',()=>{
 const t=new PublicHandTracker();
 const cards={...catalog,200:{...catalog[200],fieldSpell:true}};
 t.update('a',10,2,[100,200],[],0,true,[],cards);
 const events=t.update('a',11,1,[],[set],0,true,[9],cards);
 assert.deepEqual(t.setCards()[0].candidates,[100]);
 assert.equal(t.setCards()[0].confirmedId,100);
 assert.deepEqual(view(events,1).cards,[{id:200,count:1}]);
});
test('set count reads opponent face flags only, excludes face-up cards, monsters and own cards',()=>{
 const card=(slot,team,face)=>ref({team,isFace:face,cardLocator:ref({cardPlace:ref({position:slot})})});
 assert.deepEqual(facedownBackrow([card(9,1,false),card(9,1,false),card(12,1,false),card(8,1,true),card(2,1,false),card(7,0,false)],0),[9]);
 assert.deepEqual(faceupBackrow([card(8,1,true),card(12,1,true),card(9,1,false),card(7,0,true)],0),[8]);
 assert.throws(()=>facedownBackrow([card(8,1,undefined)],0),/待确认/);
});
test('recorded set and activation metadata links a slot without reading hidden identities',()=>{
 assert.deepEqual(handChange(action(14,13,9),10,0,0),[set]);
 assert.deepEqual(handChange(action(11,9,null,5),12,0,0,{get:k=>k==='cardid'?100:undefined}),[reveal]);
 assert.equal(handChange(action(11,9,null,1),12,0,0)[0].type,'fieldLeave');
});
test('ambiguous set becomes exact when activated, removes old hand record only once and restores other card',()=>{
 const t=new PublicHandTracker();update(t,10,2,[100,200],[],[]);
 let events=update(t,11,1,[],[set],[9]);
 assert.deepEqual(t.setCards()[0].candidates,[100,200]);assert.equal(t.setCards()[0].confirmedId,undefined);
 assert.equal(view(events,1).uncertainCards.length,2);
 events=update(t,13,1,[],[set,reveal],[]);
 assert.deepEqual(view(events,1).cards,[{id:200,count:1}]);assert.deepEqual(view(events,1).uncertainCards,[]);assert.deepEqual(t.setCards(),[]);
 assert.deepEqual(update(t,13,1,[],[set,reveal],[]),events);
});
test('single possible name is inferred only from complete hand evidence; unknown cards and monsters prevent certainty',()=>{
 for(const [cards,count,confirmed] of [[[100],1,100],[[100,100],2,100],[[100],2,undefined],[[100,300],2,undefined]]){
  const t=new PublicHandTracker();update(t,10,count,cards,[],[]);update(t,11,count-1,[],[set],[9]);
  assert.equal(t.setCards()[0].confirmedId,confirmed);
 }
});
test('redisclosed hand is not decremented by a later activation of an earlier set',()=>{
 const t=new PublicHandTracker();update(t,10,2,[100,100],[],[]);update(t,11,1,[100],[set],[9]);
 assert.deepEqual(view(update(t,13,1,[],[set,reveal],[]),1).cards,[{id:100,count:1}]);
});
test('multiple sets keep separate origins, slot reuse and new sessions never reuse old identities',()=>{
 const t=new PublicHandTracker();update(t,10,3,[100,100,200],[],[]);
 const second={key:'11:0',index:11,type:'leave',slot:8};
 update(t,12,1,[],[set,second],[8,9]);assert.equal(t.setCards().length,2);
 let events=update(t,13,1,[],[set,second,reveal],[8]);assert.equal(t.setCards().length,1);
 const r2={...reveal,key:'13:0:field',index:13,slot:8};events=update(t,14,1,[],[set,second,reveal,r2],[]);
 assert.deepEqual(view(events,1).cards,[{id:200,count:1}]);
 update(t,15,1,[],[set,second,reveal,r2],[9]);assert.deepEqual(t.setCards()[0].candidates,[]);
 t.update('new',10,1,[],[],0,true,[],catalog);assert.deepEqual(t.setCards(),[]);
});
test('mid-duel startup and log discontinuity cannot infer existing set identities',()=>{
 const t=new PublicHandTracker();update(t,11,1,[100],[set],[9]);assert.deepEqual(t.setCards()[0].candidates,[]);
 update(t,2,1,[],[],[9]);assert.equal(t.setCards()[0].confirmedId,undefined);
});

test('revealing the first of two sets narrows the second without duplicating the used name',()=>{
 const t=new PublicHandTracker();update(t,10,3,[100,200,300],[],[]);
 const second={key:'11:0',index:11,type:'leave',slot:8};
 update(t,12,1,[],[set,second],[8,9]);
 update(t,13,1,[],[set,second,reveal],[8]);
 assert.deepEqual(t.setCards()[0].candidates,[200]);
 assert.equal(t.setCards()[0].unknownPossible,true); // Monster placement effects are not ruled out.
});

test('recorded hidden set destruction to public graveyard resolves original hand identity',()=>{
 // Recorded row128: action21, source10/bits1 -> grave16/bits5; public row127=12974.
 const destroyed=ref({datal:ref({datatype:1,databyte0:10,databyte1:1,boolbits:1}),datac:ref({datatype:3,databyte1:21}),datar:ref({datatype:1,databyte0:16,databyte1:1,boolbits:5})});
 const changes=handChange(destroyed,128,0,0,{get:k=>k==='cardid'?12974:undefined});
 assert.deepEqual(changes,[{key:'128:0:field',index:128,type:'fieldReveal',slot:10,cardId:12974}]);
 const t=new PublicHandTracker(),set10={...set,slot:10};
 const cards={...catalog,12974:{...catalog[100],id:12974}};
 const step=(len,count,visible,changes,slots)=>t.update('a',len,count,visible,changes,0,true,slots,cards);
 step(10,2,[12974,200],[],[]);step(11,1,[],[set10],[10]);
 const events=step(129,1,[],[set10,...changes],[]);
 const v=publicHand({...scene(),logLength:129,counts:{...scene().counts,opponentHand:1},publicHandEvents:events});
 assert.deepEqual(v.cards,[{id:200,count:1}]);assert.deepEqual(v.uncertainCards,[]);assert.deepEqual(t.setCards(),[]);
});

test('hidden banishment removes a set slot but cannot read or infer its destroyed identity',()=>{
 const move=ref({datal:ref({datatype:1,databyte0:9,databyte1:1,boolbits:1}),datac:ref({datatype:3,databyte1:18}),datar:ref({datatype:1,databyte0:17,databyte1:1,boolbits:9})});
 const changes=handChange(move,12,0,0);
 const t=new PublicHandTracker();update(t,10,2,[100,200],[],[]);update(t,11,1,[],[set],[9]);
 const events=update(t,13,1,[],[set,...changes],[]);assert.deepEqual(t.setCards(),[]);assert.equal(view(events,1).uncertainCards.length,2);
});

test('public search records its name without reading deck operands, hidden search and draw do not',()=>{
 const searched=handChange(action(26,15,13,9),10,0,0,{get:k=>k==='cardid'?100:undefined});
 assert.deepEqual(searched,[{key:'10:0',index:10,type:'enter',cardId:100,source:'search'}]);
 assert.equal(handChange(action(26,15,13,9),10,0,0)[0].cardId,undefined);
 assert.equal(handChange(action(1,13,null,9),10,0,0,{get:()=>{throw Error('hidden draw');}})[0].cardId,undefined);
});

test('single searched card can have a definite set position only when other identities are excluded',()=>{
 for(const initial of [0,2]){
  const t=new PublicHandTracker();update(t,10,initial,[],[],[]);
  const search={key:'10:0',index:10,type:'enter',cardId:100,source:'search'},setAfter={...set,key:'11:0',index:11};
  update(t,12,initial,[],[search,setAfter],[9]);
  assert.deepEqual(t.setCards()[0].searchedCandidates,[100]);
  assert.equal(t.setCards()[0].confirmedId,initial===0?100:undefined);
 }
});

test('multiple public searches followed by sets list all remaining candidates per location',()=>{
 const t=new PublicHandTracker();update(t,10,0,[],[],[]);
 const changes=[{key:'10:0',index:10,type:'enter',cardId:100,source:'search'},{key:'11:0',index:11,type:'enter',cardId:200,source:'search'},{...set,key:'12:0',index:12},{...set,key:'13:0',index:13,slot:10}];
 update(t,14,0,[],changes,[9,10]);
 assert.equal(t.setCards().length,2);
 for(const entry of t.setCards()){assert.deepEqual(entry.candidates,[100,200]);assert.deepEqual(entry.searchedCandidates,[100,200]);assert.equal(entry.confirmedId,undefined);assert.equal(entry.unknownPossible,false);}
 const destroyed={key:'14:0:field',index:14,type:'fieldReveal',slot:9,cardId:100};
 update(t,15,0,[],[...changes,destroyed],[10]);
 assert.deepEqual(t.setCards()[0].candidates,[200]);assert.equal(t.setCards()[0].confirmedId,200);
});

test('an explicitly named public set keeps its identity through later inference updates',()=>{
 const t=new PublicHandTracker();update(t,10,3,[],[],[]);
 const first={...set,cardId:100},second={...set,key:'11:0',index:11,slot:10};
 update(t,12,1,[],[first,second],[9,10]);
 assert.deepEqual(t.setCards()[0].candidates,[100]);assert.equal(t.setCards()[0].publicId,100);
 update(t,13,1,[],[first,second,{...reveal,slot:10,cardId:200}],[9]);
 assert.equal(t.setCards()[0].confirmedId,100);assert.equal(t.setCards()[0].unknownPossible,false);
});

test('replay deck set followed by public confirmation keeps its slot and leaves hand unchanged',()=>{
 const changes=[...handChange(action(13,15,8),92,0,0),...handChange(action(17,8,null,13),94,0,0,{get:k=>k==='cardid'?22581:undefined})];
 assert.deepEqual(changes,[{key:'92:0:set',index:92,type:'fieldSet',slot:8},{key:'94:0:field',index:94,type:'fieldConfirm',slot:8,cardId:22581}]);
 for(const fresh of [false,true]){
  const t=new PublicHandTracker();
  if(!fresh)update(t,92,1,[200],[],[]);
  const events=update(t,96,1,[],changes,[8]);
  assert.equal(t.setCards()[0].confirmedId,22581);
  assert.deepEqual(t.setCards()[0].candidates,[22581]);
  if(!fresh)assert.deepEqual(view(events,1).cards,[{id:200,count:1}]);
  assert.deepEqual(update(t,96,1,[],changes,[8]),events);
  const gone=handChange(action(21,8,16),96,0,0,{get:k=>k==='cardid'?22581:undefined});
  update(t,97,1,[],[...changes,...gone],[]);assert.deepEqual(t.setCards(),[]);
  update(t,96,1,[],changes,[8]);assert.equal(t.setCards()[0].confirmedId,22581);
  update(t,93,1,[],changes.slice(0,1),[8]);assert.deepEqual(t.setCards()[0].candidates,[]);
 }
});

test('field confirmation resolves an earlier anonymous hand set without removing the set',()=>{
 const t=new PublicHandTracker();update(t,10,2,[100,200],[],[]);
 update(t,11,1,[],[set],[9]);
 const confirm={key:'12:0:field',index:12,type:'fieldConfirm',slot:9,cardId:100};
 const events=update(t,13,1,[],[set,confirm],[9]);
 assert.equal(t.setCards()[0].confirmedId,100);
 assert.deepEqual(view(events,1).cards,[{id:200,count:1}]);
});

test('direct sets without public names stay unknown and old confirmed slots cannot survive reuse',()=>{
 const t=new PublicHandTracker();
 const confirm={key:'1:0:field',index:1,type:'fieldConfirm',slot:8,cardId:100};
 const gone={key:'2:0:field',index:2,type:'fieldLeave',slot:8};
 const hidden=handChange(action(13,15,8),3,0,0);
 update(t,4,1,[],[confirm,gone,...hidden],[8]);
 assert.deepEqual(t.setCards(),[{slot:8,candidates:[],unknownPossible:true}]);
 assert.deepEqual(handChange(action(17,8,null),4,0,0),[]);
});

test('public set identity recovers after a hand count/log animation race without a new log event',()=>{
 const t=new PublicHandTracker();update(t,30,4,[],[],[]);
 const leave={key:'30:0',index:30,type:'leave',cardId:300};
 const set={key:'34:0:set',index:34,type:'fieldSet',slot:10};
 const confirm={key:'36:0:field',index:36,type:'fieldConfirm',slot:10,cardId:20531};
 const changes=[leave,set,confirm];
 t.update('a',43,4,[],changes,0,false,[10],catalog);
 // The count catches up with an already consumed departure.
 update(t,43,3,[],changes,[10]);
 assert.equal(t.setCards()[0].confirmedId,20531);
 assert.equal(t.setCards()[0].unknownPossible,false);
 update(t,43,3,[],changes,[10]);assert.equal(t.setCards()[0].confirmedId,20531);
 const reuse=[...changes,{key:'43:f',index:43,type:'fieldLeave',slot:10},{key:'44:s',index:44,type:'fieldSet',slot:10}];
 update(t,45,3,[],reuse,[10]);assert.deepEqual(t.setCards()[0].candidates,[]);
});

test('unmapped set relocation is marked changed and keeps only possible public names',()=>{
 const t=new PublicHandTracker();
 const confirmed={key:'1:f',index:1,type:'fieldConfirm',slot:9,cardId:100};
 update(t,2,1,[],[confirmed],[9]);
 update(t,2,1,[],[confirmed],[10]);
 assert.equal(t.setCards()[0].positionChanged,true);
 assert.equal(t.setCards()[0].confirmedId,undefined);
 assert.deepEqual(t.setCards()[0].candidates,[100]);
 update(t,2,1,[],[confirmed],[10]);assert.equal(t.setCards()[0].positionChanged,true);
 const reconfirm={key:'2:f',index:2,type:'fieldConfirm',slot:10,cardId:100};
 update(t,3,1,[],[confirmed,reconfirm],[10]);
 assert.equal(t.setCards()[0].confirmedId,100);assert.equal(t.setCards()[0].positionChanged,undefined);
});

test('long turn hand-to-grave action50 and hand-only uncertainty never erase an unrelated set',()=>{
 const departed=handChange(action(50,13,16),192,0,0,{get:k=>k==='cardid'?20500:undefined});
 assert.deepEqual(departed,[{key:'192:0',index:192,type:'leave',cardId:20500}]);
 const unknown=handChange(action(99,13,16),193,0,0);
 assert.equal(unknown[0].scope,'hand');
 const set={key:'149:0:set',index:149,type:'fieldSet',slot:10,cardId:20237};
 for(const fresh of [true,false]){
  const t=new PublicHandTracker();
  if(!fresh)update(t,150,3,[],[set],[10]);
  update(t,194,2,[],[set,...departed,...unknown],[10]);
  assert.equal(t.setCards()[0].confirmedId,20237);
  update(t,195,1,[],[set,...departed,...unknown],[10]);
  assert.equal(t.setCards()[0].confirmedId,20237);
 }
});
