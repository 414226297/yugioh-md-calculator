import type {Card} from '../domain/model.js';
export function parseCatalog(raw: unknown): Record<number,Card> {
  if(!Array.isArray(raw))throw Error('卡片数据库格式错误');
  const result:Record<number,Card>={};
  for(const v of raw){
    // Official dataset includes a single empty id=0 sentinel; it is not a playable card.
    if(v.id===0&&v.name===''&&v.kind===0&&v.level===0)continue;
    if(!Number.isInteger(v.id)||v.id<=0||typeof v.name!=='string')throw Error('卡片数据库条目无效');
    const kind=[2,3,39,41,48,50,51].includes(v.kind)?'fusion':[22,23,34].includes(v.kind)?'xyz':'other';
    const value=kind==='other'?0:v.level;
    if(!Number.isInteger(value)||value<0||value>99)throw Error('卡片等级／阶级无效');
    result[v.id]={id:v.id,name:v.name,kind,value};
  }
  return result;
}
