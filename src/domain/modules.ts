export const modules = [
 {id:'summary',label:'双方手牌与场上合计',selector:'.scene-summary'},
 {id:'plans',label:'联栗炮方案区',selector:'#plans'},
 {id:'banished',label:'已在除外区的联栗炮组件',selector:'.banished-stock'},
 {id:'hand',label:'对方已公开手牌',selector:'#public-hand'},
 {id:'backrow',label:'对方盖放魔陷情报',selector:'#opponent-backrow'}
] as const;
export type ModuleId=typeof modules[number]['id'];
export function validateModules(value:unknown):ModuleId[]{
 if(!Array.isArray(value)||value.length>modules.length||value.some(id=>!modules.some(m=>m.id===id))||new Set(value).size!==value.length)throw Error('模块选择无效');
 return [...value] as ModuleId[];
}

export const defaultSidebarModules:ModuleId[]=['summary','hand','backrow','plans','banished'];
export function toggleModule(current:ModuleId[],id:ModuleId,enabled:boolean):ModuleId[]{
 validateModules(current);validateModules([id]);
 return enabled?(current.includes(id)?[...current]:[...current,id]):current.filter(value=>value!==id);
}
