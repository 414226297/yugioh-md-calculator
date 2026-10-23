import assert from 'node:assert/strict';
import {MemoryTransport} from '../dist/reader/owned/memory-transport.js';
import path from 'node:path';
const host=new MemoryTransport(path.resolve('local-data/owned-reader/MD.MemoryHost.exe'),'self-test');
try {
 const ready=await host.ready;
 const bytes=await host.read(BigInt(ready.fixture),16);
 assert.equal(bytes.subarray(0,11).toString(),'MDASSISTANT');
 const batch=await host.readMany([{address:BigInt(ready.fixture),length:4},{address:BigInt(ready.fixture)+4n,length:7}]);assert.equal(Buffer.concat(batch).toString(),'MDASSISTANT');
 await assert.rejects(host.readMany(Array.from({length:129},()=>({address:BigInt(ready.fixture),length:1}))),/bounds/);
 assert.ok((await host.modules()).some(m=>m.name==='MD.MemoryHost.exe'));
 await assert.rejects(host.read(0n,16),/bounds/);
 await assert.rejects(host.read(BigInt(ready.fixture),1048577),/bounds/);
 await assert.rejects(host.read(65536n,16),/ReadProcessMemory/);
 console.log('PASS owned reader: self-process memory, module enumeration, rejected invalid/unmapped reads. No game access.');
} finally {host.close();}
