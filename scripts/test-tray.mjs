import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
const env={...process.env,MD_TEST_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
let exited=false;
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 const state=()=>app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='MD助手');return {exists:!!w,visible:w?.isVisible(),minimized:w?.isMinimized()};});
 const action=id=>app.evaluate(({ipcMain},id)=>ipcMain._invokeHandlers.get('test:tray')({},id),id);
 await page.locator('#close').click();assert.deepEqual(await state(),{exists:true,visible:false,minimized:false});
 await action('show');assert.equal((await state()).visible,true);
 await page.locator('#minimize').click();await page.waitForTimeout(150);assert.equal((await state()).visible,false);
 await action('show');assert.deepEqual(await state(),{exists:true,visible:true,minimized:false});
 await action('hide');assert.equal((await state()).visible,false);
 const closed=app.waitForEvent('close');await action('quit').catch(()=>{});await closed;exited=true;
 console.log('PASS tray: close/minimize retain process, restore, hide and explicit quit');
}finally{if(!exited)await app.close();}
