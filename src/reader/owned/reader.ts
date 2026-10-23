import path from 'node:path';
import {MemoryTransport} from './memory-transport.js';
import {OwnedContext} from './context.js';
import {NativeReader} from '../native-reader.js';
/** Experimental explicit opt-in. A failure never silently loads a third-party module. */
export class OwnedReader {
 private constructor(private memory:MemoryTransport,private context:OwnedContext,private reader:NativeReader){}
 static async connect(executable:string,pid:number){
  const memory=new MemoryTransport(executable,pid);
  try{
   await memory.ready;
   const module=(await memory.modules()).find(m=>m.name.toLowerCase()==='masterduel.exe');if(!module)throw Error('Game executable not found');
   const metadata=path.join(path.dirname(module.path),'masterduel_Data','il2cpp_data','Metadata','global-metadata.dat');
   const context=await OwnedContext.create(memory,metadata);
   return new OwnedReader(memory,context,new NativeReader('',pid,'',context));
  }catch(e){memory.close();throw e;}
 }
 async read(){const snapshot=await this.context.run(()=>this.reader.read());return this.reader.finalizeOwned(snapshot);}
 close(){this.memory.close();}
}
