import test from 'node:test';
import assert from 'node:assert/strict';
import {overlayBounds,overlayDetailBounds} from '../dist/domain/overlay-layout.js';
test('labels stay inside approved card backs and preserve viewport-relative position on move/scale',()=>{
 const client={x:0,y:0,width:1360,height:765};
 for(const [slot,left,right] of [[10,529,591],[9,644,706]]){
  const box=overlayBounds(client,slot);assert.ok(box.x>=left&&box.x+box.width<=right);assert.ok(box.y>=80&&box.y+box.height<=155);
  const smaller=overlayBounds({x:100,y:200,width:680,height:382.5},slot);
  assert.ok(Math.abs(smaller.x-(100+box.x/2))<=1);assert.ok(Math.abs(smaller.y-(200+box.y/2))<=1);
 }
 assert.equal(overlayBounds(client,12),null);
 assert.equal(overlayBounds({...client,width:0},10),null);
 const wide=overlayBounds({x:-200,y:50,width:1800,height:765},9);
 const base=overlayBounds(client,9);assert.equal(wide.x,base.x+20);assert.equal(wide.y,base.y+50);
 for(const bounds of [client,{x:-300,y:120,width:680,height:382.5}]){
  const detail=overlayDetailBounds(bounds);
  assert.ok(Math.abs(detail.x-(bounds.x+bounds.width*18/1366))<=1);
  assert.ok(Math.abs(detail.y-(bounds.y+bounds.height*100/768))<=1);
  assert.ok(Math.abs(detail.height-bounds.height*512/768)<=1);
  assert.ok(detail.y+detail.height<=bounds.y+bounds.height*.81,'above avatar and LP');
 }
});

import {handOverlayBounds} from '../dist/domain/overlay-layout.js';
test('known hand labels use total hand count for leftmost card spacing and scale with viewport',()=>{
 const client={x:0,y:0,width:1366,height:768};
 const a=handOverlayBounds(client,0,5),b=handOverlayBounds(client,1,5);
 assert.equal(b.x-a.x,80);assert.equal(a.x+a.width/2,523);
 assert.equal(a.y+a.height,57);
 assert.equal(handOverlayBounds(client,0,2).x+23,643);
 assert.ok(handOverlayBounds(client,0,6).y<handOverlayBounds(client,2,6).y);
 for(const count of [1,2,3,4,5,6,10,20]){
  const boxes=Array.from({length:count},(_,i)=>handOverlayBounds(client,i,count));
  assert.ok(boxes.every((b,i)=>b.width>0&&b.x>=0&&b.x+b.width<=1366&&(!i||b.x>=boxes[i-1].x+boxes[i-1].width)));
 }
 const small=handOverlayBounds({x:-50,y:100,width:683,height:384},0,5);
 assert.ok(Math.abs(small.x-(-50+a.x/2))<=1);assert.ok(Math.abs(small.y-(100+a.y/2))<=1);
 assert.equal(handOverlayBounds(client,2,2),null);assert.equal(handOverlayBounds(client,0,0),null);
});
