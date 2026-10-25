import {defaultSidebarModules,type ModuleId} from '../domain/modules.js';
import {targetKinds} from '../domain/model.js';
import {groupStock} from '../domain/solver.js';
import type {DuelStore} from '../domain/store.js';
import type {Config} from '../desktop/config.js';
export type SidebarView=ReturnType<DuelStore['view']>&{notice?:string;config:Config};
export function renderSidebar(state:SidebarView,order:ModuleId[]=defaultSidebarModules){
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const val=(n:number|null)=>n===null?'—':String(n);
const unit=(kind:string)=>kind==='rank'?'阶':'星';
const button=(action:string,text:string,cls='')=>`<button data-action="${action}" class="${cls}">${text}</button>`;
function cardName(id:number){return state.catalog[id]?.name??`卡片 ${id}`;}
function cardLabel(id:number){const category=state.catalog[id]?.category;const label=category==='monster'?'怪兽':category==='spell'?'魔法':category==='trap'?'陷阱':'类别待确认';return `<span class="card-name">${esc(cardName(id))}</span><small class="card-category ${category??'unknown'}">${label}</small>`;}
const slotName=(slot:number)=>slot===12?'场地区':`魔陷区域 ${12-slot}`;
function backrowPanel(){
 const b=state.backrow;
 const name=(id:number)=>`<button class="small" data-card-detail="${id}">${cardLabel(id)}</button>`;
 const cell=(slot:number)=>{
  const c=b.cards.find(c=>c.slot===slot),known=c?.confirmedId&&!b.uncertain&&!c.positionChanged;
  const category=known?state.catalog[c.confirmedId!]?.category:undefined;
  const label=!c?(b.publicSlots.includes(slot)?'公开':b.count===null?'—':'空'):c.positionChanged?'变动':known?(category?{spell:'魔',trap:'陷',monster:'怪'}[category]:'卡'):'未知';
  return `<button class="backrow-cell ${c?'set-card':'empty-slot'} ${category??''}" data-set-slot="${slot}" ${!c?'disabled':''} aria-label="${slotName(slot)}：${label}"><small>${slot===12?'场地':12-slot}</small><b>${label}</b></button>`;
 };
 const pending=b.cards.filter(c=>!c.confirmedId||b.uncertain||c.positionChanged);
 const ids=[...new Set(pending.flatMap(c=>c.candidates))];
 return `<section class="panel" id="opponent-backrow"><div class="panel-title"><h2>对方盖放魔陷</h2><div class="panel-tools"><span class="badge">${b.count===null?'数量待确认':`${b.count} 张`}</span></div></div><div class="backrow-grid">${[11,10,9,8,7].map(cell).join('')}</div>${pending.length?`<div class="backrow-candidates"><small class="muted">${pending.map(c=>c.slot===12?'场地':12-c.slot).join('、')} 区可能是</small><div class="actions">${ids.map(name).join('')||'<span class="muted">暂无已知候选</span>'}</div></div>`:''}</section>`;
}

 const c=state.counts;const targets=targetKinds(state.monsters);
 const plans=state.result.plans.map((p,i)=>`<section class="panel plan"><h3>方案 ${i+1}</h3><p class="caption">除外自己的</p><div class="formula"><div class="number-card">2 × <strong>${p.rank}</strong><small>阶 超量</small></div><span class="plus">+</span><div class="number-card fusion"><strong>${p.level}</strong><small>星 融合</small></div></div><p class="caption">选择对手场上的</p><div class="number-card target"><strong>${p.target}</strong><small>${unit(p.targetKind)} 怪兽</small></div>${p.usesPrevious?`<details><summary>需要使用原已除外卡</summary>返回 ${p.returnRank}阶超量 ＋ ${p.returnLevel}星融合</details>`:''}</section>`).join('');
 const chips=(kind:'xyz'|'fusion')=>[...groupStock(state.inventory.banished,state.catalog,kind)].sort((a,b)=>a[0]-b[0]).map(([v,n])=>`<span class="chip ${kind==='fusion'?'fusion':''}">${v}${kind==='xyz'?'阶':'星'} ×${n}</span>`).join('')||'<span class="muted">暂无已确认卡片</span>';
 const panels:Record<ModuleId,string>={summary:` <section class="panel scene-summary"><div class="panel-title"><h2>双方手牌与场上合计</h2></div><div class="count-content"><div class="total" id="total">${val(state.total)}</div><table class="counts"><thead><tr><th></th><th>我方</th><th>对方</th></tr></thead><tbody><tr><th>手牌</th><td>${val(c.myHand)}</td><td>${val(c.opponentHand)}</td></tr><tr><th>场上</th><td>${val(c.myField)}</td><td>${val(c.opponentField)}</td></tr></tbody></table></div>${state.manual?'<span class="badge">含手动核对值</span>':''}
 <div class="summary-targets"><div class="panel-title"><h2>对方星数 / 阶级</h2></div><div class="tiles">${targets.map(t=>`<div class="tile ${t.kind}" aria-label="${t.value}${unit(t.kind)}"><b>${t.value}</b><small>${unit(t.kind)}</small></div>`).join('')||'<span class="muted">暂无可匹配数值</span>'}</div></div></section>`,hand:`
 <section class="panel" id="public-hand"><div class="panel-title"><h2>对方已公开手牌</h2><div class="panel-tools"><span class="badge">已确认 ${state.publicHand.cards.reduce((n,c)=>n+c.count,0)} 张</span></div></div>${state.publicHand.cards.map(c=>`<button data-card-detail="${c.id}" class="list-row public-hand-card"><span>${cardLabel(c.id)}</span><b>×${c.count}</b></button>`).join('')}${state.publicHand.uncertainCards.length?`<div class="public-hand-pending"><p class="warning">剩余手牌候选</p>${state.publicHand.uncertainCards.map(c=>`<button data-card-detail="${c.id}" class="list-row public-hand-card uncertain"><span>${cardLabel(c.id)}</span><b>最多 ×${c.count}</b></button>`).join('')}</div>`:''}<p class="muted">${esc(state.publicHand.reason)}</p></section>`,backrow:backrowPanel(),plans:`
 <div id="plans">${plans||`<section class="panel empty"><span class="symbol">${state.result.status==='none'?'≠':'!'}</span><strong>${state.result.status==='none'?'当前无匹配组合':'等待核对 / 更新'}</strong><p class="muted">${esc(state.result.reason)}</p></section>`}</div>`,banished:`
 <section class="panel banished-stock"><div class="panel-title"><h2>已在除外区</h2></div><div class="stock-row"><span>超量</span><div class="chips">${chips('xyz')}</div></div><div class="stock-row"><span>融合</span><div class="chips">${chips('fusion')}</div></div>${state.inventory.quality==='unknown'?'<small class="warning">部分库存待核对，不作为确定材料</small>':''}</section>`};
 return `${state.notice?`<div class="notice">${button('dismissNotice','×','small')}${esc(state.notice)}</div>`:''}`+order.map(id=>panels[id]).join('');
}
