import {targetKinds,type Stock,type Monster} from '../domain/model.js';
import {groupStock} from '../domain/solver.js';
import type {DuelStore} from '../domain/store.js';
import type {CardDetail} from '../data/card-detail.js';
import type {Config} from '../desktop/config.js';
type View=ReturnType<DuelStore['view']>&{notice:string;catalogMessage:string;config:Config};
declare global {interface Window {cannon:{version:string;cardDetail:(id:number)=>Promise<{ok:boolean;detail?:CardDetail;error?:string}>;getState:()=>Promise<View>;command:(name:string,value?:unknown)=>Promise<{ok:boolean;error?:string}>;subscribe:(cb:(s:View)=>void)=>()=>void}}}
const api=window.cannon,content=document.querySelector<HTMLElement>('#content')!;
let state:View;let page='home';let stockDraft:{extra:Stock[];banished:Stock[]}|null=null;
let deckDraft:View['deck']=null;
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const val=(n:number|null)=>n===null?'—':String(n);
const unit=(kind:string)=>kind==='rank'?'阶':'星';
const button=(action:string,text:string,cls='')=>`<button data-action="${action}" class="${cls}">${text}</button>`;
function toast(message:string){const e=document.querySelector<HTMLElement>('#toast')!;e.textContent=message;e.hidden=false;setTimeout(()=>{e.hidden=true;},6000);}
async function cmd(name:string,value?:unknown){const r=await api.command(name,value);if(!r.ok){toast(r.error??'操作失败');return false;}state=await api.getState();return true;}
function navigate(next:string){page=next;if(next==='inventory')stockDraft=structuredClone({extra:state.inventory.extra,banished:state.inventory.banished});if(next==='editDeck')deckDraft=structuredClone(state.deck);render();content.scrollTop=0;}
function cardName(id:number){return state.catalog[id]?.name??`卡片 ${id}`;}
function cardLabel(id:number){const category=state.catalog[id]?.category;const label=category==='monster'?'怪兽':category==='spell'?'魔法':category==='trap'?'陷阱':'类别待确认';return `<span class="card-name">${esc(cardName(id))}</span><small class="card-category ${category??'unknown'}">${label}</small>`;}
const detailDialog=document.querySelector<HTMLDialogElement>('#card-detail')!;
let detailRequest=0,selectedCard=0,selectedSlot:number|null=null;
const slotName=(slot:number)=>slot===12?'场地区':`魔陷区域 ${12-slot}`;
function locationInfo(id:number,slot:number|null=null){
 const b=state.backrow,sets=b.cards.filter(s=>slot!==null?s.slot===slot:s.candidates.includes(id));
 if(!sets.length)return '<p class="muted">当前没有对应的盖放位置记录。</p>';
 return `${b.uncertain?'<p class="warning">位置状态待核对</p>':''}${sets.map(s=>`<section class="set-location"><h3>${slotName(s.slot)}</h3><p>${s.confirmedId&&!b.uncertain?'确定位置（依据公开信息）':'可能位置 · 尚不能确定身份'}</p><p>${s.searchedCandidates?.length?'包含公开检索的卡片；':'依据此前公开的手牌；'}候选：</p><div class="actions">${s.candidates.map(candidate=>`<button class="small" data-card-detail="${candidate}">${cardLabel(candidate)}${s.searchedCandidates?.includes(candidate)?' · 检索':''}</button>`).join('')||'<span class="muted">身份未知</span>'}</div>${s.unknownPossible?'<p class="muted">还可能是其他未确认的卡片。</p>':''}</section>`).join('')}`;
}
function detailHeader(id:number){return `<div class="panel-title"><h2 id="card-detail-title">${cardLabel(id)}</h2><button data-detail-close aria-label="关闭卡片资料">×</button></div><div id="card-location">${locationInfo(id)}</div>`;}
function showSetLocation(slot:number){
 selectedSlot=slot;selectedCard=0;detailRequest++;
 detailDialog.innerHTML=`<div class="panel-title"><h2 id="card-detail-title">盖放位置与候选</h2><button data-detail-close aria-label="关闭卡片资料">×</button></div><div id="card-location">${locationInfo(0,slot)}</div>`;
 if(!detailDialog.open)detailDialog.showModal();
}
function refreshLocation(){
 const node=detailDialog.querySelector('#card-location');
 if(detailDialog.open&&node){const html=locationInfo(selectedCard,selectedSlot);if(node.innerHTML!==html)node.innerHTML=html;}
}
async function showCardDetail(id:number){
 selectedCard=id;selectedSlot=null;const request=++detailRequest;
 detailDialog.innerHTML=detailHeader(id)+'<p role="status">正在加载卡片资料…</p>';
 if(!detailDialog.open)detailDialog.showModal();
 const result=await api.cardDetail(id).catch(()=>({ok:false,error:'卡片资料加载失败，请重试',detail:undefined}));
 if(request!==detailRequest||!detailDialog.open)return;
 if(!result.ok||!result.detail){detailDialog.innerHTML=detailHeader(id)+`<p class="warning">${esc(result.error??'暂无资料')}</p><button data-detail-retry>重试</button>`;return;}
 const d=result.detail;
 // The image URL is reconstructed from a numeric password, never arbitrary HTML/URLs.
 const image=Number.isInteger(d.password)&&d.password>0&&d.password<1000000000?`https://cdn.233.momobako.com/ygopro/pics/${d.password}.jpg!half`:'';
 detailDialog.innerHTML=detailHeader(id)+`<img class="card-picture" src="${image}" alt="${esc(cardName(id))}卡图" referrerpolicy="no-referrer"><p class="image-error muted" hidden>卡图加载失败；仍可阅读下方效果。<button data-detail-retry>重试</button></p><p class="card-types">${esc(d.types)}</p><h3>卡片效果</h3><p class="card-description">${esc(d.description||'暂无效果文字')}</p><p class="muted">资料来源：百鸽 · 卡片密码 ${d.password}<br>此处为卡片资料，当前所在区域以侧栏记录为准。</p>`;
 detailDialog.querySelector('img')?.addEventListener('error',e=>{(e.target as HTMLImageElement).hidden=true;detailDialog.querySelector<HTMLElement>('.image-error')!.hidden=false;});
}
detailDialog.addEventListener('click',e=>{const el=e.target as HTMLElement;if(el.closest('[data-detail-close]'))detailDialog.close();if(el.closest('[data-detail-retry]'))void showCardDetail(selectedCard);const card=el.closest<HTMLElement>('[data-card-detail]');if(card)void showCardDetail(Number(card.dataset.cardDetail));});
detailDialog.addEventListener('close',()=>{detailRequest++;});
function home(){
 const c=state.counts;const targets=targetKinds(state.monsters);
 const plans=state.result.plans.map((p,i)=>`<section class="panel plan"><h3>方案 ${i+1}</h3><p class="caption">除外自己的</p><div class="formula"><div class="number-card">2 × <strong>${p.rank}</strong><small>阶 超量</small></div><span class="plus">+</span><div class="number-card fusion"><strong>${p.level}</strong><small>星 融合</small></div></div><p class="caption">选择对手场上的</p><div class="number-card target"><strong>${p.target}</strong><small>${unit(p.targetKind)} 怪兽</small></div>${p.usesPrevious?`<details><summary>需要使用原已除外卡</summary>返回 ${p.returnRank}阶超量 ＋ ${p.returnLevel}星融合</details>`:''}</section>`).join('');
 const chips=(kind:'xyz'|'fusion')=>[...groupStock(state.inventory.banished,state.catalog,kind)].sort((a,b)=>a[0]-b[0]).map(([v,n])=>`<span class="chip ${kind==='fusion'?'fusion':''}">${v}${kind==='xyz'?'阶':'星'} ×${n}</span>`).join('')||'<span class="muted">暂无已确认卡片</span>';
 return `${state.notice?`<div class="notice">${button('dismissNotice','×','small')}${esc(state.notice)}</div>`:''}
 <section class="panel scene-summary"><div class="panel-title"><h2>双方手牌与场上合计</h2>${button('counts','修正','small')}</div><div class="count-content"><div class="total" id="total">${val(state.total)}</div><table class="counts"><thead><tr><th></th><th>我方</th><th>对方</th></tr></thead><tbody><tr><th>手牌</th><td>${val(c.myHand)}</td><td>${val(c.opponentHand)}</td></tr><tr><th>场上</th><td>${val(c.myField)}</td><td>${val(c.opponentField)}</td></tr></tbody></table></div>${state.manual?'<span class="badge">含手动核对值</span>':''}
 <div class="summary-targets"><div class="panel-title"><h2>对方星数 / 阶级</h2>${button('monsters','修正','small')}</div><div class="tiles">${targets.map(t=>`<div class="tile ${t.kind}" aria-label="${t.value}${unit(t.kind)}"><b>${t.value}</b><small>${unit(t.kind)}</small></div>`).join('')||'<span class="muted">暂无可匹配数值</span>'}</div></div></section>
 <section class="panel" id="public-hand"><div class="panel-title"><h2>对方已公开手牌</h2><span class="badge">已确认 ${state.publicHand.cards.reduce((n,c)=>n+c.count,0)} 张</span></div>${state.publicHand.cards.map(c=>`<button data-card-detail="${c.id}" class="list-row public-hand-card"><span>${cardLabel(c.id)}</span><b>×${c.count}</b></button>`).join('')}${state.publicHand.uncertainCards.length?`<div class="public-hand-pending"><p class="warning">剩余手牌候选</p>${state.publicHand.uncertainCards.map(c=>`<button data-card-detail="${c.id}" class="list-row public-hand-card uncertain"><span>${cardLabel(c.id)}</span><b>最多 ×${c.count}</b></button>`).join('')}</div>`:''}<p class="muted">${esc(state.publicHand.reason)}</p></section>
 ${state.config.overlayEnabled?'':backrowPanel()}
 <div id="plans">${plans||`<section class="panel empty"><span class="symbol">${state.result.status==='none'?'≠':'!'}</span><strong>${state.result.status==='none'?'当前无匹配组合':'等待核对 / 更新'}</strong><p class="muted">${esc(state.result.reason)}</p>${state.result.status==='uncertain'?button(state.deckReady?'inventory':'deck','核对数据','small'):''}</section>`}</div>
 <section class="panel"><div class="panel-title"><h2>已在除外区</h2>${button('inventory','核对','small')}</div><div class="stock-row"><span>超量</span><div class="chips">${chips('xyz')}</div></div><div class="stock-row"><span>融合</span><div class="chips">${chips('fusion')}</div></div>${state.inventory.quality==='unknown'?'<small class="warning">部分库存待核对，不作为确定材料</small>':''}</section>`;
}
const back=()=>button('home','← 返回计算','back');
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
 return `<section class="panel" id="opponent-backrow"><div class="panel-title"><h2>对方盖放魔陷</h2><span class="badge">${b.count===null?'数量待确认':`${b.count} 张`}</span></div><div class="backrow-grid">${[11,10,9,8,7].map(cell).join('')}</div>${pending.length?`<div class="backrow-candidates"><small class="muted">${pending.map(c=>c.slot===12?'场地':12-c.slot).join('、')} 区可能是</small><div class="actions">${ids.map(name).join('')||'<span class="muted">暂无已知候选</span>'}</div></div>`:''}</section>`;
}
function deckPage(){
 const d=state.deck;
 const part=(title:string,items:Record<string,number>)=>`<details ${title==='额外牌组'?'open':''}><summary>${title} · ${Object.values(items).reduce((a,b)=>a+b,0)}张</summary>${Object.entries(items).map(([id,n])=>`<div class="list-row"><span>${esc(cardName(+id))}${!state.catalog[+id]?'<small class="warning"> 属性未获取</small>':''}</span><b>×${n}</b></div>`).join('')}</details>`;
 return `${back()}<h2>牌组获取与核对</h2><p class="muted">进入支持的排位或活动准备页面后自动识别当前牌组，切换牌组会同步更新。完整卡表缺失时，只使用与游戏修改时间一致的本地记录。</p>${d?`<section class="panel"><h3>${esc(d.name)}</h3>${part('额外牌组',d.extra)}${part('主牌组',d.main)}</section>${button('confirmDeck','确认用于本次对局','primary')}${button('editDeck','修正牌组')}`:`<p>${state.snapshot?.deckSelection?`已识别：${esc(state.snapshot.deckSelection.name)}。完整卡表尚未获取。`:'请进入游戏的对战准备页面选择牌组。'}</p><p class="muted">${esc(state.snapshot?.reason??'')} 没有可核对的记录时，可打开一次牌组编辑页面读取。</p>`}<div class="actions">${button('reconnect','重新读取')}${button('catalog','更新卡片属性')}</div><p class="muted">${esc(state.catalogMessage)}</p>`;
}
function editDeckPage(){if(!deckDraft)return `${back()}<p>请先读取牌组</p>`;return `${back()}<h2>修正牌组数量</h2><p class="muted">数量设为0移除。只修改助手记录，不修改游戏牌组。</p>${(['extra','main'] as const).map(z=>`<details ${z==='extra'?'open':''}><summary>${z==='extra'?'额外牌组':'主牌组'}</summary>${Object.entries(deckDraft![z]).map(([id,n])=>`<div class="stock-edit"><label>${esc(cardName(+id))}</label><input data-deck-zone="${z}" data-card-id="${id}" aria-label="牌组-${id}-数量" type="number" min="0" max="3" value="${n}"></div>`).join('')}</details>`).join('')}<form id="add-deck"><div class="form-row"><label>添加卡片（输入卡片编号）</label><input name="id" type="number" min="1" required></div><select name="zone" aria-label="牌组区域"><option value="extra">额外牌组</option><option value="main">主牌组</option></select><div class="actions"><button>添加一张</button></div></form><div class="actions">${button('saveDeck','保存牌组修正','primary')}${button('restore','恢复自动读取')}</div>`;}
function countsPage(){return `${back()}<h2>修正数量</h2><p class="muted">手动值会保持到恢复自动或下一场对局。</p><form id="counts-form">${Object.entries({myHand:'我方手牌',opponentHand:'对方手牌',myField:'我方场上',opponentField:'对方场上'}).map(([k,label])=>`<div class="form-row"><label for="${k}">${label}</label><input id="${k}" name="${k}" type="number" min="0" max="200" step="1" required value="${state.counts[k as keyof typeof state.counts]??''}"></div>`).join('')}<button class="primary" type="submit">保存数量</button></form><div class="actions">${button('restore','恢复自动读取')}</div>`;}
function monstersPage(){const ts=targetKinds(state.monsters);return `${back()}<h2>核对对方怪兽数值</h2><p class="muted">仅填写表侧怪兽，多个数值以逗号分隔。空白表示没有该类怪兽。</p><form id="monsters-form"><div class="form-row"><label for="levels">等级（星）</label><input id="levels" name="levels" value="${ts.filter(t=>t.kind==='level').map(t=>t.value).join(',')}"></div><div class="form-row"><label for="ranks">阶级（阶）</label><input id="ranks" name="ranks" value="${ts.filter(t=>t.kind==='rank').map(t=>t.value).join(',')}"></div><button class="primary">确认数值</button></form><div class="actions">${button('restore','恢复自动读取')}</div>`;}
function inventoryPage(){
 const row=(s:Stock,i:number,zone:string)=>`<div class="stock-edit" data-zone="${zone}" data-index="${i}"><label>${esc(cardName(s.id))}<br><small>#${s.id}</small></label><input aria-label="${zone}-${s.id}-数量" data-stock="count" type="number" min="0" max="60" value="${s.count}"><select aria-label="${zone}-${s.id}-状态" data-stock="face">${[['up','已确认'],['down','里侧'],['unknown','未知']].map(([v,t])=>`<option value="${v}" ${s.face===v?'selected':''}>${t}</option>`).join('')}</select></div>`;
 const options=Object.keys({...state.deck?.main,...state.deck?.extra,...Object.fromEntries(state.inventory.banished.map(s=>[s.id,1]))}).map(id=>`<option value="${id}">${esc(cardName(+id))} (#${id})</option>`).join('');
 return `${back()}<h2>库存核对</h2><p>当前区域总数：额外 <b>${val(state.snapshot?.extraCount??null)}</b> · 除外 <b>${val(state.snapshot?.banishedCount??null)}</b></p><p class="warning">${esc(state.inventory.reasons.join('；'))}</p><p class="muted">只修改能从游戏中确认的数据。“已确认”表示可识别；除外卡须确认表侧。数量设为0可移除。</p>${(['extra','banished'] as const).map(z=>`<details open><summary>${z==='extra'?'额外牌组':'除外区'}</summary>${stockDraft![z].map((s,i)=>row(s,i,z)).join('')||'<p class="muted">暂无条目</p>'}</details>`).join('')}<hr class="divider"><form id="add-stock"><div class="form-row"><label for="add-card">添加卡片</label><select id="add-card" name="id">${options}</select></div><select name="zone" aria-label="添加区域"><option value="banished">除外区</option><option value="extra">额外牌组</option></select><div class="actions"><button>添加一张</button></div></form><div class="actions">${button('saveInventory','确认库存','primary')}${button('restore','恢复自动读取')}</div>`;
}
function settingsPage(){const c=state.config;return `${back()}<h2>设置与诊断</h2><div class="actions">${button(state.paused?'resume':'pause',state.paused?'恢复读取':'暂停读取')}${button('reconnect','重新连接')}${button('restore','恢复自动读取')}</div><hr class="divider"><form id="config-form"><div class="form-row"><label for="overlayEnabled">盖牌显示</label><select id="overlayEnabled" name="overlayEnabled"><option value="true" ${c.overlayEnabled?'selected':''}>游戏内悬浮提示</option><option value="false" ${!c.overlayEnabled?'selected':''}>侧栏五格</option></select></div><details><summary>浮窗位置微调</summary><p class="muted">按游戏画面百分比调整。提示应位于盖牌内部下沿；更换分辨率后如有偏移可微调。</p>${[['overlayOffsetX','水平偏移',c.overlayOffsetX],['overlayOffsetY','垂直偏移',c.overlayOffsetY]].map(([key,label,value])=>`<div class="form-row"><label for="${key}">${label}（%）</label><input id="${key}" name="${key}" type="number" min="-10" max="10" step="0.1" value="${value}"></div>`).join('')}</details><div class="form-row"><label for="theme">主题</label><select id="theme" name="theme"><option value="dark" ${c.theme!=='light'?'selected':''}>深色</option><option value="light" ${c.theme==='light'?'selected':''}>浅色</option></select></div>${[['modulePath','本机读取模块路径',c.modulePath,'text'],['unityVersion','Unity版本',c.unityVersion,'text'],['interval','更新间隔（毫秒）',c.interval,'number'],['width','窗口宽度',c.width,'number'],['height','窗口高度',c.height,'number']].map(([key,label,value,type])=>`<div class="form-row"><label for="${key}">${label}</label><input id="${key}" name="${key}" type="${type}" value="${esc(value)}" required></div>`).join('')}<button class="primary">保存设置</button></form><div class="actions">${button('deck','牌组核对')}${button('catalog','更新卡片属性')}${button('export','保存本地诊断')}</div><p class="muted">${esc(state.catalogMessage)}</p><details><summary>诊断详情</summary><pre>${esc(JSON.stringify({状态:state.snapshot?.status,读取时间:state.snapshot?.timestamp?new Date(state.snapshot.timestamp).toLocaleTimeString():'无',日志数量:state.snapshot?.logLength,库存状态:state.inventory.quality,原因:state.result.reason},null,2))}</pre></details><p class="muted">个人使用原型 0.3.0 · 仅本地处理<br>当前依赖本机读取模块；不自动操作游戏。</p>`;}
let lastMarkup='' ;
function render(){if(!state)return;const y=content.scrollTop;const markup=page==='home'?home():page==='deck'?deckPage():page==='editDeck'?editDeckPage():page==='counts'?countsPage():page==='monsters'?monstersPage():page==='inventory'?inventoryPage():settingsPage();if(markup!==lastMarkup){content.innerHTML=markup;lastMarkup=markup;content.scrollTop=y;}footer();}
function footer(){document.documentElement.dataset.theme=state.config.theme??'dark';const status=state.deckReady?'卡组获取成功':state.deck?!state.deckAttributesReady?'卡组已读取 · 属性待获取':'卡组需要核对':state.snapshot?.deckSelection?'已识别牌组 · 卡表待获取':'尚未获取卡组';const badge=document.querySelector<HTMLButtonElement>('#deck-status')!;badge.textContent=state.deckReady?'✓':'!';badge.classList.toggle('warn',!state.deckReady);badge.setAttribute('aria-label',status);document.querySelector('#deck-status-tip')!.textContent=status;const s=state.snapshot;document.querySelector('#connection')!.innerHTML=`<span class="dot ${state.stale?'warn':''}">●</span>${state.paused?'已暂停':state.stale?'数据待更新':s?.status==='duel'?'已连接 · 自动更新':s?.status==='menu'?'已连接 · 等待对局':'等待 MD 启动'}`;}
document.querySelector('#deck-status')!.addEventListener('click',()=>navigate('deck'));
document.querySelector('#minimize')!.addEventListener('click',()=>void cmd('minimize'));
document.querySelector('#close')!.addEventListener('click',()=>void cmd('close'));
document.querySelector('#settings')!.addEventListener('click',()=>navigate('settings'));
content.addEventListener('click',async e=>{
 const slot=(e.target as HTMLElement).closest<HTMLElement>('[data-set-slot]');
 if(slot){const position=Number(slot.dataset.setSlot),c=state.backrow.cards.find(c=>c.slot===position);if(c?.confirmedId&&!state.backrow.uncertain&&!c.positionChanged)void showCardDetail(c.confirmedId);else showSetLocation(position);return;}
 const card=(e.target as HTMLElement).closest<HTMLElement>('[data-card-detail]');
 if(card){void showCardDetail(Number(card.dataset.cardDetail));return;}
 const action=(e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;if(!action)return;
 if(['home','deck','editDeck','counts','monsters','inventory','settings'].includes(action)){navigate(action);return;}
 if(action==='saveDeck'&&deckDraft){const d=structuredClone(deckDraft);for(const z of ['main','extra'] as const)d[z]=Object.fromEntries(Object.entries(d[z]).filter(([,n])=>n>0));if(await cmd('deck',d))navigate('deck');return;}
 if(action==='saveInventory'){if(await cmd('inventory',stockDraft))navigate('home');return;}
 if(await cmd(action)){if(['confirmDeck','restore'].includes(action))navigate('home');else render();}
});
content.addEventListener('change',e=>{
 const el=e.target as HTMLInputElement;
 if(el.dataset.deckZone&&deckDraft){deckDraft[el.dataset.deckZone as 'main'|'extra'][el.dataset.cardId!]=Number(el.value);return;}
 const row=el.closest<HTMLElement>('[data-zone]');if(!row||!stockDraft)return;
 const z=row.dataset.zone as 'extra'|'banished',i=Number(row.dataset.index);
 if(el.dataset.stock==='count')stockDraft[z][i].count=Number(el.value);else if(el.dataset.stock==='face')stockDraft[z][i].face=el.value as Stock['face'];
});
content.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target as HTMLFormElement,data=Object.fromEntries(new FormData(form));
 if(form.id==='counts-form'){if(await cmd('counts',Object.fromEntries(Object.entries(data).map(([k,v])=>[k,Number(v)]))))navigate('home');}
 if(form.id==='monsters-form'){
   const monsters:Monster[]=[];for(const [key,kind] of [['levels','level'],['ranks','rank']] as const){for(const value of String(data[key]).split(/[,，\s]+/).filter(Boolean))monsters.push({uid:monsters.length,kind,value:Number(value),faceUp:true});}
   if(await cmd('monsters',monsters))navigate('home');
 }
 if(form.id==='config-form'){if(await cmd('config',{...data,overlayEnabled:data.overlayEnabled==='true',overlayOffsetX:Number(data.overlayOffsetX),overlayOffsetY:Number(data.overlayOffsetY),interval:Number(data.interval),width:Number(data.width),height:Number(data.height)}))render();}
 if(form.id==='add-stock'){
   const zone=String(data.zone) as 'extra'|'banished',id=Number(data.id);if(!id)return;
   const found=stockDraft![zone].find(s=>s.id===id&&s.face==='up');if(found)found.count++;else stockDraft![zone].push({id,count:1,face:'up'});render();
 }
 if(form.id==='add-deck'&&deckDraft){const id=Number(data.id),zone=String(data.zone) as 'main'|'extra';if(!state.catalog[id]){toast('卡片编号不在当前数据库中');return;}deckDraft[zone][id]=(deckDraft[zone][id]??0)+1;render();}
});
api.subscribe(s=>{state=s;if(page==='home')render();else footer();refreshLocation();});
state=await api.getState();render();
