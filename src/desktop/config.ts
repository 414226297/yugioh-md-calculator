import path from 'node:path';
export interface Config { modulePath:string; unityVersion:string; interval:number; width:number; height:number }
export const defaults = ():Config=>({modulePath:path.join(process.env.LOCALAPPDATA??'', 'Programs/untapped-companion/resources/app.asar.unpacked/node_modules/untapped-scry/lib/binding/napi-v5/untapped-scry.node'),unityVersion:'6000.0.61f1',interval:500,width:360,height:850});
export function validateConfig(c:Config):Config {
  if(typeof c.modulePath!=='string'||!path.isAbsolute(c.modulePath)||!c.modulePath.endsWith('.node'))throw Error('请选择读取模块的绝对 .node 文件路径');
  if(!/^\d+\.\d+\.\d+[a-z]\d+$/.test(c.unityVersion))throw Error('Unity版本格式无效');
  if(!Number.isInteger(c.interval)||c.interval<250||c.interval>2000)throw Error('刷新间隔必须为250至2000毫秒');
  if(!Number.isInteger(c.width)||c.width<320||c.width>700||!Number.isInteger(c.height)||c.height<480||c.height>1600)throw Error('窗口尺寸超出允许范围');
  return {...c};
}
