import test from 'node:test';
import assert from 'node:assert/strict';
import {deckTopOverlayBounds,deckTopThumbnailGeometry,deckTopOverlayRegions} from '../dist/domain/overlay-layout.js';

test('top thumbnail follows opponent main deck at different viewport sizes and origins',()=>{
 const base=deckTopOverlayBounds({x:0,y:0,width:1366,height:768});
 assert.ok(Math.abs(base.x+base.width/2-326)<=.5);
 assert.ok(Math.abs(base.y+base.height/2-39)<=.5);
 assert.ok(base.width<75&&base.height<85&&base.y>=0);
 const half=deckTopOverlayBounds({x:-100,y:90,width:683,height:384});
 for(const key of ['width','height'])assert.ok(Math.abs(half[key]-base[key]/2)<=1);
 assert.ok(Math.abs(half.x-(-100+base.x/2))<=1);
 assert.ok(Math.abs(half.y-(90+base.y/2))<=1);
 const wide=deckTopOverlayBounds({x:-200,y:50,width:1800,height:768});
 assert.equal(wide.x,base.x+17);assert.equal(wide.y,base.y+50);
 assert.equal(deckTopOverlayBounds({x:0,y:0,width:0,height:768}),null);
 assert.equal(deckTopOverlayBounds({x:NaN,y:0,width:1366,height:768}),null);
});

test('paint and native hit region share the tilted footprint, leaving transparent corners free',()=>{
 for(const [width,height] of [[65,75],[33,38],[98,113]]){
  const {polygon}=deckTopThumbnailGeometry(width,height),regions=deckTopOverlayRegions(width,height);
  assert.ok(polygon[0].x<polygon[3].x,'top edge leans left');
  assert.ok(polygon[1].y<polygon[0].y,'top edge slopes with deck zone');
  assert.ok(polygon.every(p=>p.x>=-1e-8&&p.x<=width+1e-8&&p.y>=-1e-8&&p.y<=height+1e-8));
  const hit=(x,y)=>regions.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
  assert.ok(hit(width/2,height/2));
  for(const [x,y] of [[0,0],[width-1,0],[0,height-1],[width-1,height-1]])assert.equal(hit(x,y),false);
  assert.ok(regions.every(r=>r.x>=0&&r.y>=0&&r.width>0&&r.height>0&&r.x+r.width<=width&&r.y+r.height<=height));
  const area=regions.reduce((n,r)=>n+r.width*r.height,0);
  assert.ok(area<width*height*.8&&area>width*height*.5);
 }
 assert.deepEqual(deckTopOverlayRegions(0,75),[]);
});
