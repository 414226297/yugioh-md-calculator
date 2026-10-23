import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validateConfig} from '../dist/desktop/config.js';

test('owned backend accepts no proprietary module; companion still validates its path',()=>{
  assert.equal(validateConfig({...defaults(),readerBackend:'owned',modulePath:''}).readerBackend,'owned');
  assert.throws(()=>validateConfig({...defaults(),readerBackend:'companion',modulePath:''}));
  assert.throws(()=>validateConfig({...defaults(),readerBackend:'unknown'}));
  assert.equal(defaults().readerBackend,'owned');
  assert.equal(validateConfig({...defaults(),readerBackend:undefined}).readerBackend,'owned');
});

test('per-panel overlay switches migrate the legacy setting and persist independently',()=>{
 const old=validateConfig({...defaults(),overlayEnabled:false});
 assert.equal(old.handOverlayEnabled,false);assert.equal(old.backrowOverlayEnabled,false);
 const split=validateConfig({...old,handOverlayEnabled:true});
 assert.equal(split.handOverlayEnabled,true);assert.equal(split.backrowOverlayEnabled,false);assert.equal(split.overlayEnabled,true);
 assert.deepEqual(validateConfig(split),split);
 assert.throws(()=>validateConfig({...split,backrowOverlayEnabled:'yes'}));
});
