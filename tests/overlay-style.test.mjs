import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validateConfig} from '../dist/desktop/config.js';
import {handOverlayBounds,overlayBounds,confirmedOverlayCardId} from '../dist/domain/overlay-layout.js';
test('hand style defaults to current thumbnails and persists either choice',()=>{
 assert.equal(validateConfig(defaults()).handOverlayStyle,'thumbnail');
 for(const handOverlayStyle of ['label','thumbnail']){
  const c=validateConfig({...defaults(),handOverlayStyle});
  assert.equal(validateConfig(JSON.parse(JSON.stringify(c))).handOverlayStyle,handOverlayStyle);
 }
 for(const handOverlayStyle of ['bad',null,1])assert.throws(()=>validateConfig({...defaults(),handOverlayStyle}));
});
test('hand label mode restores compact height without changing hand position',()=>{
 const client={x:0,y:0,width:1366,height:768};
 const label=handOverlayBounds(client,0,5,'label'),thumb=handOverlayBounds(client,0,5,'thumbnail');
 assert.equal(label.height,22);assert.equal(thumb.height,67);
 for(const k of ['x','y','width'])assert.equal(label[k],thumb[k]);
});
test('known set card thumbnail applies screenshot alignment correction and scales with viewport',()=>{
 const client={x:0,y:0,width:1360,height:765};
 const label=overlayBounds(client,9),thumb=overlayBounds(client,9,0,0,true);
 assert.equal(thumb.width,label.width);assert.equal(thumb.x-label.x,8);assert.ok(Math.abs(thumb.y+thumb.height-label.y-label.height-10)<=1);
 assert.ok(Math.abs(thumb.height/thumb.width-1.46)<.02);
 const smaller=overlayBounds({x:100,y:200,width:680,height:382.5},9,0,0,true);
 assert.ok(Math.abs(smaller.y-200-thumb.y/2)<=1);assert.ok(Math.abs(smaller.height-thumb.height/2)<=1);
});
test('only definite set identities qualify as confirmed, never candidates or changed positions',()=>{
 const card={slot:9,candidates:[123],confirmedId:123,unknownPossible:false};
 assert.equal(confirmedOverlayCardId(card,false),123);
 assert.equal(confirmedOverlayCardId(card,true),undefined);
 assert.equal(confirmedOverlayCardId({...card,positionChanged:true},false),undefined);
 assert.equal(confirmedOverlayCardId({...card,unknownPossible:true},false),undefined);
 assert.equal(confirmedOverlayCardId({...card,confirmedId:undefined},false),undefined);
});

import {backrowOverlayPreview} from '../dist/domain/overlay-layout.js';
test('single public candidate is previewed as possible without confirming hidden identity',()=>{
 const card={slot:9,candidates:[123],unknownPossible:true};
 assert.deepEqual(backrowOverlayPreview(card,false),{id:123,possible:true});
 assert.deepEqual(backrowOverlayPreview({...card,positionChanged:true},true),{id:123,possible:true});
 assert.deepEqual(backrowOverlayPreview({...card,candidates:[]},false),{possible:false});
 assert.deepEqual(backrowOverlayPreview({...card,candidates:[123,456]},false),{possible:false});
 assert.deepEqual(backrowOverlayPreview({...card,confirmedId:123,unknownPossible:false},false),{id:123,possible:false});
 assert.equal(card.confirmedId,undefined);
});
