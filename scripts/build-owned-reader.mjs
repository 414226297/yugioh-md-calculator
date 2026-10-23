import {execFileSync} from 'node:child_process';
import {mkdirSync,existsSync,copyFileSync,statSync} from 'node:fs';
import path from 'node:path';
if(process.platform!=='win32')throw Error('Windows required');
const compiler=path.join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe');
if(!existsSync(compiler))throw Error('64-bit .NET Framework compiler not found');
const source=path.resolve('native/reader/MemoryHost.cs'),output=path.resolve('dist/reader/owned/MD.MemoryHost.exe');
// TypeScript-only changes do not require replacing an in-use memory helper.
if(!existsSync(output)||statSync(output).mtimeMs<statSync(source).mtimeMs){
 mkdirSync('local-data/owned-reader',{recursive:true});
 execFileSync(compiler,['/nologo','/target:exe','/platform:x64','/optimize+','/r:System.Web.Extensions.dll','/out:'+path.resolve('local-data/owned-reader/MD.MemoryHost.exe'),source],{stdio:'inherit',windowsHide:true});
 mkdirSync('dist/reader/owned',{recursive:true});copyFileSync('local-data/owned-reader/MD.MemoryHost.exe',output);
}
