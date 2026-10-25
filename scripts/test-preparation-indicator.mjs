import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {deck,catalog,scene} from '../tests/fixtures/scenes.mjs';
const env={...process.env,MD_TEST_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env,timeout:15000});
try{
 const main=await app.firstWindow();await main.waitForLoadState('domcontentloaded');
 const fixture={deck:{...deck,revision:10},catalog,snapshot:{...scene(),status:'menu',session:null,readerPid:42,preparationVisible:true,deckSource:'preparation',deckSelection:{id:deck.id,name:deck.name,revision:10},deck:{...deck,revision:10}}};
 await app.evaluate(({ipcMain},f)=>{
  globalThis.fixture=f;globalThis.frame={active:true,pid:42,x:0,y:0,width:1366,height:768};
  const tick=()=>{globalThis.fixture.snapshot.timestamp=Date.now();ipcMain._invokeHandlers.get('test:state')({},globalThis.fixture);ipcMain._invokeHandlers.get('test:window')({},globalThis.frame);};tick();globalThis.tick=setInterval(tick,100);
 },fixture);
 const wait=async f=>{for(let i=0;i<80;i++){if(await f())return;await new Promise(r=>setTimeout(r,50));}throw Error('preparation timeout');};
 let indicator;await wait(async()=>{indicator=(await app.windows()).find(p=>p.url().endsWith('/preparation.html'));return !!indicator;});
 await indicator.locator('#status-icon').waitFor();assert.equal(await indicator.locator('#status-detail').isVisible(),false);
 await indicator.locator('#status-icon').hover();await indicator.getByText('准备好决斗了',{exact:true}).waitFor();
 assert.equal(await indicator.evaluate(()=>typeof window.require),'undefined');
 await app.evaluate(()=>{globalThis.fixture.snapshot.deckSelection={id:'other',name:'新卡组',revision:11};globalThis.fixture.snapshot.deck=null;});
 await indicator.getByText('卡表尚未获取',{exact:true}).waitFor();
 await app.evaluate(()=>{globalThis.fixture.snapshot.preparationVisible=false;});
 await wait(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('/preparation.html')).every(w=>!w.isVisible())));
 console.log('PASS preparation badge hover, current selection and screen exit hiding');
}finally{await app.evaluate(()=>clearInterval(globalThis.tick)).catch(()=>{});await app.close();}
