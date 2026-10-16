import {_electron as electron} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MD_TEST_MODE;
const app=await electron.launch({args:['.'],env,timeout:30000});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 let state;const deadline=Date.now()+20000;
 while(Date.now()<deadline){state=await page.evaluate(()=>window.cannon.getState());if(state.snapshot?.status==='duel'&&!state.snapshot.busy)break;await new Promise(r=>setTimeout(r,250));}
 assert.equal(state.snapshot?.status,'duel',state.result.reason);
 assert.equal(state.snapshot.busy,false,'场面须在连续读取中保持稳定');
 await page.locator('.status-pill').click();await page.getByRole('button',{name:'确认用于本次对局',exact:true}).click();
 state=await page.evaluate(()=>window.cannon.getState());
 assert.equal(state.inventory.quality,'confirmed',JSON.stringify(state.inventory.reasons));
 assert.equal(state.inventory.extra.reduce((a,s)=>a+s.count,0),state.snapshot.extraCount);
 assert.equal(state.inventory.banished.reduce((a,s)=>a+s.count,0),state.snapshot.banishedCount);
 assert.equal(state.deckReady,true);
 if(process.argv.includes('--initial')){assert.deepEqual(state.counts,{myHand:5,opponentHand:5,myField:0,opponentField:0});assert.equal(state.snapshot.extraCount,15);assert.equal(state.snapshot.banishedCount,0);}
 if(process.argv.includes('--resolved')){
   const moves=state.snapshot.moves;
   const removed=moves.filter(m=>m.from===14&&m.to===17&&m.action===18);
   const returned=moves.filter(m=>m.from===17&&m.to===14&&m.action===33);
   assert.equal(removed.length,3,'应有三张额外卡除外');assert.equal(returned.length,2,'应有两张返回');
   assert.equal(state.snapshot.extraCount,14);assert.ok(returned.every(r=>removed.some(m=>m.cardId===r.cardId)));
   for(const id of Object.keys(state.deck.extra).map(Number)){
     const removedCount=removed.filter(m=>m.cardId===id).length,returnedCount=returned.filter(m=>m.cardId===id).length;
     assert.equal(state.inventory.extra.filter(s=>s.id===id).reduce((n,s)=>n+s.count,0),state.deck.extra[id]-removedCount+returnedCount,`额外库存 ${id}`);
     assert.equal(state.inventory.banished.filter(s=>s.id===id).reduce((n,s)=>n+s.count,0),removedCount-returnedCount,`除外库存 ${id}`);
   }
 }
 mkdirSync('test-results',{recursive:true});
 const label=process.argv.includes('--resolved')?'resolved':process.argv.includes('--initial')?'initial':'duel';
 writeFileSync(`test-results/live-${label}.json`,JSON.stringify(state,null,2));
 await page.screenshot({path:`test-results/live-${label}.png`});
 console.log('PASS live duel',label,JSON.stringify({counts:state.counts,extra:state.snapshot.extraCount,banished:state.snapshot.banishedCount,quality:state.inventory.quality,plans:state.result.plans}));
}finally{await app.close();}
