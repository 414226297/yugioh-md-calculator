import { countTotal, targetKinds, type Card, type Counts, type Inventory, type Monster, type Plan, type SolveResult, type Stock } from './model.js';
export function groupStock(stock: Stock[], catalog: Record<number, Card>, kind: 'xyz'|'fusion') {
  const grouped = new Map<number, number>();
  for (const s of stock) {
    const card = catalog[s.id];
    if (s.face === 'up' && s.count > 0 && card?.kind === kind && card.value > 0)
      grouped.set(card.value, (grouped.get(card.value) ?? 0) + s.count);
  }
  return grouped;
}
export function solve(counts: Counts, monsters: Monster[], inventory: Inventory, catalog: Record<number, Card>): SolveResult {
  const total = countTotal(counts);
  const invalidStock = [...inventory.extra,...inventory.banished].some(s => !Number.isInteger(s.count) || s.count < 0);
  const unknownCard = [...inventory.extra,...inventory.banished].some(s => s.count > 0 && (!catalog[s.id] || s.face === 'unknown'));
  if (total === null || inventory.quality === 'unknown' || invalidStock || unknownCard || monsters.some(m=>m.faceUp && m.kind !== 'none' && m.value === null))
    return {status:'uncertain',reason:inventory.reasons[0] ?? '数量、怪兽数值或库存需要核对',plans:[]};
  const targets = targetKinds(monsters);
  if (!targets.length) return {status:'none',reason:'对方没有可匹配的表侧怪兽数值',plans:[]};
  const xyz = groupStock(inventory.extra,catalog,'xyz'), fusion = groupStock(inventory.extra,catalog,'fusion');
  const oldXyz = groupStock(inventory.banished,catalog,'xyz'), oldFusion = groupStock(inventory.banished,catalog,'fusion');
  const plans: Plan[] = [];
  let initial = false;
  for (const [rank,qty] of xyz) {
    if (qty < 2) continue;
    const level = total - 2*rank;
    if (level <= 0 || !fusion.get(level)) continue;
    initial = true;
    const returnsX = new Set([...oldXyz.keys(),rank]), returnsF = new Set([...oldFusion.keys(),level]);
    for (const target of targets) for (const returnRank of returnsX) {
      const returnLevel = target.value-returnRank;
      if (returnLevel > 0 && returnsF.has(returnLevel)) plans.push({rank,level,targetKind:target.kind,target:target.value,returnRank,returnLevel,usesPrevious:returnRank!==rank || returnLevel!==level});
    }
  }
  const unique = [...new Map(plans.map(p=>[JSON.stringify(p),p])).values()].sort((a,b)=>Number(a.usesPrevious)-Number(b.usesPrevious)||a.target-b.target||a.rank-b.rank||a.returnRank-b.returnRank);
  return unique.length ? {status:'ready',reason:'仅核对数值与已知库存',plans:unique} : {status:'none',reason:initial?'无法同时满足两段数值条件':'当前额外牌组没有满足总数的三张卡组合',plans:[]};
}
