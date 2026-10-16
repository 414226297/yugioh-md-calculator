import {_electron as electron} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
import {deck,catalog,scene} from '../tests/fixtures/scenes.mjs';
const env={...process.env,MD_TEST_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env,timeout:30000});
const failures=[];const results=[];
try{
 const page=await app.firstWindow();page.on('pageerror',e=>failures.push(e.message));await page.waitForLoadState('domcontentloaded');
 const inject=async(snapshot,inventory)=>{
   snapshot.timestamp=Date.now();
   // Test input travels through an explicit test-only main-process endpoint, never shipped renderer APIs.
   const handler=await app.evaluate(async({ipcMain},fixture)=>{
     const listener=ipcMain._invokeHandlers.get('test:state');return listener({},fixture);
   },{deck,catalog,snapshot,inventory});
   return handler;
 };
 await inject(scene());await page.locator('#total').filter({hasText:'9'}).waitFor();
 assert.equal(await page.locator('.plan').count(),1);assert.equal((await page.locator('.plan .number-card').nth(0).textContent()).replace(/\s/g,''),'2×4阶超量');
 assert.equal(await page.locator('.counts td').allTextContents().then(x=>x.join(',')),'1,2,4,2');
 assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 await app.evaluate(async({ipcMain},fixture)=>ipcMain._invokeHandlers.get('test:state')({},fixture),{
   deck:null,catalog,sequence:[{...scene(),status:'menu',session:null,deck},{...scene(),status:'menu',session:null,deck:null},scene()]
 });
 await page.locator('.status-pill').filter({hasText:'卡组获取成功'}).waitFor();
 assert.equal(await page.locator('.plan').count(),1);
 assert.equal((await page.evaluate(()=>window.cannon.getState())).inventory.extra.reduce((n,c)=>n+c.count,0),15);
 results.push('DECK-TRANSITION editor → menu → duel preserves acquired deck without confirm command');
 results.push('UI-02/03 numeric summary, plan, isolated renderer');
 await page.getByRole('button',{name:'修正',exact:true}).first().click();await page.locator('#myHand').fill('3');await page.getByRole('button',{name:'保存数量'}).click();
 await page.getByText('当前无匹配组合',{exact:true}).waitFor();assert.equal(await page.locator('#total').innerText(),'11');results.push('MANUAL-01 actual form changes solver output');
 const t=scene();t.monsters=[{uid:1,kind:'level',value:4,faceUp:true},{uid:2,kind:'level',value:4,faceUp:true},{uid:3,kind:'rank',value:4,faceUp:true},{uid:4,kind:'level',value:5,faceUp:true}];await inject(t);
 await page.waitForFunction(()=>document.querySelectorAll('.tile').length===3);assert.deepEqual(await page.locator('.tile').allTextContents(),['4星','4阶','5星']);results.push('UI-04 deduplicated type/value tiles');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(320,600));
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('#content').evaluate(el=>el.scrollWidth<=el.clientWidth),true);results.push('UI-05 320px layout has no horizontal clipping');
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/sidebar.png'});
 await app.evaluate(async({ipcMain},fixture)=>ipcMain._invokeHandlers.get('test:state')({},fixture),{deck,catalog:{},snapshot:scene()});
 await page.locator('.status-pill').filter({hasText:'卡组已读取 · 属性待获取'}).waitFor();
 assert.equal((await page.evaluate(()=>window.cannon.getState())).deck.id,deck.id);
 results.push('DECK-ATTRIBUTES live deck retained while missing attributes are identified separately');
 const uncertain=scene();uncertain.completeLog=false;await inject(uncertain);await page.getByText('等待核对 / 更新',{exact:true}).waitFor();assert.equal(await page.locator('.plan').count(),0);results.push('UNCERTAIN-01 unknown history blocks plans');
 await inject(scene());await page.getByRole('button',{name:'核对',exact:true}).click();
 await page.getByLabel('extra-9612-数量',{exact:true}).fill('0');
 await page.getByRole('button',{name:'确认库存',exact:true}).click();
 await page.locator('#toast').filter({hasText:'总数'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'确认库存',exact:true}).count(),1);
 await page.getByLabel('extra-9612-数量',{exact:true}).fill('1');
 await page.getByRole('button',{name:'确认库存',exact:true}).click();
 await page.getByText('含手动核对值',{exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>window.cannon.getState())).inventory.quality,'manual');
 results.push('INVENTORY-UI mismatched totals rejected, corrected form saves checkpoint');
 const denied=await page.evaluate(()=>window.cannon.command('arbitrary-native-call'));
 assert.equal(denied.ok,false);results.push('IPC unknown commands rejected');
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'暂停读取',exact:true}).click();await page.getByRole('button',{name:'恢复读取',exact:true}).waitFor();results.push('settings navigation and pause');
 assert.deepEqual(failures,[]);
 for(const r of results)console.log('PASS',r);
}finally{await app.close();}
