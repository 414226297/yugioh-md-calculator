import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env, timeout: 30000 });
try {
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  assert.equal(await win.title(), '联栗炮助手');
  assert.equal(await win.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await win.evaluate(() => window.cannon.version), '0.1.0');
  console.log('PASS desktop launch, isolated renderer and preload bridge');
} finally { await app.close(); }
