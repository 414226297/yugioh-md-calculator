export type Ref = {get:(key:string)=>any;getClassName:()=>string;getBaseAddress?:()=>number};
export function list(ref:Ref|null,max=10000):any[]{
 if(!ref)return [];
 const n=ref.get('_size');
 if(!Number.isInteger(n)||n<0||n>max)throw Error('列表长度异常，需要重新读取');
 const items=ref.get('_items');return Array.from({length:n},(_,i)=>items.at(i));
}
export function dictionary(ref:Ref):Map<string,any>{
 let n,entries;
 try{n=ref.get('_count');entries=ref.get('_entries');}catch{n=ref.get('count');entries=ref.get('entries');}
 if(!Number.isInteger(n)||n<0||n>10000)throw Error('字典长度异常');
 const result=new Map<string,any>();
 for(let i=0;i<n;i++){const e=entries.at(i),key=e.get('key');if(key!==null&&key!==undefined)result.set(String(key),e.get('value'));}
 return result;
}
