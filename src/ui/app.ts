import {modules,defaultSidebarModules,type ModuleId} from '../domain/modules.js';
import {renderSidebar} from './sidebar.js';
import {targetKinds,type Stock,type Monster} from '../domain/model.js';
import type {DuelStore} from '../domain/store.js';
import type {CardDetail} from '../data/card-detail.js';
import type {Config} from '../desktop/config.js';
type View=ReturnType<DuelStore['view']>&{notice:string;catalogMessage:string;config:Config};
declare global {interface Window {cannon:{version:string;sidebarLayout:(value:{height:number;signature:string})=>Promise<void>;onSettingsPage:(callback:(page:string)=>void)=>()=>void;cardDetail:(id:number)=>Promise<{ok:boolean;detail?:CardDetail;error?:string}>;getState:()=>Promise<View>;command:(name:string,value?:unknown)=>Promise<{ok:boolean;error?:string}>;subscribe:(cb:(s:View)=>void)=>()=>void}}}
const api=window.cannon,content=document.querySelector<HTMLElement>('#content')!;
const params=new URLSearchParams(location.search),isSettings=params.get('window')==='settings';
let state:View;let page=isSettings?'settings':'home';let stockDraft:{extra:Stock[];banished:Stock[]}|null=null;
let deckDraft:View['deck']=null;
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const val=(n:number|null)=>n===null?'—':String(n);
const unit=(kind:string)=>kind==='rank'?'阶':'星';
const button=(action:string,text:string,cls='')=>`<button data-action="${action}" class="${cls}">${text}</button>`;
function toast(message:string){const e=document.querySelector<HTMLElement>('#toast')!;e.textContent=message;e.hidden=false;setTimeout(()=>{e.hidden=true;},6000);}
async function cmd(name:string,value?:unknown){const r=await api.command(name,value);if(!r.ok){toast(r.error??'操作失败');return false;}state=await api.getState();return true;}
function navigate(next:string){if(!isSettings&&next!=='home')return;if(isSettings&&next==='home')next='settings';page=next;if(next==='inventory')stockDraft=structuredClone({extra:state.inventory.extra,banished:state.inventory.banished});if(next==='editDeck')deckDraft=structuredClone(state.deck);render();content.scrollTop=0;}
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
function home(){return `<div id="sidebar-modules">${renderSidebar(state,state.config.sidebarModules??defaultSidebarModules)}</div>`; }
const back=()=>`<nav class="settings-nav" aria-label="设置分类">${[['settings','模块设置'],['counts','数量修正'],['monsters','怪兽数值'],['inventory','库存核对'],['deck','牌组核对']].map(([id,label])=>`<button data-action="${id}" aria-current="${page===id?'page':'false'}">${label}</button>`).join('')}</nav>`;
function deckPage(){
 const d=state.deck;
 const part=(title:string,items:Record<string,number>)=>`<details ${title==='额外牌组'?'open':''}><summary>${title} · ${Object.values(items).reduce((a,b)=>a+b,0)}张</summary>${Object.entries(items).map(([id,n])=>`<div class="list-row"><span>${esc(cardName(+id))}${!state.catalog[+id]?'<small class="warning"> 属性未获取</small>':''}</span><b>×${n}</b></div>`).join('')}</details>`;
 return `${back()}<h2>牌组获取与核对</h2><p class="muted">进入支持的排位或活动准备页面后自动识别当前牌组，切换牌组会同步更新。完整卡表可从编辑页面读取。准备页版本不匹配时，候选卡表需先核对并确认，确认前不会用于计算。</p>${d?`<section class="panel"><h3>${esc(d.name)}</h3>${part('额外牌组',d.extra)}${part('主牌组',d.main)}</section>${state.snapshot?.deckSelection&&d.revision!==state.snapshot.deckSelection.revision?'<p class="muted">这是本机上次读取的同编号牌组，游戏版本未匹配；请核对卡表后再确认。</p>':''}${button('confirmDeck','确认用于本次对局','primary')}${button('editDeck','修正牌组')}`:`<p>${state.snapshot?.deckSelection?`已识别：${esc(state.snapshot.deckSelection.name)}。完整卡表尚未获取。`:'请进入游戏的对战准备页面选择牌组。'}</p><p class="muted">${esc(state.snapshot?.reason??'')} 没有可核对的记录时，可打开一次牌组编辑页面读取。</p>`}<div class="actions">${button('reconnect','重新读取')}${button('catalog','更新卡片属性')}</div><p class="muted">${esc(state.catalogMessage)}</p>`;
}
function editDeckPage(){if(!deckDraft)return `${back()}<p>请先读取牌组</p>`;return `${back()}<h2>修正牌组数量</h2><p class="muted">数量设为0移除。只修改助手记录，不修改游戏牌组。</p>${(['extra','main'] as const).map(z=>`<details ${z==='extra'?'open':''}><summary>${z==='extra'?'额外牌组':'主牌组'}</summary>${Object.entries(deckDraft![z]).map(([id,n])=>`<div class="stock-edit"><label>${esc(cardName(+id))}</label><input data-deck-zone="${z}" data-card-id="${id}" aria-label="牌组-${id}-数量" type="number" min="0" max="3" value="${n}"></div>`).join('')}</details>`).join('')}<form id="add-deck"><div class="form-row"><label>添加卡片（输入卡片编号）</label><input name="id" type="number" min="1" required></div><select name="zone" aria-label="牌组区域"><option value="extra">额外牌组</option><option value="main">主牌组</option></select><div class="actions"><button>添加一张</button></div></form><div class="actions">${button('saveDeck','保存牌组修正','primary')}${button('restore','恢复自动读取')}</div>`;}
function countsPage(){return `${back()}<h2>修正数量</h2><p class="muted">手动值会保持到恢复自动或下一场对局。</p><form id="counts-form">${Object.entries({myHand:'我方手牌',opponentHand:'对方手牌',myField:'我方场上',opponentField:'对方场上'}).map(([k,label])=>`<div class="form-row"><label for="${k}">${label}</label><input id="${k}" name="${k}" type="number" min="0" max="200" step="1" required value="${state.counts[k as keyof typeof state.counts]??''}"></div>`).join('')}<button class="primary" type="submit">保存数量</button></form><div class="actions">${button('restore','恢复自动读取')}</div>`;}
function monstersPage(){const ts=targetKinds(state.monsters);return `${back()}<h2>核对对方怪兽数值</h2><p class="muted">仅填写表侧怪兽，多个数值以逗号分隔。空白表示没有该类怪兽。</p><form id="monsters-form"><div class="form-row"><label for="levels">等级（星）</label><input id="levels" name="levels" value="${ts.filter(t=>t.kind==='level').map(t=>t.value).join(',')}"></div><div class="form-row"><label for="ranks">阶级（阶）</label><input id="ranks" name="ranks" value="${ts.filter(t=>t.kind==='rank').map(t=>t.value).join(',')}"></div><button class="primary">确认数值</button></form><div class="actions">${button('restore','恢复自动读取')}</div>`;}
function inventoryPage(){
 const row=(s:Stock,i:number,zone:string)=>`<div class="stock-edit" data-zone="${zone}" data-index="${i}"><label>${esc(cardName(s.id))}<br><small>#${s.id}</small></label><input aria-label="${zone}-${s.id}-数量" data-stock="count" type="number" min="0" max="60" value="${s.count}"><select aria-label="${zone}-${s.id}-状态" data-stock="face">${[['up','已确认'],['down','里侧'],['unknown','未知']].map(([v,t])=>`<option value="${v}" ${s.face===v?'selected':''}>${t}</option>`).join('')}</select></div>`;
 const options=Object.keys({...state.deck?.main,...state.deck?.extra,...Object.fromEntries(state.inventory.banished.map(s=>[s.id,1]))}).map(id=>`<option value="${id}">${esc(cardName(+id))} (#${id})</option>`).join('');
 return `${back()}<h2>库存核对</h2><p>当前区域总数：额外 <b>${val(state.snapshot?.extraCount??null)}</b> · 除外 <b>${val(state.snapshot?.banishedCount??null)}</b></p><p class="warning">${esc(state.inventory.reasons.join('；'))}</p><p class="muted">只修改能从游戏中确认的数据。“已确认”表示可识别；除外卡须确认表侧。数量设为0可移除。</p>${(['extra','banished'] as const).map(z=>`<details open><summary>${z==='extra'?'额外牌组':'除外区'}</summary>${stockDraft![z].map((s,i)=>row(s,i,z)).join('')||'<p class="muted">暂无条目</p>'}</details>`).join('')}<hr class="divider"><form id="add-stock"><div class="form-row"><label for="add-card">添加卡片</label><select id="add-card" name="id">${options}</select></div><select name="zone" aria-label="添加区域"><option value="banished">除外区</option><option value="extra">额外牌组</option></select><div class="actions"><button>添加一张</button></div></form><div class="actions">${button('saveInventory','确认库存','primary')}${button('restore','恢复自动读取')}</div>`;
}
function settingField(key:string,label:string,value:unknown,type='number'){
 return `<div class="form-row"><label for="${key}">${label}</label><input form="config-form" id="${key}" name="${key}" type="${type}" value="${esc(value)}" ${key==='modulePath'?'':'required'} ${key.startsWith('overlayOffset')?'min="-10" max="10" step="0.1"':''}></div>`;
}
function displaySettings(){
 const c=state.config;
 const toggle=(target:string,label:string,checked:boolean,id?:ModuleId)=>`<input type="checkbox" role="switch" data-display="${target}" ${id?`data-module="${id}"`:''} aria-label="${label}" ${checked?'checked':''}>`;
 return `<section class="panel settings-group" id="sidebar-settings"><div class="panel-title"><h2>侧边栏</h2><div class="actions">${button('showSidebar','显示')}${button('hideSidebar','隐藏')}</div></div>
 <p class="setting-hint">显示在侧边栏 · 开关即时保存，按开启顺序排列</p>
 <div class="sidebar-switches">${modules.map(m=>`<label class="display-option"><span>${m.label}<small data-order="sidebar" data-module="${m.id}"></small></span>${toggle('sidebar',m.label+'：显示在侧边栏',(c.sidebarModules??defaultSidebarModules).includes(m.id),m.id)}</label>`).join('')}</div>
 <div class="settings-fields">${settingField('width','窗口宽度',c.width)}${settingField('height','侧栏最大高度',c.height)}<div class="form-row"><label for="theme">主题</label><select form="config-form" id="theme" name="theme"><option value="dark" ${c.theme!=='light'?'selected':''}>深色</option><option value="light" ${c.theme==='light'?'selected':''}>浅色</option></select></div></div></section>
 <div class="settings-pair"><section class="panel settings-group" id="hand-settings"><label class="display-option group-heading"><span>公开手牌</span>${toggle('handOverlayEnabled','公开手牌悬浮窗',c.handOverlayEnabled??c.overlayEnabled)}</label><p class="setting-hint">场上悬浮窗</p><div class="form-row"><label for="hand-overlay-style">场上手牌悬浮窗样式</label><select id="hand-overlay-style"><option value="label" ${c.handOverlayStyle==='label'?'selected':''}>怪／魔／陷</option><option value="thumbnail" ${c.handOverlayStyle!=='label'?'selected':''}>卡图缩略图</option></select></div></section>
 <section class="panel settings-group" id="backrow-settings"><label class="display-option group-heading"><span>盖牌</span>${toggle('backrowOverlayEnabled','盖放魔陷悬浮窗',c.backrowOverlayEnabled??c.overlayEnabled)}</label><p class="setting-hint">场上悬浮窗 · 居中显示，点击查看详情</p><div class="settings-fields">${settingField('overlayOffsetX','水平偏移（%）',c.overlayOffsetX)}${settingField('overlayOffsetY','垂直偏移（%）',c.overlayOffsetY)}</div></section></div>
 <section class="panel settings-group" id="info-settings"><label class="display-option group-heading"><span>信息悬浮窗</span>${toggle('infoOverlayEnabled','信息悬浮窗总开关',c.infoOverlayEnabled!==false)}</label><p class="setting-hint">在浮窗入口选择内容，关闭后保留选择。</p></section>`;
}
function syncDisplayControls(){
 const c=state.config;
 const style=content.querySelector<HTMLSelectElement>('#hand-overlay-style');if(style)style.value=c.handOverlayStyle??'thumbnail';
 for(const input of content.querySelectorAll<HTMLInputElement>('[data-display]')){
  const target=input.dataset.display!,id=input.dataset.module as ModuleId;
  input.checked=target==='sidebar'?(c.sidebarModules??defaultSidebarModules).includes(id):target==='info'?(c.selectedModules??[]).includes(id):target==='infoOverlayEnabled'?c.infoOverlayEnabled!==false:target==='handOverlayEnabled'?(c.handOverlayEnabled??c.overlayEnabled):(c.backrowOverlayEnabled??c.overlayEnabled);
 }
 for(const label of content.querySelectorAll<HTMLElement>('[data-order]')){
  const order=label.dataset.order==='sidebar'?(c.sidebarModules??defaultSidebarModules):(c.selectedModules??[]),index=order.indexOf(label.dataset.module as ModuleId);
  label.textContent=index<0?'':`第 ${index+1} 位`;
 }
}
function settingsPage(){const c=state.config;return `${back()}<div class="settings-layout">${displaySettings()}
 <section class="panel settings-group" id="reader-settings"><h2>读取与启动</h2><div class="settings-fields"><div class="form-row"><label for="readerBackend">读取后端</label><select form="config-form" id="readerBackend" name="readerBackend"><option value="companion" ${c.readerBackend!=='owned'?'selected':''}>兼容后端（Untapped模块）</option><option value="owned" ${c.readerBackend==='owned'?'selected':''}>自有只读后端</option></select></div><div class="form-row"><label for="launchUntapped">联动启动 Untapped.gg</label><select form="config-form" id="launchUntapped" name="launchUntapped"><option value="false" ${!c.launchUntapped?'selected':''}>关闭</option><option value="true" ${c.launchUntapped?'selected':''}>开启（已运行时跳过）</option></select></div></div>
 <div class="actions">${button(state.paused?'resume':'pause',state.paused?'恢复读取':'暂停读取')}${button('reconnect','重新连接')}${button('restore','恢复自动读取')}</div>
 <details class="advanced-settings"><summary>高级与诊断</summary>${settingField('modulePath','本机读取模块路径',c.modulePath,'text')}<div class="settings-fields">${settingField('unityVersion','Unity版本',c.unityVersion,'text')}${settingField('interval','更新间隔（毫秒）',c.interval)}</div><div class="actions">${button('catalog','更新卡片属性')}${button('export','保存本地诊断')}</div><p class="muted">${esc(state.catalogMessage)}</p><pre>${esc(JSON.stringify({状态:state.snapshot?.status,日志数量:state.snapshot?.logLength,库存状态:state.inventory.quality,原因:state.result.reason},null,2))}</pre></details></section>
 <form id="config-form" class="settings-save"><span class="muted">开关与手牌样式即时保存</span><button class="primary" type="submit">保存设置</button></form></div>`;}
let measuredLayout='';
function measureSidebar(){
 if(isSettings||!state)return;
 // Hidden windows can suspend animation frames; measure synchronously before showing.
 {
  const modulesNode=content.querySelector<HTMLElement>('#sidebar-modules');if(!modulesNode)return;
  const style=getComputedStyle(content);
  const height=modulesNode.getBoundingClientRect().height+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+document.querySelector('header')!.getBoundingClientRect().height+document.querySelector('footer')!.getBoundingClientRect().height;
  const value={height:Math.ceil(height),signature:JSON.stringify(state.config.sidebarModules??defaultSidebarModules)},key=JSON.stringify(value);
  if(key!==measuredLayout){measuredLayout=key;void api.sidebarLayout(value);}
 }
}
const sidebarObserver=new ResizeObserver(measureSidebar);
let lastMarkup='' ;
function render(){if(!state)return;const y=content.scrollTop;const markup=page==='home'?home():page==='deck'?deckPage():page==='editDeck'?editDeckPage():page==='counts'?countsPage():page==='monsters'?monstersPage():page==='inventory'?inventoryPage():settingsPage();if(markup!==lastMarkup){content.innerHTML=markup;lastMarkup=markup;content.scrollTop=y;if(!isSettings){sidebarObserver.disconnect();const modulesNode=content.querySelector('#sidebar-modules');if(modulesNode)sidebarObserver.observe(modulesNode);}}footer();syncDisplayControls();measureSidebar();}
function footer(){document.documentElement.dataset.theme=state.config.theme??'dark';const status=state.deckReady?'卡组获取成功':state.deck?!state.deckAttributesReady?'卡组已读取 · 属性待获取':'卡组需要核对':state.snapshot?.deckSelection?'已识别牌组 · 卡表待获取':'尚未获取卡组';const badge=document.querySelector<HTMLButtonElement>('#deck-status')!;badge.textContent=state.deckReady?'✓':'!';badge.classList.toggle('warn',!state.deckReady);badge.setAttribute('aria-label',status);document.querySelector('#deck-status-tip')!.textContent=status;const s=state.snapshot;document.querySelector('#connection')!.innerHTML=`<span class="dot ${state.stale?'warn':''}">●</span>${state.paused?'已暂停':state.stale?'数据待更新':s?.status==='duel'?'已连接 · 自动更新':s?.status==='menu'?'已连接 · 等待对局':'等待 MD 启动'}`;}

document.querySelector('#minimize')!.addEventListener('click',()=>void cmd('minimize'));
document.querySelector('#close')!.addEventListener('click',()=>void cmd('close'));
document.querySelector('#settings')?.remove();
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
content.addEventListener('change',async e=>{
 const el=e.target as HTMLInputElement;
 if(el.id==='hand-overlay-style'){el.disabled=true;await cmd('handOverlayStyle',el.value);syncDisplayControls();el.disabled=false;return;}
 if(el.dataset.display){
  el.disabled=true;
  await cmd('display',{target:el.dataset.display,id:el.dataset.module,enabled:el.checked});
  syncDisplayControls();el.disabled=false;return;
 }
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
 if(form.id==='config-form'){if(await cmd('config',{...state.config,...data,launchUntapped:data.launchUntapped==='true',overlayOffsetX:Number(data.overlayOffsetX),overlayOffsetY:Number(data.overlayOffsetY),interval:Number(data.interval),width:Number(data.width),height:Number(data.height)}))render();}
 if(form.id==='add-stock'){
   const zone=String(data.zone) as 'extra'|'banished',id=Number(data.id);if(!id)return;
   const found=stockDraft![zone].find(s=>s.id===id&&s.face==='up');if(found)found.count++;else stockDraft![zone].push({id,count:1,face:'up'});render();
 }
 if(form.id==='add-deck'&&deckDraft){const id=Number(data.id),zone=String(data.zone) as 'main'|'extra';if(!state.catalog[id]){toast('卡片编号不在当前数据库中');return;}deckDraft[zone][id]=(deckDraft[zone][id]??0)+1;render();}
});
api.subscribe(s=>{state=s;if(page==='home')render();else{footer();syncDisplayControls();}refreshLocation();});
if(isSettings){
 document.body.classList.add('settings-window');document.title='MD助手 · 设置';document.querySelector('h1')!.textContent='MD助手 · 设置';
 document.querySelector('#close')!.setAttribute('aria-label','隐藏主界面，保留后台运行');document.querySelector('#close')!.setAttribute('title','隐藏主界面，保留后台运行；从托盘退出');
 document.querySelector('#minimize')!.setAttribute('aria-label','最小化设置窗口');document.querySelector('#minimize')!.setAttribute('title','最小化设置窗口');
 api.onSettingsPage(next=>{if(next!==page&&['settings','deck','counts','monsters','inventory'].includes(next))navigate(next);});
}
state=await api.getState();
if(isSettings){const initial=params.get('page')??'settings';navigate(['settings','deck','counts','monsters','inventory'].includes(initial)?initial:'settings');}else render();
