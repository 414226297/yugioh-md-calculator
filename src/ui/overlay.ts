import type {CardDetail} from '../data/card-detail.js';
import type {SetCard} from '../domain/model.js';
type Payload={kind:'tag'|'detail';source?:'hand';name?:string;theme:string;width?:number;height?:number;slot?:number;label?:string;category?:string;card?:SetCard;uncertain?:boolean;candidates?:{id:number;name:string;category?:string;rarity?:string}[]};
declare global {interface Window {overlay:{getState:()=>Promise<Payload|null>;select:(slot:number)=>Promise<void>;close:()=>Promise<void>;cardDetail:(id:number)=>Promise<{ok:boolean;detail?:CardDetail;error?:string}>;subscribe:(callback:(state:Payload)=>void)=>()=>void}}}
const api=window.overlay,root=document.querySelector<HTMLElement>('#overlay')!;
let data:Payload|null=null,signature='',request=0,selected=0;
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''){const el=document.createElement(tag);el.textContent=text;el.className=className;return el;}
function assetIcon(file:string,alt:string,className:string){const img=node('img');img.src=`assets/md/${file}.png`;img.alt=alt;img.className=className;return img;}
async function detail(id:number){
 selected=id;const current=++request;const area=document.querySelector('#detail-content');if(!area)return;
 document.querySelectorAll<HTMLButtonElement>('.candidates button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===String(id))));
 area.replaceChildren(node('p','正在加载卡片资料…','muted'));
 const result=await api.cardDetail(id).catch(()=>({ok:false,error:'资料加载失败',detail:undefined}));
 if(current!==request||!data?.card?.candidates.includes(id))return;
 if(!result.ok||!result.detail){const retry=node('button','重试');retry.onclick=()=>void detail(id);area.replaceChildren(node('p',result.error??'资料暂不可用','muted'),retry);return;}
 const d=result.detail;area.replaceChildren();
 const meta=data?.candidates?.find(c=>c.id===id);
 const category=meta?.category??(d.types.includes('陷阱')?'trap':d.types.includes('魔法')&&!d.types.includes('魔法师')?'spell':'monster');
 area.className=`report ${category}`;
 const title=node('h2',d.name||meta?.name||'卡片资料','report-title');
 if(category!=='monster')title.append(assetIcon(`icon-GUI_T_Icon1_Attr${category==='trap'?'09':'08'}`,category==='trap'?'陷阱':'魔法','report-emblem'));
 area.append(title);
 const summary=node('div','','report-summary');
 const art=node('div','','report-art');
 const monsterFrame=d.types.includes('融合')?'fusion':d.types.includes('同调')?'synchro':d.types.includes('超量')?'xyz':d.types.includes('连接')?'link':d.types.includes('仪式')?'ritual':d.types.includes('通常')?'normal':'effect';
 art.classList.add(`frame-${category==='monster'?'monster_'+monsterFrame:category}`);
 const rarityIndex=['N','R','SR','UR'].indexOf(meta?.rarity??'');
 if(rarityIndex>=0)art.append(assetIcon(`native/GUI_Icon_Rarity${rarityIndex}`,meta!.rarity!,`report-rarity rarity-${meta!.rarity!.toLowerCase()}`));
 if(Number.isInteger(d.password)&&d.password>0&&d.password<1000000000){const img=node('img');img.className='picture';img.alt='卡图';img.referrerPolicy='no-referrer';img.src=`https://cdn.233.momobako.com/ygopro/pics/${d.password}.jpg!half`;img.onerror=()=>{img.hidden=true;};art.append(img);}
 summary.append(art);
 const typeText=d.types.replace(/[【】\[\]]/g,'').trim();
 const types=node('p',typeText,'report-types');
 const icon=category==='monster'?null:typeText.includes('永续')?'04':typeText.includes('速攻')?'05':typeText.includes('反击')?'01':typeText.includes('装备')?'03':typeText.includes('场地')?'02':typeText.includes('仪式')?'06':null;
 if(icon)types.prepend(assetIcon(`icon-GUI_T_Icon1_Icon${icon}`,typeText,'report-type-icon'));
 summary.append(types);area.append(summary);
 area.append(node('div',category==='trap'?'【陷阱】':category==='spell'?'【魔法】':'【怪兽】','report-bar'),node('p',d.description||'暂无效果文字','report-effect'));
}
function render(next:Payload|null){
 data=next;const key=JSON.stringify(next);if(key===signature)return;signature=key;request++;
 root.replaceChildren();if(!next)return;document.documentElement.dataset.theme=next.theme;
 if(next.kind==='tag'){const button=node('button',next.label,`tag ${next.category??''} ${next.source==='hand'?'hand-tag':''}`);button.style.width=`${next.width}px`;button.style.height=`${next.height}px`;button.setAttribute('aria-label',`查看${next.source==='hand'?'公开手牌':'盖牌'}：${next.name??next.label}`);button.onclick=()=>void api.select(next.slot!);root.append(button);return;}
 const panel=node('section','','detail');
 const area=node('div');area.id='detail-content';panel.append(area);
 const certain=!!next.card?.confirmedId&&!next.uncertain&&!next.card.positionChanged;
 if(!certain&&next.candidates?.length){
  const list=node('section','','candidate-list');list.append(node('strong',next.card?.positionChanged?'位置变动 · 候选名单':'候选名单 · 点击切换资料'));
  const candidates=node('div','','candidates');for(const c of next.candidates){const button=node('button',c.name);button.dataset.id=String(c.id);button.onclick=()=>void detail(c.id);candidates.append(button);}list.append(candidates);panel.append(list);
 }
 if(!next.candidates?.length)panel.append(node('p','暂无公开身份信息','muted'));
 else if(next.card?.unknownPossible)panel.append(node('p','也可能是其他尚未公开的卡片','muted'));
 root.append(panel);
 const id=certain?next.card!.confirmedId:(next.card?.candidates.includes(selected)?selected:next.candidates?.[0]?.id);if(id)void detail(id);
}
api.subscribe(render);render(await api.getState());
