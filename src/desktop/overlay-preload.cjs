const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('overlay',{
 getState:()=>ipcRenderer.invoke('overlay:state'),
 select:slot=>ipcRenderer.invoke('overlay:select',slot),
 close:()=>ipcRenderer.invoke('overlay:close'),
 cardDetail:id=>ipcRenderer.invoke('card-detail',id),
 subscribe:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('overlay:state',listener);return ()=>ipcRenderer.removeListener('overlay:state',listener);}
});
