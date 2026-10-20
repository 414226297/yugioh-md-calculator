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
