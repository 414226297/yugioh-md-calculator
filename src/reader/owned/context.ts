import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {MemoryTransport} from './memory-transport.js';
import {Metadata31} from './metadata.js';
import {SnapshotUpdatingError} from '../snapshot-error.js';
class NeedRead {constructor(readonly address:bigint,readonly length:number){}}
/** Verified against game binary hash; refuse other builds instead of guessing. */
export const layout={sha256:'ca24a284a86dc394f6b0cbeaad455d29e5f6b95fc8db8fc42812b29de3c7620c',classTableRva:63406416};
export const supportedLayouts=[layout,{sha256:'9248d99205f6a35a53b53076d53e06fa4c353e07052fd41277cab18f370740f6',classTableRva:66100576}];
type Field={name:string;type:bigint;offset:number;static:boolean};
export class OwnedContext {
 private cache=new Map<string,Buffer>();
 private used=new Map<string,Buffer>();
 private fields=new Map<bigint,Field[]>();
 private names=new Map<bigint,string>();
 private metadataStrings=new Map<bigint,string>();
 private typeIndices=new Map<number,number>();
 private lookup=new Map<string,number[]>();
 private table:bigint=0n;
 private reading=false;
 private missing:NeedRead|null=null;
 private constructor(readonly memory:MemoryTransport,readonly base:bigint,readonly metadata:Metadata31){
  for(let i=0;i<metadata.typeCount;i++){const t=metadata.getType(i);this.typeIndices.set(t.byvalTypeIndex,i);const old=this.lookup.get(t.fullName)??[];old.push(i);this.lookup.set(t.fullName,old);}
 }
 static async create(memory:MemoryTransport,metadataPath:string){
  const module=(await memory.modules()).find(m=>m.name==='GameAssembly.dll');if(!module)throw Error('GameAssembly.dll not loaded');
  const hash=createHash('sha256').update(readFileSync(module.path)).digest('hex');
  const matched=supportedLayouts.find(candidate=>candidate.sha256===hash);
  if(!matched)throw Error('自有读取后端尚未适配此游戏版本');
  const context=new OwnedContext(memory,BigInt(module.address),new Metadata31(readFileSync(metadataPath)));
  context.table=(await memory.read(context.base+BigInt(matched.classTableRva),8)).readBigUInt64LE();
  if(context.table<65536n)throw Error('Class table unavailable');return context;
 }
 /** Replay a synchronous snapshot builder while satisfying missing exact reads.
  * The cache is discarded between snapshots; no adjacent hidden fields are decoded. */
 async run<T>(build:()=>T):Promise<T>{
  if(this.reading)throw Error('Concurrent snapshot read');this.reading=true;this.cache.clear();
  const started=Date.now();let restarts=0;
  try{for(let i=0;i<10000&&Date.now()-started<10000;i++){
   this.missing=null;this.used.clear();let result:T|undefined,error:unknown;
   try{result=build();}catch(e){error=e;}
   const need=this.missing as NeedRead|null;
   if(need){this.cache.set(need.address+':'+need.length,await this.memory.read(need.address,need.length));continue;}
   if(error)throw error;
   // Revalidate each exact range before accepting a snapshot. Replaying a
   // synchronous reader must not defeat its before/after consistency checks.
   let changed=false;
   const entries=[...this.used];
   for(let at=0;at<entries.length;){
    const chunk:typeof entries=[];let total=0;
    while(at<entries.length&&chunk.length<128){const entry=entries[at];if(total+entry[1].length>1048576)break;chunk.push(entry);total+=entry[1].length;at++;}
    const ranges=chunk.map(([key])=>{const [address,size]=key.split(':');return {address:BigInt(address),length:Number(size)};});
    const values=await this.memory.readMany(ranges);
    if(values.some((b,i)=>!b.equals(chunk[i][1]))){changed=true;break;}
   }
   if(changed){if(++restarts>2)throw new SnapshotUpdatingError('场面更新中，自有读取后端等待稳定');this.cache.clear();continue;}
   return result as T;
  }throw new SnapshotUpdatingError('Snapshot read limit exceeded');}finally{this.reading=false;this.cache.clear();this.used.clear();}
 }
 bytes(a:bigint,n:number):Buffer{
  if(a<65536n||n<1||n>1048576)throw Error('Invalid object read');
  if(n<=64){
   const block=a&~63n,offset=Number(a-block),key=block+':64',b=this.cache.get(key);
   if(b&&offset+n<=64){const value=b.subarray(offset,offset+n);this.used.set(a+':'+n,value);return value;}
   // Small fields and array elements are packed together. Fetch one aligned
   // cache line, constrained to a single 4 KiB page, to cut helper roundtrips.
   if(offset+n<=64&&Number(block%4096n)<=4032){this.missing??=new NeedRead(block,64);throw this.missing;}
  }
  const b=this.cache.get(a+':'+n);if(!b){this.missing??=new NeedRead(a,n);throw this.missing;}this.used.set(a+':'+n,b);return b;
 }
 ptr(a:bigint){return this.bytes(a,8).readBigUInt64LE();}
 i32(a:bigint){return this.bytes(a,4).readInt32LE();}
 cstring(a:bigint){const cached=this.metadataStrings.get(a);if(cached!==undefined)return cached;const chunks:Buffer[]=[];for(let i=0;i<4096;){const at=a+BigInt(i),length=Math.min(32,4096-Number(at%4096n),4096-i),b=this.bytes(at,length),end=b.indexOf(0);chunks.push(end<0?b:b.subarray(0,end));if(end>=0){const text=Buffer.concat(chunks).toString('utf8');this.metadataStrings.set(a,text);return text;}i+=length;}throw Error('Class name too long');}
 name(k:bigint){let n=this.names.get(k);if(n===undefined){const name=this.cstring(this.ptr(k+16n)),ns=this.cstring(this.ptr(k+24n));n=ns?ns+'.'+name:name;this.names.set(k,n);}return n;}
 getClass(name:string){const ids=this.lookup.get(name);if(ids?.length!==1)throw Error('Class missing/ambiguous: '+name);const k=this.ptr(this.table+BigInt(ids[0]*8));if(!k)throw Error('Class not initialized: '+name);if(this.name(k)!==name)throw Error('Class table identity mismatch');return new OwnedRef(this,0n,k,true);}
 getFields(k:bigint):Field[]{let fields=this.fields.get(k);if(fields)return fields;
  const count=this.bytes(k+292n,2).readUInt16LE();if(count>4096)throw Error('Field count invalid');const base=this.ptr(k+128n);fields=[];
  for(let i=0;i<count;i++){const p=base+BigInt(i*32),type=this.ptr(p+8n),bits=this.bytes(type+8n,4).readUInt32LE();fields.push({name:this.cstring(this.ptr(p)),type,offset:this.i32(p+24n),static:!!(bits&16)});}
  this.fields.set(k,fields);return fields;
 }
 field(k:bigint,name:string):{field:Field;owner:bigint}{
  for(let depth=0;k&&depth<64;depth++,k=this.ptr(k+88n)){
   const f=this.getFields(k).find(f=>f.name===name||f.name===`<${name}>k__BackingField`);if(f)return {field:f,owner:k};
  }throw Error('Field not found: '+name);
 }
 typeClass(type:bigint){
  const data=this.ptr(type),kind=this.bytes(type+10n,1)[0];
  if(kind===21){const k=this.ptr(data+24n);if(!k)throw Error('Generic class uninitialized');return k;}
  const width=this.metadata.typeIndexWidth;
  const index=this.typeIndices.get(this.bytes(data+8n,width).readUIntLE(0,width));if(index===undefined)throw Error('Type handle invalid');
  const k=this.ptr(this.table+BigInt(index*8));if(!k)throw Error('Value class uninitialized');return k;
 }
 decode(a:bigint,type:bigint):any{
  const bits=this.bytes(type+8n,4).readUInt32LE(),kind=(bits>>>16)&255;
  switch(kind){
   case 2:return !!this.bytes(a,1)[0];case 3:return this.bytes(a,2).readUInt16LE();
   case 4:return this.bytes(a,1).readInt8();case 5:return this.bytes(a,1)[0];
   case 6:return this.bytes(a,2).readInt16LE();case 7:return this.bytes(a,2).readUInt16LE();
   case 8:return this.i32(a);case 9:return this.bytes(a,4).readUInt32LE();
   case 10:case 11:{const v=kind===10?this.bytes(a,8).readBigInt64LE():this.ptr(a);const n=Number(v);return Number.isSafeInteger(n)?n:v.toString();}
   case 12:return this.bytes(a,4).readFloatLE();case 13:return this.bytes(a,8).readDoubleLE();
   case 17:case 21:if(kind===17||bits>>>31){const k=this.typeClass(type),f=this.getFields(k).find(f=>f.name==='value__');return f?this.decode(a+BigInt(f.offset-16),f.type):new OwnedRef(this,a,k,false,true);}break;
   case 14:case 18:case 20:case 28:case 29:break;
   default:throw Error('Unsupported field type '+kind);
  }
  return this.object(this.ptr(a));
 }
 object(a:bigint):any{
  if(!a)return null;const k=this.ptr(a),name=this.name(k);
  if(name==='System.String'){const n=this.i32(a+16n);if(n<0||n>65536)throw Error('String length invalid');return n?this.bytes(a+20n,n*2).toString('utf16le'):'';}
  const value=this.bytes(k+40n,4).readUInt32LE()>>>31;
  if(value)return this.decode(a+16n,k+32n);
  return new OwnedRef(this,a,k);
 }
}
export class OwnedRef {
 constructor(private c:OwnedContext,private a:bigint,private k:bigint,private staticOnly=false,private inline=false){}
 getClassName(){return this.c.name(this.k);}
 getBaseAddress(){const v=Number(this.a);if(!Number.isSafeInteger(v))throw Error('Address exceeds JS precision');return v;}
 get(name:string):any{const {field:f,owner}=this.c.field(this.k,name);if(f.offset<0)throw Error('Unsupported field storage');if(this.staticOnly&&!f.static)throw Error('Instance field on class');const base=f.static?this.c.ptr(owner+184n):this.a;if(!base)throw Error('Static field uninitialized');return this.c.decode(base+BigInt(f.offset-(this.inline&&!f.static?16:0)),f.type);}
 at(index:number):any{const n=this.c.ptr(this.a+24n);if(!Number.isInteger(index)||index<0||BigInt(index)>=n||n>100000n)throw Error('Array index invalid');const element=this.c.ptr(this.k+64n),stride=this.c.i32(this.k+260n);if(stride<1||stride>65536)throw Error('Array stride invalid');return this.c.decode(this.a+32n+BigInt(index*stride),element+32n);}
}
