const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cannon',{
  version:'0.2.0', getState:()=>ipcRenderer.invoke('state'),
  command:(name,value)=>ipcRenderer.invoke('command',name,value),
  cardDetail:(id)=>ipcRenderer.invoke('card-detail',id),
  subscribe:(callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('state',listener);return ()=>ipcRenderer.removeListener('state',listener);}
});
