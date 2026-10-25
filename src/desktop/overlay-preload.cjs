const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('moduleOverlay',{
 getState:()=>ipcRenderer.invoke('modules:state'),
 choose:ids=>ipcRenderer.invoke('modules:choose',ids),
 height:value=>ipcRenderer.invoke('modules:height',value),
 detail:value=>ipcRenderer.invoke('modules:detail',value),
 onHidden:callback=>{ipcRenderer.on('modules:hidden',callback);return ()=>ipcRenderer.removeListener('modules:hidden',callback);},
 subscribe:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('overlay:state',listener);return ()=>ipcRenderer.removeListener('overlay:state',listener);}
});
contextBridge.exposeInMainWorld('overlay',{
 getState:()=>ipcRenderer.invoke('overlay:state'),
 select:(slot,preview=false)=>ipcRenderer.invoke('overlay:select',slot,preview),
 close:()=>ipcRenderer.invoke('overlay:close'),
 cardDetail:id=>ipcRenderer.invoke('card-detail',id),
 subscribe:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('overlay:state',listener);return ()=>ipcRenderer.removeListener('overlay:state',listener);}
});

contextBridge.exposeInMainWorld('preparationOverlay',{
 getState:()=>ipcRenderer.invoke('overlay:state'),
 layout:regions=>ipcRenderer.invoke('preparation:layout',regions),
 onHidden:callback=>{const listener=()=>callback();ipcRenderer.on('preparation:hidden',listener);return ()=>ipcRenderer.removeListener('preparation:hidden',listener);},
 subscribe:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('overlay:state',listener);return ()=>ipcRenderer.removeListener('overlay:state',listener);}
});
