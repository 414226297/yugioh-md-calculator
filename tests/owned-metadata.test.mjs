import test from 'node:test';import assert from 'node:assert/strict';
import {Metadata31} from '../dist/reader/owned/metadata.js';
function fixture(){const b=Buffer.alloc(512);b.writeUInt32LE(0xfab11baf,0);b.writeUInt32LE(31,4);for(const [i,o,n] of [[2,256,16],[11,272,12],[19,284,88]]){b.writeUInt32LE(o,8+i*8);b.writeUInt32LE(n,12+i*8);}b.write('Duel\0Game\0field\0',256);b.writeInt32LE(10,272);b.writeInt32LE(7,276);b.writeInt32LE(5,288);b.writeUInt16LE(1,352);return b;}
test('owned metadata resolves independent synthetic types and fields',()=>{const m=new Metadata31(fixture());assert.equal(m.typeCount,1);assert.equal(m.find('Game.Duel')[0].fields[0].name,'field');assert.equal(m.find('Game.Duel')[0].fields[0].typeIndex,7);assert.deepEqual(m.find('Missing'),[]);assert.throws(()=>m.getType(1));});
test('owned metadata rejects unsupported or truncated layouts and corrupt indices',()=>{for(const change of [b=>b.writeUInt32LE(0,0),b=>b.writeUInt32LE(32,4),b=>b.writeUInt32LE(999999,24),b=>b.writeUInt32LE(13,100)]){const b=fixture();change(b);assert.throws(()=>new Metadata31(b));}const b=fixture();b.writeInt32LE(99999,284);assert.throws(()=>new Metadata31(b).getType(0));const c=fixture();c.writeInt32LE(999,316);assert.throws(()=>new Metadata31(c).getType(0));});

test('v39 section counts and variable type/generic indices preserve field names',()=>{
 for(const width of [1,2,4]){
  const b=Buffer.alloc(1024),stride=68+3*width+2;
  b.writeUInt32LE(0xfab11baf);b.writeUInt32LE(39,4);
  for(const [i,o,size,count] of [[2,400,16,16],[11,420,8+width,1],[14,450,0,300],[18,460,4+width,1],[19,500,stride,1]]){
   b.writeUInt32LE(o,8+i*12);b.writeUInt32LE(size,12+i*12);b.writeUInt32LE(count,16+i*12);
  }
  b.write('Duel\0Game\0field\0',400);b.writeUInt32LE(10,420);b.writeUIntLE(7,424,width);
  b.writeUInt32LE(5,504);b.writeUIntLE(9,508,width);
  const fieldAt=12+3*width+2;b.writeUInt16LE(1,500+fieldAt+36);
  const m=new Metadata31(b),t=m.find('Game.Duel')[0];
  assert.equal(t.byvalTypeIndex,9);assert.equal(t.fields[0].name,'field');assert.equal(t.fields[0].typeIndex,7);
  const bad=Buffer.from(b);bad.writeUInt32LE(2,16+19*12);assert.throws(()=>new Metadata31(bad));
 }
});
