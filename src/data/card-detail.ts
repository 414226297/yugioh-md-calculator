import type {CatalogFetch} from './download-catalog.js';
export interface CardDetail {id:number;password:number;name:string;types:string;description:string;image:string;source:string}
export function parseCardDetail(raw:any,id:number,password:number):CardDetail {
  if(raw?.id!==password||raw?.cid!==id||typeof raw?.text?.desc!=='string'||typeof raw?.text?.types!=='string')throw Error('卡片资料不匹配或缺失');
  const name=raw.text.md_name||raw.text.sc_name||raw.text.name;
  if(typeof name!=='string'||!name||raw.text.desc.length>30000||raw.text.types.length>2000)throw Error('卡片资料格式无效');
  return {id,password,name,types:raw.text.types,description:raw.text.desc,image:`https://cdn.233.momobako.com/ygopro/pics/${password}.jpg!half`,source:`https://ygocdb.com/card/${password}`};
}
export async function downloadCardDetail(id:number,password:number,fetcher:CatalogFetch):Promise<CardDetail>{
  if(!Number.isInteger(id)||id<=0||!Number.isInteger(password)||password<=0||password>=1000000000)throw Error('卡片编号无效，请更新卡片属性后重试');
  const url=`https://ygocdb.com/api/v0/card/${password}`;
  const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(!response.ok||response.url&&response.url!==url)throw Error('卡片资料暂时无法获取，请重试');
  return parseCardDetail(await response.json(),id,password);
}
