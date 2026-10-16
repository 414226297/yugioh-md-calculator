import test from 'node:test';import assert from 'node:assert/strict';
import {decodeAction,list,readActions,cardId} from '../dist/reader/native-reader.js';
import {parseCatalog} from '../dist/data/catalog.js';
const ref=o=>({get:k=>o[k]});const lst=a=>ref({_size:a.length,_items:{at:i=>a[i]}});
const action=(id,player=0,action=18)=>ref({datal:ref({datatype:1,databyte0:14,databyte1:player,dataint:id}),datac:ref({datatype:3,databyte1:action}),datar:ref({datatype:1,databyte0:17,databyte1:player})});
test('card identifiers are not constrained by quantity bounds',()=>{assert.equal(cardId(19921),19921);assert.throws(()=>cardId(-1));});
test('reader decodes public own movements; opposing hidden identities are excluded',()=>{
 assert.equal(decodeAction(action(9612),65,0,0,19921).cardId,9612);
 assert.equal(decodeAction(action(9612),65,0,0,19921).face,'up');
 assert.equal(decodeAction(action(9612),65,0,0,0).face,'unknown');
 assert.equal(decodeAction(action(1234,1),65,0,0,0),null);
});
test('selection event retains action identity so inventory can ignore it',()=>assert.equal(decodeAction(action(9612,0,23),3,0,0,0).action,23));
test('bounded native lists reject corrupt lengths instead of reading arbitrary entries',()=>assert.throws(()=>list(ref({_size:100000})),/长度/));
test('catalog distinguishes rank and level and rejects malformed inputs',()=>{
 const c=parseCatalog([{id:1,name:'X',kind:23,level:4},{id:2,name:'F',kind:3,level:1}]);
 assert.equal(c[1].kind,'xyz');assert.equal(c[2].kind,'fusion');
 assert.throws(()=>parseCatalog([{id:1,name:'F',kind:3,level:-1}]));
 assert.deepEqual(parseCatalog([{id:0,name:'',kind:0,level:0}]),{});
 assert.throws(()=>parseCatalog([{id:0,name:'bad',kind:3,level:1}]));
});
test('chain context confirms cannon banish only during that resolving effect',()=>{
 const base=[ref({loglabel:'ShowChain',dataindex:0}),ref({loglabel:'ShowAction',dataindex:0}),ref({loglabel:'ShowChain',dataindex:1}),ref({loglabel:'ShowAction',dataindex:1})];
 const log=ref({m_LogBaseItemList:lst(base),m_DataList_ShowAction:lst([action(9612),action(10942)]),m_DataList_MoveMulti:lst([]),m_DataList_ShowChain:lst([ref({type:1,cardid:19921}),ref({type:3,cardid:0})])});
 const r=readActions(log,0);assert.equal(r.moves[0].face,'up');assert.equal(r.moves[1].face,'unknown');assert.equal(r.completeLog,false);
});
