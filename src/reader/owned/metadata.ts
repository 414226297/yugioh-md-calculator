/** Original bounded parser for IL2CPP metadata v31 and v39.
 * Format reference: Cpp2IL metadata structure definitions (see native/reader/README.md).
 * This reads names and type indices, never native addresses or hidden card identities. */
export class Metadata31 {
 private version=31;
 private stride=88;
 private typeWidth=4;
 private genericWidth=4;
 private strings:{offset:number;size:number};
 private types:{offset:number;size:number};
 private fields:{offset:number;size:number};
 constructor(private bytes:Buffer){
  if(bytes.length<256||bytes.readUInt32LE(0)!==0xfab11baf)throw Error('Invalid IL2CPP metadata');
  this.version=bytes.readInt32LE(4);
  if(![31,39].includes(this.version))throw Error('Only metadata v31/v39 is supported');
  this.strings=this.section(2);this.fields=this.section(11);this.types=this.section(19);
  if(this.version===39){
   const count=(i:number)=>bytes.readUInt32LE(16+i*12);
   const interfaces=this.section(18),n=count(18);
   this.typeWidth=interfaces.size/n-4;
   if(![1,2,4].includes(this.typeWidth))throw Error('Invalid type index width');
   this.genericWidth=count(14)<=255?1:count(14)<=65535?2:4;
   this.stride=68+3*this.typeWidth+this.genericWidth;
   if(this.types.size!==count(19)*this.stride||this.fields.size!==count(11)*(8+this.typeWidth))throw Error('Invalid metadata counts');
  }
  if(this.types.size%this.stride||this.fields.size%(8+this.typeWidth))throw Error('Unsupported metadata record sizes');
 }
 private section(index:number){
  const offset=this.bytes.readUInt32LE(8+index*(this.version===39?12:8)),size=this.bytes.readUInt32LE(12+index*(this.version===39?12:8));
  if(offset<256||offset>this.bytes.length||size>this.bytes.length-offset)throw Error('Metadata section out of bounds');
  return {offset,size};
 }
 string(index:number){
  if(!Number.isInteger(index)||index<0||index>=this.strings.size)throw Error('Metadata string index out of bounds');
  const start=this.strings.offset+index,end=this.bytes.indexOf(0,start);
  if(end<start||end>=this.strings.offset+this.strings.size||end-start>65536)throw Error('Invalid metadata string');
  return this.bytes.toString('utf8',start,end);
 }
 get typeCount(){return this.types.size/this.stride;}
 get typeIndexWidth(){return this.typeWidth;}
 getType(index:number){
  if(!Number.isInteger(index)||index<0||index>=this.typeCount)throw Error('Type index out of bounds');
  const p=this.types.offset+index*this.stride,b=this.bytes;
  const name=this.string(b.readInt32LE(p)),namespace=this.string(b.readInt32LE(p+4));
  const fieldAt=this.version===31?32:12+3*this.typeWidth+this.genericWidth;
  const start=b.readInt32LE(p+fieldAt),count=b.readUInt16LE(p+fieldAt+36);
  if(count&&(start<0||start+count>this.fields.size/(8+this.typeWidth)))throw Error('Field range out of bounds');
  const fields=Array.from({length:count},(_,i)=>{const q=this.fields.offset+(start+i)*(8+this.typeWidth);return {index:start+i,name:this.string(b.readInt32LE(q)),typeIndex:b.readUIntLE(q+4,this.typeWidth),token:b.readUInt32LE(q+4+this.typeWidth)};});
  return {index,name,namespace,fullName:namespace?namespace+'.'+name:name,byvalTypeIndex:b.readUIntLE(p+8,this.typeWidth),declaringTypeIndex:b.readUIntLE(p+8+this.typeWidth,this.typeWidth),parentTypeIndex:b.readUIntLE(p+8+2*this.typeWidth,this.typeWidth),token:b.readUInt32LE(p+this.stride-4),fields};
 }
 find(fullName:string){const result=[];for(let i=0;i<this.typeCount;i++){const type=this.getType(i);if(type.fullName===fullName)result.push(type);}return result;}
}
