/** Original bounded parser for fixed-width IL2CPP metadata v31.
 * Format reference: Cpp2IL metadata structure definitions (see native/reader/README.md).
 * This reads names and type indices, never native addresses or hidden card identities. */
export class Metadata31 {
 private strings:{offset:number;size:number};
 private types:{offset:number;size:number};
 private fields:{offset:number;size:number};
 constructor(private bytes:Buffer){
  if(bytes.length<256||bytes.readUInt32LE(0)!==0xfab11baf)throw Error('Invalid IL2CPP metadata');
  if(bytes.readInt32LE(4)!==31)throw Error('Only metadata v31 is supported');
  this.strings=this.section(2);this.fields=this.section(11);this.types=this.section(19);
  if(this.types.size%88||this.fields.size%12)throw Error('Unsupported metadata record sizes');
 }
 private section(index:number){
  const offset=this.bytes.readUInt32LE(8+index*8),size=this.bytes.readUInt32LE(12+index*8);
  if(offset<256||offset>this.bytes.length||size>this.bytes.length-offset)throw Error('Metadata section out of bounds');
  return {offset,size};
 }
 string(index:number){
  if(!Number.isInteger(index)||index<0||index>=this.strings.size)throw Error('Metadata string index out of bounds');
  const start=this.strings.offset+index,end=this.bytes.indexOf(0,start);
  if(end<start||end>=this.strings.offset+this.strings.size||end-start>65536)throw Error('Invalid metadata string');
  return this.bytes.toString('utf8',start,end);
 }
 get typeCount(){return this.types.size/88;}
 getType(index:number){
  if(!Number.isInteger(index)||index<0||index>=this.typeCount)throw Error('Type index out of bounds');
  const p=this.types.offset+index*88,b=this.bytes;
  const name=this.string(b.readInt32LE(p)),namespace=this.string(b.readInt32LE(p+4));
  const start=b.readInt32LE(p+32),count=b.readUInt16LE(p+68);
  if(count&&(start<0||start+count>this.fields.size/12))throw Error('Field range out of bounds');
  const fields=Array.from({length:count},(_,i)=>{const q=this.fields.offset+(start+i)*12;return {index:start+i,name:this.string(b.readInt32LE(q)),typeIndex:b.readInt32LE(q+4),token:b.readUInt32LE(q+8)};});
  return {index,name,namespace,fullName:namespace?namespace+'.'+name:name,byvalTypeIndex:b.readInt32LE(p+8),declaringTypeIndex:b.readInt32LE(p+12),parentTypeIndex:b.readInt32LE(p+16),token:b.readUInt32LE(p+84),fields};
 }
 find(fullName:string){const result=[];for(let i=0;i<this.typeCount;i++){const type=this.getType(i);if(type.fullName===fullName)result.push(type);}return result;}
}
