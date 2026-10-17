import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MD_TEST_MODE;
const app=await electron.launch({...(process.argv[2]?{executablePath:process.argv[2],args:[]}:{args:['.']}),env,timeout:30000});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 let s;const deadline=Date.now()+20000;
 while(Date.now()<deadline){s=await page.evaluate(()=>window.cannon.getState());if(s.snapshot?.deckSource==='preparation'&&s.deckReady)break;await new Promise(r=>setTimeout(r,200));}
 assert.equal(s.snapshot?.deckSource,'preparation',s.result.reason);assert.equal(s.deckReady,true,s.snapshot?.reason);
 assert.equal(s.snapshot.status,'menu');assert.equal(s.deck.id,s.snapshot.deckSelection.id);
 assert.equal(s.deck.revision,s.snapshot.deckSelection.revision);
 assert.equal(s.result.plans.length,0,'准备页面不能显示对局方案');
 await page.locator('.status-pill').click();await page.getByText(s.deck.name,{exact:true}).waitFor();
 mkdirSync('test-results',{recursive:true});
 const result={time:new Date().toISOString(),source:s.snapshot.deckSource,name:s.deck.name,main:Object.values(s.deck.main).reduce((a,b)=>a+b,0),extra:Object.values(s.deck.extra).reduce((a,b)=>a+b,0),ready:s.deckReady};
 writeFileSync('test-results/live-preparation.json',JSON.stringify(result,null,2));
 await page.screenshot({path:'test-results/live-preparation.png'});
 console.log('PASS live preparation without editor or confirmation',JSON.stringify(result));
}finally{await app.close();}
