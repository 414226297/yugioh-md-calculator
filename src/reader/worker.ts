import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NativeReader } from './native-reader.js';
import { emptyCounts, type Snapshot } from '../domain/model.js';
const exec=promisify(execFile);
let reader:NativeReader|null=null,pid=0,failures=0,turn=0;
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const send=(value:Snapshot)=>process.send?.(value);
const blank=(status:Snapshot['status'],reason:string):Snapshot=>({status,reason,session:null,timestamp:Date.now(),counts:emptyCounts(),monsters:[],myTeam:0,extraCount:null,banishedCount:null,moves:[],logLength:0,completeLog:false,deck:null});
async function discover() {
  const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-Process -Name masterduel -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"],{windowsHide:true,timeout:8000});
  const ids=stdout.trim().split(/\s+/).filter(Boolean).map(Number);
  if(ids.length>1)throw Error('发现多个MD进程，请保留一个');
  return ids[0]??0;
}
while(true){
  try {
    if(!reader||turn++%4===0){
      let found=0;
      try{found=await discover();}catch(e:any){if(e.code!==1)throw e;}
      if(found!==pid){pid=found;reader=null;}
      if(!pid){send(blank('waiting','等待 MD 启动'));await wait(2000);continue;}
      if(!reader)reader=new NativeReader(process.env.MD_SCRY_PATH!,pid,process.env.MD_UNITY_VERSION??'6000.0.61f1');
    }
    send(reader!.read());failures=0;
  }catch(error){send(blank('error',error instanceof Error?error.message:String(error)));reader=null;failures++;}
  await wait(Math.min(2000,Number(process.env.MD_INTERVAL??500)*(1+failures)));
}
