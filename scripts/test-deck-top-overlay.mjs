import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {deck,catalog,scene} from '../tests/fixtures/scenes.mjs';
const env={...process.env,MD_TEST_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env,timeout:30000});
const errors=[];
try{
 await app.context().route('https://cdn.233.momobako.com/**',route=>route.fulfill({contentType:'image/png',body:readFileSync('src/ui/assets/md/card_frame-monster_effect.png')}));
 const main=(await app.windows()).find(p=>!p.url().includes('window=settings'))??await app.firstWindow();
 await main.waitForLoadState('domcontentloaded');
 const configure=patch=>main.evaluate(async patch=>{const s=await window.cannon.getState();return window.cannon.command('config',{...s.config,...patch});},patch);
 assert.equal((await configure({handOverlayEnabled:true,handOverlayStyle:'label',backrowOverlayEnabled:false,infoOverlayEnabled:false})).ok,true);
 const fixture={deck,catalog:{...catalog,17768:{id:17768,name:'怒刹帝利・芬里尔',password:32909498,category:'monster',kind:'other',value:0}},
  snapshot:{...scene(),session:'42:deck-top-overlay',logLength:2,counts:{...scene().counts,opponentHand:2},publicHandObservation:{cards:[],changes:[{key:'1:deck',index:1,type:'deckTop',cardId:17768}]}},
  cardDetails:{17768:{id:17768,password:0,name:'怒刹帝利・芬里尔',types:'怪兽',description:'顶牌浮窗详情测试'}}};
 await app.evaluate(({ipcMain,BrowserWindow},f)=>{
  const setShape=BrowserWindow.prototype.setShape;
  BrowserWindow.prototype.setShape=function(regions){this.testShape=regions;return setShape.call(this,regions);};
  globalThis.f=f;globalThis.frame={active:true,pid:42,x:0,y:0,width:1366,height:768};
  globalThis.tick=setInterval(()=>{if(!globalThis.freezeTime)globalThis.f.snapshot.timestamp=Date.now();ipcMain._invokeHandlers.get('test:state')({},globalThis.f);ipcMain._invokeHandlers.get('test:window')({},globalThis.frame);},100);
 },fixture);
 const wait=async fn=>{for(let i=0;i<120;i++){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('top overlay condition timeout');};
 const native=()=>app.evaluate(({BrowserWindow,ipcMain})=>BrowserWindow.getAllWindows().filter(w=>ipcMain._invokeHandlers.get('overlay:state')({sender:w.webContents})?.source==='deckTop').map(w=>({visible:w.isVisible(),bounds:w.getBounds(),shape:w.testShape,focusable:w.isFocusable()})));
 let top;
 await wait(async()=>{top=(await app.windows()).find(p=>p.url().endsWith('/overlay.html'));return !!top&&await top.locator('.deck-top-tag').count()===1;});
 top.on('pageerror',e=>errors.push(e.message));
 await wait(async()=>(await native())[0]?.visible);
 const button=top.locator('.deck-top-tag');
 assert.equal(await button.getAttribute('aria-label'),'查看对方已确认顶牌：怒刹帝利・芬里尔');
 assert.ok(await button.evaluate(e=>e.classList.contains('hand-tag')&&e.classList.contains('thumbnail-tag')));
 await top.waitForFunction(()=>document.querySelector('.hand-thumbnail')?.naturalWidth>0);
 const geometry=await button.evaluate(e=>({transform:getComputedStyle(e).transform,w:e.offsetWidth,h:e.offsetHeight,root:document.querySelector('#overlay').getBoundingClientRect().toJSON()}));
 assert.match(geometry.transform,/matrix\(/);assert.ok(geometry.w<50&&geometry.h<70);
 const initial=(await native())[0];assert.equal(initial.focusable,false);assert.ok(initial.shape.length>2);
 assert.ok(initial.shape.reduce((n,r)=>n+r.width*r.height,0)<initial.bounds.width*initial.bounds.height*.85);
 await button.click();
 let report;await wait(async()=>{for(const p of await app.windows())if(await p.locator('.report-effect').count()){report=p;return true;}return false;});
 await report.getByText('顶牌浮窗详情测试',{exact:true}).waitFor();
 assert.equal(await report.locator('.candidate-list').count(),0);
 await top.evaluate(()=>window.overlay.close());
 mkdirSync('test-results',{recursive:true});await top.screenshot({path:'test-results/deck-top-overlay.png'});
 await app.evaluate(()=>{globalThis.frame={...globalThis.frame,x:100,y:100,width:683,height:384};});
 await wait(async()=>(await native())[0].bounds.width<initial.bounds.width);
 const small=(await native())[0].bounds;
 assert.ok(Math.abs(small.x-(100+initial.bounds.x/2))<=2);assert.ok(Math.abs(small.y-(100+initial.bounds.y/2))<=2);
 await configure({handOverlayEnabled:false});await wait(async()=>!(await native())[0].visible);
 await configure({handOverlayEnabled:true});await wait(async()=>(await native())[0].visible);
 for(const frame of [{active:false},{active:true,pid:99,x:0,y:0,width:1366,height:768}]){
  await app.evaluate((_,frame)=>{globalThis.frame=frame;},frame);await wait(async()=>!(await native())[0].visible);
 }
 await app.evaluate(()=>{globalThis.frame={active:true,pid:42,x:0,y:0,width:1366,height:768};globalThis.freezeTime=true;globalThis.f.snapshot.timestamp=Date.now()-3000;});
 await wait(async()=>!(await native())[0].visible);
 await app.evaluate(()=>{globalThis.freezeTime=false;});await wait(async()=>(await native())[0].visible);
 await app.evaluate(()=>{globalThis.f.snapshot.counts.opponentHand=3;globalThis.f.snapshot.logLength=3;globalThis.f.snapshot.publicHandObservation.changes.push({key:'2:draw',index:2,type:'enter',source:'draw'});});
 await wait(async()=>!(await native())[0].visible);
 const state=await main.evaluate(()=>window.cannon.getState());
 assert.equal(state.publicDeckTop,null);assert.deepEqual(state.publicHand.cards,[{id:17768,count:1}]);
 await wait(async()=>{for(const p of await app.windows())if(await p.locator('.hand-tag:not(.deck-top-tag)').count())return true;return false;});
 await app.evaluate(()=>{globalThis.f.snapshot.status='menu';globalThis.f.snapshot.session=null;});
 await wait(async()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('/overlay.html')).every(w=>!w.isVisible())));
 assert.deepEqual(errors,[]);
 console.log('PASS deck top overlay: thumbnail style, tilt, native shape, detail click, scale, shared toggle, foreground/PID/freshness gates, draw-to-hand and leaving duel');
}finally{await app.evaluate(()=>clearInterval(globalThis.tick)).catch(()=>{});await app.close();}
