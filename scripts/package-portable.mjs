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
const output=path.join(release,name);
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
compiled.push('desktop/preload.cjs','desktop/overlay-preload.cjs','desktop/window-tracker.ps1','ui/index.html','ui/style.css','ui/overlay.html','ui/overlay.css');
compiled.push(...collect(path.join(root,'src','ui','assets')).map(p=>path.relative(path.join(root,'src'),p)));
for(const relative of compiled){
  const source=path.join(root,'dist',relative),destination=path.join(appDir,'dist',relative);
  if(!existsSync(source))throw Error(`缺少构建文件 ${relative}，请先运行 pnpm run build`);
  mkdirSync(path.dirname(destination),{recursive:true});cpSync(source,destination);
}
writeFileSync(path.join(output,'使用说明.txt'),[
 'MD助手 Windows x64 便携版',
 '',
 '1. 将整个ZIP解压到普通文件夹；不要直接在压缩软件内运行。',
 '2. 双击 MD-Assistant.exe，无需安装 Node.js、pnpm 或 Codex。',
 '3. 自动读取仍需本机已有兼容的 Untapped Companion 原生模块及 MD。',
 '   程序自动查找常见安装位置；未找到时，在设置中填写本机 .node 路径。',
 '4. 本机验证的 Unity 版本为6000.0.61f1。游戏/读取模块更新后需要重新验证，',
 '   不保证所有版本都能读取。出现待核对或读取失败时，不要沿用旧结果。',
 '5. 首次启动联网获取公开卡片属性；没有缓存且无法下载时，计算需要等待。',
 '6. 对战准备页面自动识别已知牌组；首次缺少卡表时打开牌组编辑界面获取。',
 '7. 运行数据保存于当前用户 %APPDATA%\\md-cannon-assistant，不会写回解压目录。',
 '',
 '此包不包含第三方读取模块、个人牌组、历史对局、测试结果或Git元数据。',
 '本项目采用MIT许可证；Electron及Chromium许可文件一并保留。'
].join('\r\n'),'utf8');
writeFileSync(path.join(output,'PORTABLE-INFO.json'),JSON.stringify({app:pkg.name,version:pkg.version,platform:'win32',arch:'x64',electron:readFileSync(path.join(runtime,'version'),'utf8').trim(),nativeReaderBundled:false,compiledFiles:compiled.map(p=>p.replaceAll('\\','/'))},null,2)+'\n');
const archive=path.join(release,`${name}.zip`);
await promisify(execFile)('tar.exe',['-a','-c','-f',archive,'-C',release,name],{windowsHide:true,maxBuffer:1024*1024});
const hash=createHash('sha256');for await(const chunk of createReadStream(archive))hash.update(chunk);
writeFileSync(`${archive}.sha256`,`${hash.digest('hex')}  ${path.basename(archive)}\n`);
console.log(`便携包：${archive}\nSHA256：${archive}.sha256`);
