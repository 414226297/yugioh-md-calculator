import {modules,type ModuleId} from '../domain/modules.js';
type Payload={kind:'modules';markup:string;selectedModules:ModuleId[];theme:string;width:number;height:number};
declare global {interface Window {moduleOverlay:{getState:()=>Promise<Payload|null>;choose:(ids:ModuleId[])=>Promise<ModuleId[]>;height:(layout:{height:number;regions:{x:number;y:number;width:number;height:number}[]})=>Promise<void>;detail:(value:{id?:number;slot?:number})=>Promise<void>;onHidden:(cb:()=>void)=>()=>void;subscribe:(cb:(data:Payload)=>void)=>()=>void}}}
const api=window.moduleOverlay;
const shell=document.querySelector<HTMLElement>('#module-shell')!,panel=document.querySelector<HTMLElement>('#module-panel')!,content=document.querySelector<HTMLElement>('#module-content')!,menu=document.querySelector<HTMLElement>('#module-menu')!,trigger=document.querySelector<HTMLButtonElement>('#module-trigger')!,error=document.querySelector<HTMLElement>('#module-error')!;
let data:Payload|null=null,chosen:ModuleId[]=[],lastContent='',closeTimer:ReturnType<typeof setTimeout>|undefined,lastLayout='';
menu.innerHTML='<h2>信息悬浮窗 · 选择模块</h2>'+modules.map(m=>`<label class="module-choice"><input type="checkbox" value="${m.id}"><span>${m.label}</span><small></small></label>`).join('');
function measure(){
 const regions=[panel,trigger,error].filter(el=>!el.hidden).map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}).filter(r=>r.width>0&&r.height>0);
 const layout={height:Math.ceil(shell.getBoundingClientRect().height),regions},signature=JSON.stringify(layout);
 if(signature!==lastLayout){lastLayout=signature;void api.height(layout);}
}
function setOpen(value:boolean,select=false){
 clearTimeout(closeTimer);panel.hidden=!value;menu.hidden=!select;content.hidden=select;
 if(!value)error.hidden=true;
 trigger.setAttribute('aria-expanded',String(value));panel.scrollTop=0;requestAnimationFrame(measure);
}
function render(next:Payload|null){
 if(!next||next.kind!=='modules')return;data=next;chosen=[...next.selectedModules];
 // Scale the compact sidebar consistently with the physical game viewport and DPI.
 const scale=next.width/260;shell.style.zoom=String(scale);shell.style.width=`${next.width/scale}px`;shell.style.maxHeight=`${next.height/scale}px`;
 panel.style.maxHeight=`${Math.max(1,next.height/scale-30)}px`;
 trigger.textContent=`信息悬浮窗 ${chosen.length} ⌃`;
 for(const input of menu.querySelectorAll<HTMLInputElement>('input')){const index=chosen.indexOf(input.value as ModuleId);input.checked=index>=0;input.parentElement!.querySelector('small')!.textContent=index>=0?String(index+1):'';}
 const template=document.createElement('template');template.innerHTML=next.markup;
 const result=document.createElement('div');
 for(const id of chosen){
  const spec=modules.find(m=>m.id===id)!;const node=template.content.querySelector(spec.selector);if(!node)continue;
  // Reuse the exact sidebar module while keeping adjustments in the settings window.
  node.querySelectorAll('[data-action]').forEach(button=>button.remove());
  const section=document.createElement('section');section.className='module-section';section.dataset.module=id;
  if(id==='plans'){const heading=document.createElement('h2');heading.className='module-heading';heading.textContent=spec.label;section.append(heading);}
  section.append(node);result.append(section);
 }
 const html=result.innerHTML;if(html!==lastContent){const scroll=panel.scrollTop;content.innerHTML=html;lastContent=html;panel.scrollTop=scroll;}
 requestAnimationFrame(measure);
}
trigger.title='悬停查看模块，点击选择模块';
trigger.setAttribute('aria-controls','module-panel');
trigger.addEventListener('mouseenter',()=>{if(panel.hidden)setOpen(true,chosen.length===0);});
trigger.addEventListener('click',()=>setOpen(true,true));
trigger.addEventListener('focus',()=>{if(panel.hidden)setOpen(true,chosen.length===0);});
shell.addEventListener('mouseenter',()=>clearTimeout(closeTimer));
shell.addEventListener('mouseleave',()=>{closeTimer=setTimeout(()=>setOpen(false),180);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
menu.addEventListener('change',async e=>{
 const input=e.target as HTMLInputElement;if(input.type!=='checkbox'||!data)return;
 const id=input.value as ModuleId;chosen=input.checked?[...chosen.filter(x=>x!==id),id]:chosen.filter(x=>x!==id);
 render({...data,selectedModules:chosen});
 try{await api.choose(chosen);error.hidden=true;}catch{error.textContent='选择保存失败，请重试';error.hidden=false;render(await api.getState());}
});
content.addEventListener('click',e=>{
 const el=e.target as HTMLElement,card=el.closest<HTMLElement>('[data-card-detail]'),slot=el.closest<HTMLElement>('[data-set-slot]');
 if(card)void api.detail({id:Number(card.dataset.cardDetail)});else if(slot)void api.detail({slot:Number(slot.dataset.setSlot)});
});
new ResizeObserver(measure).observe(shell);
api.onHidden(()=>setOpen(false));
setOpen(false);
api.subscribe(render);render(await api.getState());
