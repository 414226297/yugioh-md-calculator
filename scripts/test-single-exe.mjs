import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdirSync,readdirSync,existsSync,readFileSync,copyFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const artifact=path.resolve(process.argv[2]??'');assert.ok(artifact.endsWith('.exe')&&existsSync(artifact),'需要单文件EXE路径');
const work=path.resolve('test-results',`单文件 空格-${Date.now()}`);mkdirSync(work,{recursive:true});
const single=path.join(work,'MD助手.exe');copyFileSync(artifact,single);
const env={...process.env,MD_TEST_MODE:'1',MD_PORTABLE_CACHE:path.join(work,'runtime')};delete env.ELECTRON_RUN_AS_NODE;
await promisify(execFile)(single,['--extract-only'],{env,cwd:work,windowsHide:true,timeout:60000,maxBuffer:1024*1024});
const cache=path.join(env.MD_PORTABLE_CACHE,readdirSync(env.MD_PORTABLE_CACHE).find(n=>/^[a-f0-9]{64}$/.test(n)));
for(const f of ['MD-Assistant.exe','icudtl.dat','resources/app/dist/reader/owned/MD.MemoryHost.exe'])assert.ok(existsSync(path.join(cache,f)),f);
assert.equal(readdirSync(work).filter(n=>n.endsWith('.exe')).length,1);
const info=JSON.parse(readFileSync(path.join(cache,'PORTABLE-INFO.json'),'utf8'));
assert.equal(info.ownedReaderBundled,true);assert.equal(info.nativeReaderBundled,false);
assert.ok(info.compiledFiles.every(n=>!n.includes('untapped-scry.node')));
const app=await electron.launch({executablePath:single,args:[],env,cwd:work,timeout:30000});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
 const state=await page.evaluate(()=>window.cannon.getState());assert.equal(state.snapshot,null);
 assert.equal(await page.locator('#public-hand .overlay-switch').innerText(),'悬浮窗');
 assert.equal(await page.locator('#opponent-backrow .overlay-switch').innerText(),'悬浮窗');
 assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 await page.screenshot({path:path.join(work,'single-exe-startup.png')});
 console.log('PASS one EXE copied alone → automatic cached extraction → packaged Electron UI; ICU data and owned helper present; no game reads');
}finally{await app.close();}
