import type {Deck,Inventory,Move,Snapshot,Stock} from './model.js';
const movementActions=new Set([2,3,4,5,6,7,8,9,13,14,15,18,20,21,22,24,25,26,27,28,29,33,34,35,36,39,49,51]);
const nonMovement=new Set([0,1,10,11,12,16,17,19,23,30,31,32,37,38,40]);
export interface Checkpoint { session:string; cursor:number; inventory:Inventory }
export function applyMove(inv:Inventory,m:Move,myTeam:number) {
  if(!m.affectsInventory||m.player!==myTeam||nonMovement.has(m.action))return;
  const invalidate=(reason:string)=>{inv.quality='unknown';if(!inv.reasons.includes(reason))inv.reasons.push(reason);};
  if(!movementActions.has(m.action)){invalidate(`未知移动动作 ${m.action}，请核对库存`);return;}
  if(m.to===null){invalidate('移动目的区域缺失');return;}
  const source=m.from===14?inv.extra:m.from===17?inv.banished:null;
  const target=m.targetPlayer===myTeam?(m.to===14?inv.extra:m.to===17?inv.banished:null):null;
  if(source===target&&source)return;
  let face:Stock['face']=m.face;
  if(source){
    const choices=source.filter(s=>s.id===m.cardId&&s.count>0);
    if(!choices.length){invalidate(`卡片 ${m.cardId} 的来源库存不足`);return;}
    if(choices.length>1){invalidate(`卡片 ${m.cardId} 的表里状态不明确`);return;}
    const item=choices[0];item.count--;face=item.face;
  }
  if(target){
    // Ordinary extra-deck fusion/xyz entries return face-up in our internal known-card inventory;
    // this flag denotes known usable identity, not the physical face-down extra-deck pile.
    const destinationFace=m.to===14?'up':m.face;
    const item=target.find(s=>s.id===m.cardId&&s.face===destinationFace);
    if(item)item.count++;else target.push({id:m.cardId,count:1,face:destinationFace});
  }
}
export function rebuildInventory(deck:Deck,snapshot:Snapshot,checkpoint?:Checkpoint):Inventory {
  const checkpointValid=checkpoint?.session===snapshot.session;
  const inv:Inventory=checkpointValid?structuredClone(checkpoint!.inventory):{extra:Object.entries(deck.extra).map(([id,count])=>({id:+id,count,face:'up'})),banished:[],quality:'confirmed',reasons:[]};
  const reasons:string[]=[];
  if(!checkpointValid&&!snapshot.completeLog)reasons.push('缺少完整开局日志，请核对库存');
  if(checkpointValid&&snapshot.logLength<checkpoint!.cursor)reasons.push('日志已重置，请重新核对库存');
  const seen=new Set<string>();
  for(const m of [...snapshot.moves].sort((a,b)=>a.index-b.index)){
    if(checkpointValid&&m.index<checkpoint!.cursor||seen.has(m.key))continue;
    seen.add(m.key);applyMove(inv,m,snapshot.myTeam);
  }
  const sum=(items:Stock[])=>items.reduce((a,s)=>a+s.count,0);
  if(snapshot.extraCount===null||sum(inv.extra)!==snapshot.extraCount)reasons.push('额外牌组数量与读取结果不一致');
  if(snapshot.banishedCount===null||sum(inv.banished)!==snapshot.banishedCount)reasons.push('除外区数量与读取结果不一致');
  if(inv.banished.some(s=>s.count>0&&s.face==='unknown'))reasons.push('除外卡片的表里状态需要核对');
  inv.extra=inv.extra.filter(s=>s.count>0);inv.banished=inv.banished.filter(s=>s.count>0);
  inv.reasons=[...new Set([...inv.reasons,...reasons])];if(inv.reasons.length)inv.quality='unknown';
  return inv;
}
export function validateStock(items:unknown):Stock[] {
  if(!Array.isArray(items)||items.length>200)throw Error('库存格式错误');
  const seen=new Set<string>();
  for(const s of items){
    if(!Number.isInteger(s.id)||s.id<=0||!Number.isInteger(s.count)||s.count<0||s.count>60||!['up','down','unknown'].includes(s.face))throw Error('库存编号、数量或状态无效');
    const key=`${s.id}:${s.face}`;if(seen.has(key))throw Error('库存存在重复行');seen.add(key);
  }
  return structuredClone(items);
}
