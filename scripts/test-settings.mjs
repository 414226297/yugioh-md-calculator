import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
const env={...process.env,MD_TEST_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env,timeout:15000});
try{
 const main=await app.firstWindow();await main.waitForLoadState('domcontentloaded');
 await main.evaluate(async()=>{await window.cannon.command('display',{target:'sidebar',id:'hand',enabled:true});});
 await app.evaluate(({ipcMain})=>ipcMain._invokeHandlers.get('test:tray')({},'show'));
 let settings;for(let i=0;i<40;i++){settings=(await app.windows()).find(p=>p.url().includes('window=settings'));if(settings)break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(await main.locator('#settings').count(),0);assert.equal(await main.locator('button#deck-status').count(),0);
 assert.ok(settings);await settings.locator('#sidebar-settings').waitFor();
 assert.equal(await main.locator('#config-form').count(),0);
 assert.equal(await settings.locator('#sidebar-settings [data-display="sidebar"]').count(),5);
 assert.equal(await settings.locator('#hand-settings [data-display="handOverlayEnabled"]').count(),1);
 assert.equal(await settings.locator('#backrow-settings [data-display="backrowOverlayEnabled"]').count(),1);
 const fields=await settings.locator('#config-form').evaluate(form=>Object.keys(Object.fromEntries(new FormData(form))));
 assert.deepEqual(fields.sort(),['height','interval','launchUntapped','modulePath','overlayOffsetX','overlayOffsetY','readerBackend','theme','unityVersion','width'].sort());
 await settings.screenshot({path:'test-results/settings-grouped.png'});
 await settings.locator('#hand-overlay-style').selectOption('label');
 await main.waitForFunction(async()=>(await window.cannon.getState()).config.handOverlayStyle==='label');
 await settings.locator('#hand-overlay-style').selectOption('thumbnail');
 await main.waitForFunction(async()=>(await window.cannon.getState()).config.handOverlayStyle==='thumbnail');
 const hand=settings.locator('[data-display="sidebar"][data-module="hand"]');
 await hand.uncheck();await main.locator('#public-hand').waitFor({state:'detached'});
 await hand.check();await main.locator('#public-hand').waitFor();
 assert.equal(await main.evaluate(async()=>{const s=await window.cannon.getState();return s.config.sidebarModules.at(-1);}), 'hand');
 await settings.evaluate(async()=>{
  for(const id of (await window.cannon.getState()).config.sidebarModules)await window.cannon.command('display',{target:'sidebar',id,enabled:false});
 });
 await main.waitForFunction(async()=>(await window.cannon.getState()).config.sidebarModules.length===0);
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html')&&!w.webContents.getURL().includes('window=settings')).isVisible()),false);
 await hand.check();await main.locator('#public-hand').waitFor();
 await main.waitForFunction(()=>innerHeight<480);
 await settings.locator('.advanced-settings summary').click();
 await settings.locator('#interval').fill('750');
 await settings.locator('[data-display="infoOverlayEnabled"]').uncheck();
 assert.equal(await settings.locator('#interval').inputValue(),'750');
 await settings.getByRole('button',{name:'保存设置',exact:true}).click();
 await main.waitForFunction(async()=>(await window.cannon.getState()).config.interval===750);
 const state=await main.evaluate(()=>window.cannon.getState());assert.equal(state.config.infoOverlayEnabled,false);
 await app.evaluate(({ipcMain})=>ipcMain._invokeHandlers.get('test:tray')({},'show'));assert.equal((await app.windows()).filter(p=>p.url().includes('window=settings')).length,1);
 await settings.locator('[data-action="counts"]').click();await settings.locator('#counts-form').waitFor();
 await settings.locator('#close').click();await app.evaluate(({ipcMain})=>ipcMain._invokeHandlers.get('test:tray')({},'show'));
 await settings.locator('[data-action="settings"]').click();
 await settings.locator('#sidebar-settings').waitFor();
 console.log('PASS independent settings window, module switches, sidebar ordering, draft preservation and reopening');
}finally{await app.close();}
