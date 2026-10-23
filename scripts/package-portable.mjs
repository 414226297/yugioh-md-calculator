import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {cpSync,mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

if(process.platform!=='win32'||process.arch!=='x64')throw Error('此打包入口仅支持 Windows x64');
const root=fileURLToPath(new URL('../',import.meta.url));
const pkg=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
const executable=createRequire(import.meta.url)('electron');
const runtime=path.dirname(executable);
if(!existsSync(executable))throw Error('Electron 运行环境未下载完整');
const release=path.join(root,'release');mkdirSync(release,{recursive:true});
const name=`md-cannon-assistant-${pkg.version}-win-x64-${Date.now()}`;
const build=path.join(root,'local-data','portable-build',name);mkdirSync(build,{recursive:true});
const output=path.join(build,name);
// Copy only the official runtime and compiled first-party files. Never copy the workspace.
cpSync(runtime,output,{recursive:true,dereference:true});
renameSync(path.join(output,'electron.exe'),path.join(output,'MD-Assistant.exe'));
renameSync(path.join(output,'LICENSE'),path.join(output,'LICENSE.electron.txt'));
cpSync(path.join(root,'LICENSE'),path.join(output,'LICENSE'));
const appDir=path.join(output,'resources','app');mkdirSync(appDir,{recursive:true});
const appPackage={name:pkg.name,version:pkg.version,description:pkg.description,license:pkg.license,type:pkg.type,main:pkg.main,private:true};
writeFileSync(path.join(appDir,'package.json'),JSON.stringify(appPackage,null,2)+'\n');
function collect(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?collect(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
const compiled=collect(path.join(root,'src')).filter(p=>p.endsWith('.ts')&&!p.endsWith('.d.ts')).map(p=>path.relative(path.join(root,'src'),p).replace(/\.ts$/,'.js'));
compiled.push('reader/owned/MD.MemoryHost.exe','desktop/preload.cjs','desktop/overlay-preload.cjs','desktop/window-tracker.ps1','ui/index.html','ui/style.css','ui/overlay.html','ui/overlay.css');
compiled.push(...collect(path.join(root,'src','ui','assets')).map(p=>path.relative(path.join(root,'src'),p)));
for(const relative of compiled){
  const source=path.join(root,'dist',relative),destination=path.join(appDir,'dist',relative);
  if(!existsSync(source))throw Error(`缺少构建文件 ${relative}，请先运行 pnpm run build`);
  mkdirSync(path.dirname(destination),{recursive:true});cpSync(source,destination);
}
writeFileSync(path.join(output,'使用说明.txt'),[
 'MD助手 Windows x64 便携版',
 '',
 '1. 对外提供一个EXE，可单独复制到任意普通文件夹或桌面。',
 '2. 双击EXE自动准备运行文件，无需手动解压或安装 Node.js、pnpm 或 Codex。',
 '3. 默认使用自有只读后端，无需安装 Untapped；仅支持已适配的 MD 版本。',
 '   如切换到兼容后端，则需要本机 Untapped 模块。',
 '4. 本机验证的 Unity 版本为6000.0.61f1。游戏/读取模块更新后需要重新验证，',
 '   不保证所有版本都能读取。出现待核对或读取失败时，不要沿用旧结果。',
 '5. 首次启动联网获取公开卡片属性；没有缓存且无法下载时，计算需要等待。',
 '6. 对战准备页面自动识别已知牌组；首次缺少卡表时打开牌组编辑界面获取。',
 '7. 配置和牌组缓存保存于当前用户 %APPDATA%\\md-cannon-assistant。',
 '   程序运行文件自动缓存到 %LOCALAPPDATA%\\md-cannon-assistant\\portable。',
 '',
 '此包不包含第三方读取模块、个人牌组、历史对局、测试结果或Git元数据。',
 '本项目采用MIT许可证；Electron及Chromium许可文件一并保留。'
].join('\r\n'),'utf8');
writeFileSync(path.join(output,'PORTABLE-INFO.json'),JSON.stringify({app:pkg.name,version:pkg.version,platform:'win32',arch:'x64',electron:readFileSync(path.join(runtime,'version'),'utf8').trim(),nativeReaderBundled:false,ownedReaderBundled:true,compiledFiles:compiled.map(p=>p.replaceAll('\\','/'))},null,2)+'\n');
const run=promisify(execFile),archive=path.join(build,'payload.zip');
await run('tar.exe',['-a','-c','-f',archive,'-C',build,name],{windowsHide:true,maxBuffer:1024*1024});
async function sha256(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
const payloadHash=await sha256(archive),icuHash=await sha256(path.join(output,'icudtl.dat'));
const launcher=path.join(build,'Launcher.cs');
writeFileSync(launcher,readFileSync(path.join(root,'native','portable','Launcher.cs'),'utf8').replaceAll('__PAYLOAD_SHA256__',payloadHash).replaceAll('__PAYLOAD_ROOT__',name).replaceAll('__ICU_SHA256__',icuHash).replaceAll('__ASSEMBLY_VERSION__',`${pkg.version}.0`));
const compiler=path.join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe');
if(!existsSync(compiler))throw Error('缺少64位.NET Framework编译器');
const artifact=path.join(release,`${name}.exe`);
await run(compiler,['/nologo','/target:winexe','/platform:x64','/optimize+','/r:System.Windows.Forms.dll','/r:System.IO.Compression.dll','/r:System.IO.Compression.FileSystem.dll',`/resource:${archive},Payload.zip`,`/out:${artifact}`,launcher],{windowsHide:true,maxBuffer:1024*1024});
const digest=await sha256(artifact);
writeFileSync(path.join(build,'build.json'),JSON.stringify({artifact,payloadHash,sha256:digest},null,2)+'\n');
console.log(`单文件EXE：${artifact}\nSHA256：${digest}`);
