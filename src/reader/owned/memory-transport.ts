import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
export class MemoryTransport {
 private child:ChildProcessWithoutNullStreams;
 private next=0;
 private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 readonly ready:Promise<{pid:number;protocol:number;fixture:string|null}>;
 constructor(executable:string,pid:number|'self-test') {
  this.child=spawn(executable,[pid==='self-test'?'--self-test':String(pid)],{windowsHide:true,stdio:'pipe'});
  let stderr='';this.child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-2048);});
  this.ready=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{reject(Error('Memory host startup timeout'));this.close();},5000);
   this.child.once('error',e=>{clearTimeout(timer);reject(e);this.fail(e);});
   this.child.once('exit',()=>{clearTimeout(timer);const e=Error(stderr||'Memory host exited');reject(e);this.fail(e);});
   createInterface({input:this.child.stdout}).on('line',line=>{
    try{
     const value=JSON.parse(line);
     if(value.ready){if(value.protocol!==1)throw Error('Unsupported memory protocol');clearTimeout(timer);resolve(value);return;}
     const p=this.pending.get(value.id);if(!p)return;
     clearTimeout(p.timer);this.pending.delete(value.id);
     if(value.ok)p.resolve(value.result);else p.reject(Error(value.error));
    }catch(e){reject(e);this.close();}
   });
  });
 }
 private fail(error:Error){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
 private async request(op:string,args:Record<string,unknown>={}) {
  await this.ready;if(this.child.exitCode!==null||this.child.killed)throw Error('Memory host closed');
  const id=++this.next;
  return new Promise<any>((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Memory request timeout'));this.close();},5000);
   this.pending.set(id,{resolve,reject,timer});
   this.child.stdin.write(JSON.stringify({id,op,...args})+'\n',e=>{if(e){this.fail(e);this.close();}});
  });
 }
 async read(address:bigint,length:number):Promise<Buffer>{
  if(address<65536n||address>0x7fffffffffffn||!Number.isInteger(length)||length<1||length>1048576)throw Error('Invalid read bounds');
  const data=Buffer.from(await this.request('read',{address:address.toString(),length}),'base64');
  if(data.length!==length)throw Error('Truncated memory response');return data;
 }
 async readMany(ranges:{address:bigint;length:number}[]):Promise<Buffer[]>{
  if(ranges.length>128||ranges.reduce((n,r)=>n+r.length,0)>1048576||ranges.some(r=>r.address<65536n||r.address>0x7fffffffffffn||!Number.isInteger(r.length)||r.length<1))throw Error('Invalid batch bounds');
  const values=await this.request('readMany',{ranges:ranges.map(r=>({...r,address:r.address.toString()}))});
  if(!Array.isArray(values)||values.length!==ranges.length)throw Error('Invalid batch response');
  return values.map((v:string,i:number)=>{const b=Buffer.from(v,'base64');if(b.length!==ranges[i].length)throw Error('Truncated batch response');return b;});
 }
 async modules():Promise<{name:string;address:string;size:number;path:string}[]>{return this.request('modules');}
 close(){this.fail(Error('Memory host closed'));this.child.kill();}
}
