import {_electron as electron} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MD_TEST_MODE;
const app=await electron.launch({args:['.'],env,timeout:30000});
try {
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 let state;const deadline=Date.now()+20000;
 while(Date.now()<deadline){state=await page.evaluate(()=>window.cannon.getState());if(['menu','duel'].includes(state.snapshot?.status))break;await new Promise(r=>setTimeout(r,250));}
 assert.ok(['menu','duel'].includes(state.snapshot?.status),JSON.stringify({reason:state.result.reason,status:state.snapshot?.status}));
 assert.ok(state.snapshot.timestamp>Date.now()-2000,'reading stale');assert.ok(state.deck,'no deck acquired');
 assert.ok(Object.keys(state.catalog).length>1000,'catalog unavailable');
 assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 if(process.argv.includes('--post-restart')){
  assert.equal(state.snapshot.status,'menu');assert.equal(state.snapshot.session,null);
  assert.equal(state.result.plans.length,0);assert.equal(state.inventory.extra.length,0);assert.equal(state.inventory.banished.length,0);
  assert.equal(state.deckReady,false,'历史缓存不能冒充重新获取的牌组');
  assert.equal(state.total,null,'主界面不得沿用上一局数量');
  writeFileSync('test-results/live-post-restart.json',JSON.stringify({time:new Date().toISOString(),status:state.snapshot.status,session:state.snapshot.session,total:state.total,inventory:state.inventory,deckReady:state.deckReady,result:state.result},null,2));
  console.log('PASS fresh app connects after MD restart; old counts, inventory and plans absent');
 }
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/live-sidebar.png'});
 writeFileSync('test-results/live-app.json',JSON.stringify({time:new Date().toISOString(),status:state.snapshot.status,deckName:state.deck.name,main:Object.values(state.deck.main).reduce((a,b)=>a+b,0),extra:Object.values(state.deck.extra).reduce((a,b)=>a+b,0),catalogCount:Object.keys(state.catalog).length,readerAge:Date.now()-state.snapshot.timestamp},null,2));
 console.log('PASS live desktop → isolated reader → real MD → sidebar; catalog ready');
}finally {await app.close();}
