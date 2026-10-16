const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cannon',{
  version:'0.1.1', getState:()=>ipcRenderer.invoke('state'),
  command:(name,value)=>ipcRenderer.invoke('command',name,value),
  subscribe:(callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('state',listener);return ()=>ipcRenderer.removeListener('state',listener);}
});
