import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validateConfig,updateDisplayConfig} from '../dist/desktop/config.js';
import {defaultSidebarModules} from '../dist/domain/modules.js';
import {renderSidebar} from '../dist/ui/sidebar.js';
import {DuelStore} from '../dist/domain/store.js';
test('legacy configuration preserves sidebar modules and enables the information window',()=>{
 const c=validateConfig(defaults());assert.deepEqual(c.sidebarModules,defaultSidebarModules);assert.equal(c.infoOverlayEnabled,true);
 for(const bad of [{sidebarModules:['hand','hand']},{sidebarModules:['bad']},{infoOverlayEnabled:'yes'}])assert.throws(()=>validateConfig({...c,...bad}));
});
test('sidebar and floating selections retain independent activation order and survive persistence',()=>{
 let c=validateConfig({...defaults(),sidebarModules:[],selectedModules:['plans','hand']});
 for(const id of ['backrow','summary','hand'])c=updateDisplayConfig(c,{target:'sidebar',id,enabled:true});
 c=updateDisplayConfig(c,{target:'sidebar',id:'summary',enabled:false});
 c=updateDisplayConfig(c,{target:'sidebar',id:'summary',enabled:true});
 assert.deepEqual(c.sidebarModules,['backrow','hand','summary']);assert.deepEqual(c.selectedModules,['plans','hand']);
 c=updateDisplayConfig(c,{target:'sidebar',id:'hand',enabled:true});assert.deepEqual(c.sidebarModules,['backrow','hand','summary']);
 c=updateDisplayConfig(c,{target:'info',id:'plans',enabled:false});c=updateDisplayConfig(c,{target:'info',id:'plans',enabled:true});
 assert.deepEqual(c.selectedModules,['hand','plans']);assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(c))),c);
});
test('information window master switch preserves choices and card position switches',()=>{
 const c=validateConfig({...defaults(),selectedModules:['plans','summary']});
 const off=updateDisplayConfig(c,{target:'infoOverlayEnabled',enabled:false});
 assert.deepEqual(off.selectedModules,c.selectedModules);assert.deepEqual(off.sidebarModules,c.sidebarModules);assert.equal(off.handOverlayEnabled,c.handOverlayEnabled);
 assert.deepEqual(updateDisplayConfig(off,{target:'infoOverlayEnabled',enabled:true}),c);
 for(const bad of [{target:'width',enabled:true},{target:'sidebar',id:'bad',enabled:true},{target:'info',id:'hand',enabled:'yes'}])assert.throws(()=>updateDisplayConfig(c,bad));
});
test('sidebar renders only selected modules in activation order without adjustment controls',()=>{
 const view={...new DuelStore().view(),config:validateConfig(defaults())};
 const html=renderSidebar(view,['banished','summary','hand']);
 assert.ok(html.indexOf('banished-stock')<html.indexOf('scene-summary'));assert.ok(html.indexOf('scene-summary')<html.indexOf('id="public-hand"'));
 assert.ok(!html.includes('id="plans"'));assert.ok(!html.includes('id="opponent-backrow"'));assert.ok(!html.includes('data-action='));
 assert.equal(renderSidebar(view,[]),'');assert.ok(renderSidebar(view).includes('id="opponent-backrow"'));
});

test('field overlay switches do not change information window content or sidebar order',()=>{
 const c=validateConfig({...defaults(),selectedModules:['summary','hand'],sidebarModules:['backrow','summary']});
 const next=updateDisplayConfig(updateDisplayConfig(c,{target:'handOverlayEnabled',enabled:false}),{target:'backrowOverlayEnabled',enabled:false});
 assert.equal(next.handOverlayEnabled,false);assert.equal(next.backrowOverlayEnabled,false);
 assert.deepEqual(next.selectedModules,c.selectedModules);assert.deepEqual(next.sidebarModules,c.sidebarModules);assert.equal(next.infoOverlayEnabled,true);
});
