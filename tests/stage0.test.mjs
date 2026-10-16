import test from 'node:test';
import assert from 'node:assert/strict';
import { ReaderHost } from '../dist/desktop/reader-host.js';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
test('reader exits without terminating host; host reports failure', async () => {
  const messages = [];
  let host;
  const reason = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no exit notification')), 5000);
    host = new ReaderHost(path.resolve('tests/fixtures/crash-reader.cjs'), m => messages.push(m), r => { clearTimeout(timer); resolve(r); });
    host.start();
  });
  assert.deepEqual(messages, [{ ready: true }]);
  assert.match(reason, /7/);
  assert.equal(host.child, null);
  host.stop();
});
test('local native dependency loads and exposes required read APIs', () => {
  const native = path.join(process.env.LOCALAPPDATA, 'Programs/untapped-companion/resources/app.asar.unpacked/node_modules/untapped-scry/lib/binding/napi-v5/untapped-scry.node');
  assert.ok(existsSync(native), '本机读取模块不存在');
  const s = createRequire(import.meta.url)(native);
  assert.equal(typeof s.Scry.connect, 'function');
  assert.equal(typeof s.Il2CppScry.prototype.getMetadataContext, 'function');
});
