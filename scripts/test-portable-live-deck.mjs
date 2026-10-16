import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {validateDeck} from '../dist/domain/model.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const executable=process.argv[2]&&path.resolve(process.argv[2]);
if(!executable||!existsSync(executable))throw Error('需要便携版EXE路径，并将MD停在牌组编辑界面');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MD_TEST_MODE;delete env.MD_SCRY_PATH;
env.APPDATA=path.join(root,'test-results',`portable-live-profile-${Date.now()}`);mkdirSync(env.APPDATA,{recursive:true});
const started=Date.now();const app=await electron.launch({executablePath:executable,args:[],env,timeout:30000});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 let state;const deadline=Date.now()+35000;
 while(Date.now()<deadline){
  state=await page.evaluate(()=>window.cannon.getState());
  if(state.deckReady&&state.snapshot?.deck?.readAt>=started)break;
  if(state.snapshot?.status==='error')break;
  await new Promise(r=>setTimeout(r,250));
 }
 const summary={status:state.snapshot?.status??null,reason:state.result.reason,moduleExists:existsSync(state.config.modulePath),liveDeckPresent:!!state.snapshot?.deck,freshDeck:!!state.deck&&state.deck.readAt>=started,main:state.deck&&Object.values(state.deck.main).reduce((n,c)=>n+c,0),extra:state.deck&&Object.values(state.deck.extra).reduce((n,c)=>n+c,0),catalogCount:Object.keys(state.catalog).length,catalogMessage:state.catalogMessage,deckReady:state.deckReady};
 writeFileSync(path.join(root,'test-results','portable-live-deck.json'),JSON.stringify(summary,null,2));
 await page.screenshot({path:path.join(root,'test-results','portable-live-deck.png')});console.log(JSON.stringify(summary,null,2));
 assert.equal(summary.moduleExists,true,'自动查找本机读取模块');
 assert.ok(state.snapshot?.deck&&validateDeck(state.snapshot.deck),'必须从实际牌组编辑界面获取合法牌组');
 assert.equal(summary.freshDeck,true,'不能使用旧牌组缓存冒充实时获取');
 assert.equal(summary.deckReady,true,'实时牌组与所需属性齐全后应显示获取成功');
 console.log('PASS real portable executable → automatic module discovery → live deck → required attributes');
}finally{await app.close();}
