import {spawn,type ChildProcess} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
export interface GameWindow {active:boolean;pid?:number;x?:number;y?:number;width?:number;height?:number;click?:number;clickX?:number;clickY?:number}
export class WindowTracker {
 private child:ChildProcess|null=null;
 constructor(private receive:(frame:GameWindow)=>void){}
 start(){
  if(this.child||process.platform!=='win32')return;
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./window-tracker.ps1',import.meta.url))],{windowsHide:true,stdio:['ignore','pipe','ignore']});
  this.child=child;
  createInterface({input:child.stdout!}).on('line',line=>{try{const frame=JSON.parse(line);if(typeof frame.active==='boolean')this.receive(frame);}catch{}});
  const failed=()=>{if(this.child===child){this.child=null;this.receive({active:false});}};
  child.on('error',failed);child.on('exit',failed);
 }
 stop(){const child=this.child;this.child=null;child?.kill();this.receive({active:false});}
}
