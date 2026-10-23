import test from 'node:test';import assert from 'node:assert/strict';
import {OwnedContext} from '../dist/reader/owned/context.js';
const metadata={typeCount:0};
const wrap=m=>{m.readMany=async ranges=>Promise.all(ranges.map(r=>m.read(r.address,r.length)));return m;};
test('owned snapshot resumes a missing read even if legacy optional-field catch swallows it',async()=>{
 let reads=0;const c=new OwnedContext(wrap({read:async()=>{reads++;return Buffer.from([42]);}}),0n,metadata);
 const result=await c.run(()=>{try{return c.bytes(65536n,1)[0];}catch{return null;}});
 assert.equal(result,42);assert.equal(reads,2);
});
test('owned snapshot rejects continuously changing memory and permits later retry',async()=>{
 let value=0;const c=new OwnedContext(wrap({read:async()=>Buffer.from([++value])}),0n,metadata);
 await assert.rejects(c.run(()=>c.bytes(65536n,1)[0]),/等待稳定/);
 c.memory.read=async()=>Buffer.from([99]);assert.equal(await c.run(()=>c.bytes(65536n,1)[0]),99);
});
test('owned snapshot does not suppress genuine errors',async()=>{
 const c=new OwnedContext(wrap({read:async()=>Buffer.from([1])}),0n,metadata);
 await assert.rejects(c.run(()=>{throw Error('actual failure');}),/actual failure/);
});

test('owned snapshot validates accessed bytes, ignoring changing animation neighbours',async()=>{
 let calls=0;const requested=[];
 const c=new OwnedContext(wrap({read:async(address,length)=>{
  requested.push({address,length});const out=Buffer.alloc(length);
  for(let i=0;i<length;i++)out[i]=address+BigInt(i)===65540n?42:++calls%256;
  return out;
 }}),0n,metadata);
 assert.equal(await c.run(()=>c.bytes(65540n,1)[0]),42);
 assert.deepEqual(requested,[{address:65536n,length:64},{address:65540n,length:1}]);
});

test('owned metadata strings decode UTF-8 and stop at page boundaries',async()=>{
 const start=0x1ffffn,bytes=Buffer.from('字段\0');const calls=[];
 const c=new OwnedContext(wrap({read:async(address,length)=>{calls.push({address,length});const out=Buffer.alloc(length);for(let i=0;i<length;i++){const index=Number(address-start)+i;if(index>=0&&index<bytes.length)out[i]=bytes[index];}return out;}}),0n,metadata);
 assert.equal(await c.run(()=>c.cstring(start)),'字段');
 assert.ok(calls.every(({address,length})=>Number(address%4096n)+length<=4096));const before=calls.length;assert.equal(await c.run(()=>c.cstring(start)),'字段');assert.equal(calls.length,before);
});
