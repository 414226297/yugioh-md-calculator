import {defaultUnityVersion} from '../reader/version.js';
import path from 'node:path';
import {validateModules,defaultSidebarModules,toggleModule,type ModuleId} from '../domain/modules.js';
import {existsSync} from 'node:fs';
export interface Config { launchUntapped?:boolean; readerBackend?:'companion'|'owned'; modulePath:string; unityVersion:string; interval:number; width:number; height:number; theme:'dark'|'light';overlayEnabled:boolean;handOverlayEnabled?:boolean;handOverlayStyle?:'label'|'thumbnail';backrowOverlayEnabled?:boolean;overlayOffsetX:number;overlayOffsetY:number;selectedModules?:ModuleId[];sidebarModules?:ModuleId[];infoOverlayEnabled?:boolean }
const moduleSuffix='resources/app.asar.unpacked/node_modules/untapped-scry/lib/binding/napi-v5/untapped-scry.node';
export function resolveModulePath(savedPath?:string,env:NodeJS.ProcessEnv=process.env,exists:(p:string)=>boolean=existsSync):string {
  if(env.MD_SCRY_PATH)return env.MD_SCRY_PATH;
  if(savedPath&&exists(savedPath))return savedPath;
  const candidates=[
    env.LOCALAPPDATA&&path.join(env.LOCALAPPDATA,'Programs/untapped-companion',moduleSuffix),
    env.ProgramFiles&&path.join(env.ProgramFiles,'untapped-companion',moduleSuffix),
    env.ProgramFiles&&path.join(env.ProgramFiles,'Untapped.gg Companion',moduleSuffix),
    env['ProgramFiles(x86)']&&path.join(env['ProgramFiles(x86)'],'untapped-companion',moduleSuffix)
  ].filter((p):p is string=>!!p);
  return candidates.find(p=>exists(p))??candidates[0]??path.resolve('untapped-companion',moduleSuffix);
}
export function dataDirectory(root:string,appData:string,packaged:boolean,testMode:boolean):string {
  return testMode?path.join(root,'test-results','app-data'):packaged?path.join(appData,'md-cannon-assistant'):path.join(root,'local-data');
}
export function redactLocalPaths(message:string):string {
  return message.replace(/[A-Z]:[\\/][^\r\n"'<>]*/gi,'<local-path>').replace(/\/(?:Users|home)\/[^\s/]+/g,'<user-home>');
}
export const defaults = ():Config=>({readerBackend:'owned',modulePath:resolveModulePath(),unityVersion:defaultUnityVersion,interval:500,width:300,height:850,theme:'dark',overlayEnabled:true,overlayOffsetX:0,overlayOffsetY:0});
export function validateConfig(c:Config):Config {
  if(c.launchUntapped!==undefined&&typeof c.launchUntapped!=='boolean')throw Error('联动启动设置无效');
  const selectedModules=validateModules(c.selectedModules??[]);
  if(c.handOverlayStyle!==undefined&&!['label','thumbnail'].includes(c.handOverlayStyle))throw Error('手牌浮窗样式无效');
  const sidebarModules=validateModules(c.sidebarModules??defaultSidebarModules);
  if(c.readerBackend!==undefined&&!['companion','owned'].includes(c.readerBackend))throw Error('读取后端无效');
  if(c.readerBackend!=='owned'&&(typeof c.modulePath!=='string'||!path.isAbsolute(c.modulePath)||!c.modulePath.endsWith('.node')))throw Error('请选择读取模块的绝对 .node 文件路径');
  if(!/^\d+\.\d+\.\d+[a-z]\d+$/.test(c.unityVersion))throw Error('Unity版本格式无效');
  if(!Number.isInteger(c.interval)||c.interval<250||c.interval>2000)throw Error('刷新间隔必须为250至2000毫秒');
  if(!Number.isInteger(c.width)||c.width<300||c.width>700||!Number.isInteger(c.height)||c.height<480||c.height>1600)throw Error('窗口尺寸超出允许范围');
  if(c.theme!==undefined&&!['dark','light'].includes(c.theme))throw Error('主题设置无效');
  if(c.overlayEnabled!==undefined&&typeof c.overlayEnabled!=='boolean')throw Error('浮窗开关无效');
  for(const value of [c.handOverlayEnabled,c.backrowOverlayEnabled,c.infoOverlayEnabled])if(value!==undefined&&typeof value!=='boolean')throw Error('浮窗开关无效');
  for(const value of [c.overlayOffsetX??0,c.overlayOffsetY??0])if(!Number.isFinite(value)||Math.abs(value)>10)throw Error('浮窗位置微调须在-10至10之间');
  const handOverlayEnabled=c.handOverlayEnabled??c.overlayEnabled??true,backrowOverlayEnabled=c.backrowOverlayEnabled??c.overlayEnabled??true;
  return {...c,launchUntapped:c.launchUntapped??false,handOverlayStyle:c.handOverlayStyle??'thumbnail',selectedModules,sidebarModules,infoOverlayEnabled:c.infoOverlayEnabled??true,readerBackend:c.readerBackend??'owned',theme:c.theme??'dark',overlayEnabled:handOverlayEnabled||backrowOverlayEnabled,handOverlayEnabled,backrowOverlayEnabled,overlayOffsetX:c.overlayOffsetX??0,overlayOffsetY:c.overlayOffsetY??0};
}

export function updateDisplayConfig(config:Config,value:{target:string;id?:ModuleId;enabled:boolean}):Config {
 if(!value||typeof value.enabled!=='boolean')throw Error('显示开关无效');
 const current=validateConfig(config);
 if(value.target==='sidebar'||value.target==='info'){
  validateModules([value.id]);
  const key=value.target==='sidebar'?'sidebarModules':'selectedModules';
  return validateConfig({...current,[key]:toggleModule(current[key]!,value.id!,value.enabled)});
 }
 if(!['infoOverlayEnabled','handOverlayEnabled','backrowOverlayEnabled'].includes(value.target))throw Error('显示开关无效');
 return validateConfig({...current,[value.target]:value.enabled});
}
