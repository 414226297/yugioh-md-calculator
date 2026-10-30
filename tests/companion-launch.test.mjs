import test from 'node:test';
import assert from 'node:assert/strict';
import {companionRunning,createCompanionLauncher} from '../dist/desktop/companion-launch.js';

test('process detection matches both supported names, including background instances',()=>{
 for(const name of ['Untapped.gg Companion.exe','UNTAPPED COMPANION.EXE']){
  assert.equal(companionRunning(`"${name}","123","Console","1","10,000 K"\r\n"${name}","124","Console","1","1,000 K"`),true);
 }
 assert.equal(companionRunning('"Other Untapped.gg Companion.exe","123","Console","1","1 K"'),false);
 assert.equal(companionRunning('"System","4","Services","0","1 K"'),false);
 assert.throws(()=>companionRunning('ERROR: Access denied'));
 assert.throws(()=>companionRunning(''));
});
test('already running skips executable lookup and launch',async()=>{
 const launch=createCompanionLauncher(async()=>true,async()=>assert.fail('duplicate launch'));
 await launch(()=>assert.fail('no executable lookup needed'));
});
test('concurrent and repeated startup calls launch only once',async()=>{
 let checks=0,starts=0;
 const launch=createCompanionLauncher(async()=>{checks++;return false;},async file=>{assert.equal(file,'app.exe');starts++;});
 await Promise.all([launch(()=>'app.exe'),launch(()=>'app.exe')]);
 await launch(()=>'app.exe');
 assert.equal(checks,1);assert.equal(starts,1);
});
test('failed process inspection never launches and permits a later check',async()=>{
 let checks=0,starts=0;
 const launch=createCompanionLauncher(async()=>{if(++checks===1)throw Error('denied');return false;},async()=>{starts++;});
 await assert.rejects(launch(()=>'app.exe'),/未联动启动/);assert.equal(starts,0);
 await launch(()=>'app.exe');assert.equal(starts,1);
});
test('missing executable and spawn errors are reported without swallowing failures',async()=>{
 const missing=createCompanionLauncher(async()=>false,async()=>assert.fail());
 await assert.rejects(missing(()=>{throw Error('未找到');}),/未找到/);
 const failed=createCompanionLauncher(async()=>false,async()=>{throw Error('spawn failure');});
 await assert.rejects(failed(()=>'app.exe'),/启动失败/);
});
