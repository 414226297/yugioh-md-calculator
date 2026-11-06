import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
const env={...process.env,MD_TEST_MODE:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env,timeout:30000});
try{
  const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
  await page.evaluate(()=>window.cannon.command('settings','settings'));
  let settings;
  for(let attempt=0;attempt<100&&!settings;attempt++){
    settings=app.windows().find(p=>p.url().includes('window=settings'));
    if(!settings)await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(settings);await settings.waitForLoadState('domcontentloaded');
  await settings.getByText('卡片资料自动更新已启用：',{exact:false}).waitFor();
  await settings.locator('.advanced-settings summary').click();
  await settings.getByRole('button',{name:'更新卡片属性',exact:true}).waitFor();
  const state=await settings.evaluate(()=>window.cannon.getState());
  assert.equal(state.catalogMessage,'');
  console.log('PASS catalog settings explanation, manual update entry, test-mode automatic download isolation');
}finally{await app.close();}
