import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
const env={...process.env,MD_TEST_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;
let app;
const launch=async()=>{app=await electron.launch({args:['.'],env,timeout:15000});const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');return page;};
const visible=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='MD助手 · 信息侧栏')?.isVisible());
try{
 let page=await launch();
 await page.evaluate(async()=>{const s=await window.cannon.getState();for(const id of s.config.sidebarModules)await window.cannon.command('display',{target:'sidebar',id,enabled:false});});
 assert.equal(await visible(),false);
 await app.close();app=null;
 page=await launch();assert.deepEqual((await page.evaluate(()=>window.cannon.getState())).config.sidebarModules,[]);assert.equal(await visible(),false);
 await page.evaluate(()=>window.cannon.command('display',{target:'sidebar',id:'hand',enabled:true}));
 for(let i=0;i<40&&!(await visible());i++)await new Promise(r=>setTimeout(r,50));
 assert.equal(await visible(),true);assert.equal(await page.locator('#public-hand').count(),1);
 console.log('PASS sidebar restores visibility after restart with all modules disabled');
}finally{if(app)await app.close();}
