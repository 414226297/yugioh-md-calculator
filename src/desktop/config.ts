import path from 'node:path';
import {existsSync} from 'node:fs';
export interface Config { modulePath:string; unityVersion:string; interval:number; width:number; height:number }
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
export const defaults = ():Config=>({modulePath:resolveModulePath(),unityVersion:'6000.0.61f1',interval:500,width:360,height:850});
export function validateConfig(c:Config):Config {
  if(typeof c.modulePath!=='string'||!path.isAbsolute(c.modulePath)||!c.modulePath.endsWith('.node'))throw Error('请选择读取模块的绝对 .node 文件路径');
  if(!/^\d+\.\d+\.\d+[a-z]\d+$/.test(c.unityVersion))throw Error('Unity版本格式无效');
  if(!Number.isInteger(c.interval)||c.interval<250||c.interval>2000)throw Error('刷新间隔必须为250至2000毫秒');
  if(!Number.isInteger(c.width)||c.width<320||c.width>700||!Number.isInteger(c.height)||c.height<480||c.height>1600)throw Error('窗口尺寸超出允许范围');
  return {...c};
}
