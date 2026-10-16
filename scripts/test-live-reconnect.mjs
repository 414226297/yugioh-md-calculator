import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MD_TEST_MODE;
const app=await electron.launch({args:['.'],env,timeout:30000});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 let sawConnected=false,sawWaiting=false,sawReconnect=false,last='',records=[];
 const deadline=Date.now()+900000;
 while(Date.now()<deadline){
  const s=await page.evaluate(()=>window.cannon.getState());
  const status=s.snapshot?.status??'starting';
  if(status!==last){console.log('STATE',status);records.push({at:Date.now(),status,session:s.snapshot?.session,total:s.total});last=status;}
  if(status==='menu'&&!sawWaiting&&!sawConnected){sawConnected=true;console.log('READY: connected to MD; restart can begin');}
  if(sawConnected&&status==='waiting'){
   sawWaiting=true;assert.equal(s.result.plans.length,0);assert.equal(s.inventory.extra.length,0);assert.equal(s.inventory.banished.length,0);
  }
  if(sawWaiting&&status==='menu'){
   assert.equal(s.result.plans.length,0);assert.equal(s.inventory.extra.length,0);assert.equal(s.inventory.banished.length,0);
   assert.equal(s.snapshot.session,null);sawReconnect=true;break;
  }
  await new Promise(r=>setTimeout(r,300));
 }
 writeFileSync('test-results/live-reconnect.json',JSON.stringify(records,null,2));
 assert.ok(sawConnected,'必须先连接已运行的MD主界面');assert.ok(sawWaiting,'必须观察到MD退出后的waiting状态');assert.ok(sawReconnect,'必须在同一助手进程观察到重启后menu状态');
 console.log('PASS live reconnect; no stale inventory or recommendations');
}finally{await app.close();}
