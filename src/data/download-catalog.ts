import {parseCatalog} from './catalog.js';

export const catalogURL='https://ygomjson.untapped.gg/v1/latest/zh-cn/cards.json';
export function needsChineseCatalog(cache:unknown):boolean {
  const value=cache as {source?:unknown;cards?:unknown}|null;
  if(!value?.cards||typeof value.source!=='string')return true;
  if(Object.values(value.cards as Record<string,{category?:string;fieldSpell?:boolean;rarity?:string}>).some(c=>c.category==='spell'&&typeof c.fieldSpell!=='boolean'))return true;
  try{const url=new URL(value.source);return url.hostname!=='ygomjson.untapped.gg'||!/^\/v1\/[^/]+\/zh-cn\/cards\.json$/.test(url.pathname);}catch{return true;}
}
type CatalogResponse=Pick<Response,'ok'|'status'|'url'|'headers'|'json'>;
export type CatalogFetch=(url:string,options:{redirect:'manual';signal:AbortSignal})=>Promise<CatalogResponse>;
function checkedURL(value:string,base?:string):string {
  const url=new URL(value,base);
  if(url.protocol!=='https:'||url.hostname!=='ygomjson.untapped.gg'||url.username||url.password||url.port&&url.port!=='443')throw Error('卡片属性地址不受信任');
  return url.href;
}
export async function downloadCatalog(fetcher:CatalogFetch){
  let source=catalogURL;
  const signal=AbortSignal.timeout(20000);
  for(let redirects=0;redirects<=5;redirects++){
    const response=await fetcher(source,{redirect:'manual',signal});
    if([301,302,303,307,308].includes(response.status)){
      const target=response.headers.get('location');if(!target)throw Error('属性下载重定向缺少目标地址');
      source=checkedURL(target,source);continue;
    }
    if(!response.ok)throw Error(`属性下载失败 ${response.status}`);
    // Electron net.fetch can return a successful Response whose url is empty.
    // Redirects are followed explicitly above, so our current request URL is authoritative.
    if(response.url)checkedURL(response.url);
    const cards=parseCatalog(await response.json());
    if(Object.keys(cards).length<1000)throw Error('卡片数据库不完整');
    return {source,cards};
  }
  throw Error('属性下载重定向次数过多');
}
