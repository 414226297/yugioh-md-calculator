import test from 'node:test';
import assert from 'node:assert/strict';
import {validateModules} from '../dist/domain/modules.js';
import {moduleOverlayBounds} from '../dist/domain/overlay-layout.js';
import {defaults,validateConfig} from '../dist/desktop/config.js';
import {renderSidebar} from '../dist/ui/sidebar.js';
import {DuelStore} from '../dist/domain/store.js';
import {deck,catalog,scene} from './fixtures/scenes.mjs';
test('module selection retains click order, accepts empty and rejects unknown/duplicate entries',()=>{
 assert.deepEqual(validateModules(['plans','summary','hand']),['plans','summary','hand']);
 assert.deepEqual(validateConfig(defaults()).selectedModules,[]);
 assert.deepEqual(validateConfig({...defaults(),selectedModules:['backrow','hand']}).selectedModules,['backrow','hand']);
 for(const value of [null,'hand',['hand','hand'],['bad']])assert.throws(()=>validateModules(value));
});
test('module panel stays anchored above avatar inside letterboxed game area',()=>{
 const base=moduleOverlayBounds({x:0,y:0,width:1366,height:768});
 assert.ok(base.width<=280);assert.ok(base.height<=768*.67);assert.ok(base.y+base.height<768*.87);
 const wide=moduleOverlayBounds({x:-1000,y:50,width:1800,height:768});
 assert.ok(Math.abs(wide.x-(base.x-1000+(1800-1366)/2))<=1);
 const large=moduleOverlayBounds({x:0,y:0,width:2732,height:1536});
 assert.ok(Math.abs(large.width-base.width*2)<=1);
});
test('shared sidebar rendering retains solver data, stock groups and unconfirmed public information',()=>{
 const store=new DuelStore();store.deck=deck;store.catalog=catalog;store.accept(scene());store.confirmDeck();
 const view={...store.view(),config:validateConfig(defaults())};
 const html=renderSidebar(view);
 for(const selector of ['scene-summary','id="plans"','banished-stock','id="public-hand"','id="opponent-backrow"'])assert.ok(html.includes(selector));
 assert.match(html,/id="total">9</);assert.match(html,/方案 1/);assert.match(html,/暂无已确认卡片/);
 view.publicHand={...view.publicHand,reason:'<script>private</script>',cards:[],uncertainCards:[{id:9612,count:1}]};
 const uncertain=renderSidebar(view);assert.match(uncertain,/最多 ×1/);assert.ok(!uncertain.includes('<script>'));assert.match(uncertain,/&lt;script&gt;/);
 view.result={...view.result,status:'uncertain',reason:'正在结算',plans:[]};
 const busy=renderSidebar(view);assert.match(busy,/正在结算/);assert.ok(!busy.includes('方案 1'));
});
