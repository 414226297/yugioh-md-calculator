import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,readdirSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const root=fileURLToPath(new URL('../',import.meta.url));
const archive=process.argv[2]&&path.resolve(process.argv[2]);
if(!archive||!existsSync(archive))throw Error('用法：node scripts/test-portable.mjs <便携ZIP路径>');
const run=promisify(execFile);
const entries=(await run('tar.exe',['-t','-f',archive],{windowsHide:true,maxBuffer:8*1024*1024})).stdout.split(/\r?\n/).filter(Boolean);
assert.ok(entries.length>20);
for(const entry of entries){
 assert.ok(!entry.split('/').includes('..'),'不允许跨目录归档项');
 assert.ok(!/(?:^|\/)(?:\.git|local-data|test-results|node_modules|\.pnpm-store|\.env)(?:\/|$)/.test(entry),`不得打包私人/开发目录 ${entry}`);
 assert.ok(!entry.endsWith('untapped-scry.node'),'不得打包第三方读取模块');
}
const work=path.join(root,'test-results',`便携解压 空格-${Date.now()}`);mkdirSync(work,{recursive:true});
await run('tar.exe',['-x','-f',archive,'-C',work],{windowsHide:true});
const unpacked=path.join(work,entries[0].split('/')[0]);
const appDir=path.join(unpacked,'resources','app');
assert.deepEqual(readdirSync(appDir).sort(),['dist','package.json']);
const manifest=JSON.parse(readFileSync(path.join(unpacked,'PORTABLE-INFO.json'),'utf8'));
assert.equal(manifest.nativeReaderBundled,false);
for(const f of manifest.compiledFiles){
 const text=readFileSync(path.join(appDir,'dist',f),'utf8');
 assert.ok(!/[A-Z]:[\\/]Users[\\/]/i.test(text),`本机用户路径不能出现在发布源码 ${f}`);
}
assert.ok(existsSync(path.join(unpacked,'LICENSE.electron.txt')));
assert.ok(existsSync(path.join(unpacked,'LICENSES.chromium.html')));
const env={...process.env};
for(const key of Object.keys(env))if(/^(?:ELECTRON_RUN_AS_NODE|MD_TEST_MODE|MD_SCRY_PATH|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\))$/i.test(key))delete env[key];
env.APPDATA=path.join(work,'fresh-profile','roaming');env.LOCALAPPDATA=path.join(work,'fresh-profile','local');env.ProgramFiles=path.join(work,'fresh-program-files');
mkdirSync(env.APPDATA,{recursive:true});mkdirSync(env.LOCALAPPDATA,{recursive:true});
const app=await electron.launch({executablePath:path.join(unpacked,'MD-Assistant.exe'),args:[],cwd:work,env,timeout:30000});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 await page.getByText('等待核对 / 更新',{exact:true}).waitFor();
 const state=await page.evaluate(()=>window.cannon.getState());
 assert.equal(state.deck,null);assert.equal(state.result.plans.length,0);
 assert.match(state.result.reason,/未找到本机读取模块/);
 assert.ok(state.config.modulePath.startsWith(env.LOCALAPPDATA));
 assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 const appInfo=await app.evaluate(({app})=>({packaged:app.isPackaged,userData:app.getPath('userData')}));
 assert.equal(appInfo.packaged,true);
 assert.equal(appInfo.userData,path.join(env.APPDATA,'md-cannon-assistant','electron'));
 assert.equal(existsSync(path.join(appDir,'local-data')),false);
 await page.getByRole('button',{name:'设置',exact:true}).click();
 const exported=await page.evaluate(()=>window.cannon.command('export'));assert.equal(exported.ok,true);
 const diagnostic=JSON.parse(readFileSync(path.join(env.APPDATA,'md-cannon-assistant','diagnostic.json'),'utf8'));
 assert.match(diagnostic.error,/未找到本机读取模块/);
 assert.ok(!JSON.stringify(diagnostic).includes(work));
 await page.screenshot({path:path.join(root,'test-results','portable-clean-profile.png')});
 writeFileSync(path.join(root,'test-results','portable-validation.json'),JSON.stringify({archive:path.basename(archive),packaged:appInfo.packaged,checks:['ZIP排除私人及开发数据','UTF-8与中文空格路径启动','无需Node或Codex启动入口','全新用户数据隔离','缺少读取模块明确提示','渲染进程隔离','本地诊断路径脱敏'],result:'passed'},null,2));
 console.log('PASS portable ZIP → Chinese/space extraction directory → production executable → fresh isolated profile');
 console.log('PASS private data excluded, licenses preserved, missing-reader fallback and diagnostics');
}finally{await app.close();}

const readerFlag=process.argv.indexOf('--reader');
if(readerFlag!==-1){
 const reader=process.argv[readerFlag+1];if(!reader||!path.isAbsolute(reader)||!existsSync(reader))throw Error('--reader 需要本机真实读取模块路径');
 const linked=await electron.launch({executablePath:path.join(unpacked,'MD-Assistant.exe'),args:[],cwd:work,env:{...env,MD_SCRY_PATH:reader},timeout:30000});
 try{
  const page=await linked.firstWindow();await page.waitForLoadState('domcontentloaded');
  let state;const deadline=Date.now()+20000;
  while(Date.now()<deadline){state=await page.evaluate(()=>window.cannon.getState());if(['waiting','menu','duel','error'].includes(state.snapshot?.status))break;await new Promise(r=>setTimeout(r,250));}
  assert.ok(['waiting','menu','duel'].includes(state?.snapshot?.status),state?.result?.reason??'读取子进程没有返回状态');
  assert.ok(Date.now()-state.snapshot.timestamp<2000);
  assert.equal(state.config.modulePath,reader);
  const resultFile=path.join(root,'test-results','portable-validation.json');
  const result=JSON.parse(readFileSync(resultFile,'utf8'));result.checks.push('便携EXE使用外部本机模块路径并启动读取子进程');result.readerStatus=state.snapshot.status;
  writeFileSync(resultFile,JSON.stringify(result,null,2));
  console.log(`PASS packaged reader child process; current game status: ${state.snapshot.status}`);
 }finally{await linked.close();}
}
