import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {deck,catalog,scene} from '../tests/fixtures/scenes.mjs';
const env={...process.env,MD_TEST_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env,timeout:30000});
try{
 const main=await app.firstWindow();await main.waitForLoadState('domcontentloaded');
 const config=await main.evaluate(async()=>{const s=await window.cannon.getState();return window.cannon.command('config',{...s.config,overlayEnabled:true});});assert.equal(config.ok,true);
 const changes=[{key:'1:s',index:1,type:'fieldSet',slot:10,cardId:8682},{key:'2:s',index:2,type:'fieldSet',slot:9},{key:'3:s',index:3,type:'fieldSet',slot:8,cardId:5236}];
 const snapshot={...scene(),timestamp:Date.now(),session:'42:overlay',logLength:4,opponentSetSlots:[10,9],opponentPublicSlots:[8],publicHandObservation:{cards:[],changes}};
 const frame={active:true,pid:42,x:100,y:100,width:1360,height:765};
 await app.evaluate(({ipcMain},fixture)=>{
  globalThis.overlayFixture=fixture;
  globalThis.overlayTick=setInterval(()=>{
   const f=globalThis.overlayFixture;f.snapshot.timestamp=Date.now();
   ipcMain._invokeHandlers.get('test:state')({},f);
   ipcMain._invokeHandlers.get('test:window')({},globalThis.overlayFrame??f.frame);
  },100);
 },{deck,catalog:{...catalog,8682:{id:8682,name:'蜘蛛巢丝网',category:'trap',rarity:'R',kind:'other',value:0}},snapshot,frame,cardDetails:{8682:{id:8682,password:0,types:'陷阱',description:'测试卡片效果'}}});
 const wait=async predicate=>{for(let i=0;i<100;i++){if(await predicate())return;await new Promise(r=>setTimeout(r,50));}throw Error('overlay condition timed out');};
 let windows=[];await wait(async()=>{windows=await app.windows();return windows.length===3;});
 const tags=windows.filter(p=>p!==main);
 await wait(async()=>await tags[0].locator('.tag').count()===1&&await tags[1].locator('.tag').count()===1);
 assert.deepEqual((await Promise.all(tags.map(p=>p.locator('.tag').innerText()))).sort(),['未知','陷']);
 const trap=tags[(await Promise.all(tags.map(p=>p.locator('.tag').innerText()))).indexOf('陷')];
 const native=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.getTitle()==='盖牌提示').map(w=>({visible:w.isVisible(),focusable:w.isFocusable(),bounds:w.getBounds()})));
 let states=await native();assert.equal(states.length,2);assert.ok(states.every(w=>w.visible&&!w.focusable));
 for(const page of tags){const size=await page.locator('.tag').boundingBox();assert.ok(size.height<=21,'native minimum height must not enlarge the visible label');}
 const before=states.map(w=>w.bounds);
 await app.evaluate(()=>{globalThis.overlayFrame={active:true,pid:42,x:200,y:150,width:680,height:383};});
 await wait(async()=>{states=await native();return states.every((w,i)=>w.bounds.width<before[i].width);});
 await trap.locator('.tag').click();
 await wait(async()=>{windows=await app.windows();return windows.length===4;});
 const details=windows.find(p=>p!==main&&!tags.includes(p));await details.getByText('测试卡片效果',{exact:true}).waitFor();
 assert.ok((await details.locator('.report-title').innerText()).includes('蜘蛛巢丝网'));assert.equal(await details.locator('.report-rarity').getAttribute('alt'),'R');
 assert.equal(await details.locator('.candidate-list').count(),0);
 assert.equal(await details.locator('.report-effect').innerText(),'测试卡片效果');
 assert.ok(await details.locator('.report-emblem').evaluate(e=>e instanceof HTMLImageElement&&e.complete&&e.naturalWidth>0&&e.src.endsWith('Attr09.png')));
 await details.evaluate(()=>document.fonts.ready);
 assert.ok(await details.evaluate(()=>document.fonts.check('600 17px MDYouHei')));
 assert.ok(await details.locator('.report-rarity').evaluate(e=>e instanceof HTMLImageElement&&e.complete&&e.naturalWidth>0));
 assert.ok(await details.locator('.detail').evaluate(e=>getComputedStyle(e).borderImageSource.includes('GUI_Global_Window_Frame_trim')));
 assert.equal(await details.locator('.report-effect').evaluate(e=>getComputedStyle(e).overflowY),'auto');
 assert.equal(await details.evaluate(()=>typeof window.require),'undefined');
 assert.equal((await details.evaluate(()=>window.overlay.cardDetail(99999))).ok,false);
 assert.equal(await details.locator('.close').count(),0);
 await app.evaluate(()=>{globalThis.overlayFrame={...globalThis.overlayFrame,click:0};});
 await new Promise(r=>setTimeout(r,150));
 await app.evaluate(()=>{globalThis.overlayFrame={...globalThis.overlayFrame,click:1,clickX:201,clickY:151};});
 await wait(async()=>await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('overlay.html')&&w.getBounds().width>100).every(w=>!w.isVisible())));
 await trap.locator('.tag').click();
 await wait(async()=>await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().includes('overlay.html')&&w.getBounds().width>100&&w.isVisible())));
 await details.screenshot({path:'test-results/overlay-detail.png'});
 const unknown=tags.find(p=>p!==trap);await unknown.locator('.tag').click();
 await details.getByText('暂无公开身份信息',{exact:true}).waitFor();
 assert.ok(Math.abs((await details.locator('.detail').boundingBox()).height-255)<=2,'empty report retains native report size');
 await details.screenshot({path:'test-results/overlay-empty.png'});
 await app.evaluate(()=>{globalThis.overlayFrame={active:false};});
 await wait(async()=>(await native()).every(w=>!w.visible));
 await app.evaluate(()=>{globalThis.overlayFrame={active:true,pid:99,x:0,y:0,width:1360,height:765};});
 await new Promise(r=>setTimeout(r,200));assert.ok((await native()).every(w=>!w.visible));
 await app.evaluate(()=>{globalThis.overlayFrame={active:true,pid:42,x:0,y:0,width:1360,height:765};});
 await wait(async()=>(await native()).filter(w=>w.visible).length===2);
 await app.evaluate(()=>{clearInterval(globalThis.overlayTick);});
 await wait(async()=>(await native()).every(w=>!w.visible));
 console.log('PASS overlay actual windows: labels, face-up exclusion, scale/move, non-focusable click details, IPC access, background/wrong PID/stale tracker hiding');
}finally{await app.evaluate(()=>clearInterval(globalThis.overlayTick)).catch(()=>{});await app.close();}


