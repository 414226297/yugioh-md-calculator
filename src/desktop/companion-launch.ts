import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const run=promisify(execFile);
export function companionRunning(output:string):boolean {
 const names=output.split(/\r?\n/).flatMap(line=>{
  const match=/^"([^"]+)","\d+",/.exec(line.trim());return match?[match[1].toLowerCase()]:[];
 });
 if(!names.length)throw Error('无法确认 Untapped.gg 运行状态，请手动检查；本次未联动启动。');
 return names.some(name=>name==='untapped.gg companion.exe'||name==='untapped companion.exe');
}

export async function isCompanionRunning(){
 const {stdout}=await run(path.join(process.env.SystemRoot??'C:\\Windows','System32','tasklist.exe'),['/FO','CSV','/NH'],{windowsHide:true,timeout:5000,maxBuffer:4*1024*1024});
 return companionRunning(stdout);
}

function start(executable:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,[],{detached:true,stdio:'ignore',windowsHide:true});
  child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});
 });
}

/** Coalesce overlapping calls and never relaunch within the same assistant run. */
export function createCompanionLauncher(check=isCompanionRunning,launch=start){
 let pending:Promise<void>|undefined;
 return (resolveExecutable:()=>string):Promise<void>=>{
  if(pending)return pending;
  pending=(async()=>{
   let running:boolean;
   try{running=await check();}catch{throw Error('无法确认 Untapped.gg 运行状态，请手动检查；本次未联动启动。');}
   if(running)return;
   const executable=resolveExecutable();
   try{await launch(executable);}catch{throw Error('Untapped.gg 启动失败，请手动启动。');}
  })().catch(error=>{pending=undefined;throw error;});
  return pending;
 };
}
