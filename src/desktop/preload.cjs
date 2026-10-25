const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cannon',{
  onSettingsPage:(callback)=>{const listener=(_event,page)=>callback(page);ipcRenderer.on('settings:page',listener);return ()=>ipcRenderer.removeListener('settings:page',listener);},
  sidebarLayout:value=>ipcRenderer.invoke('sidebar:layout',value),
  version:'0.3.0', getState:()=>ipcRenderer.invoke('state'),
  command:(name,value)=>ipcRenderer.invoke('command',name,value),
  cardDetail:(id)=>ipcRenderer.invoke('card-detail',id),
  subscribe:(callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('state',listener);return ()=>ipcRenderer.removeListener('state',listener);}
});
