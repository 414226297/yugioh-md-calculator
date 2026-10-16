import {app,BrowserWindow,ipcMain,screen,net} from 'electron';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {DuelStore} from '../domain/store.js';import {validateDeck,type Snapshot} from '../domain/model.js';
import {parseCatalog} from '../data/catalog.js';import {ReaderHost} from './reader-host.js';import {defaults,validateConfig} from './config.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dataDir=process.env.MD_TEST_MODE==='1'?path.join(root,'test-results','app-data'):path.join(root,'local-data');
mkdirSync(dataDir,{recursive:true});app.setPath('userData',path.join(dataDir,'electron'));
const store=new DuelStore();let win:BrowserWindow;let host:ReaderHost;let config=defaults();let notice='';let catalogMessage='';let downloading=false;
const read=(name:string)=>{try{return JSON.parse(readFileSync(path.join(dataDir,name),'utf8'));}catch{return null;}};
function save(name:string,value:unknown){const file=path.join(dataDir,name);writeFileSync(file+'.tmp',JSON.stringify(value,null,2));renameSync(file+'.tmp',file);}
function payload(){return {...store.view(),notice,catalogMessage,config};}
function publish(){if(win&&!win.isDestroyed())win.webContents.send('state',payload());}
function begin(){if(process.env.MD_TEST_MODE==='1')return;store.paused=false;store.error='';host.start({MD_SCRY_PATH:config.modulePath,MD_UNITY_VERSION:config.unityVersion,MD_INTERVAL:String(config.interval)});}
async function updateCatalog(){
  if(downloading)return;downloading=true;catalogMessage='正在获取卡片属性';publish();
  try{
    const response=await net.fetch('https://ygomjson.untapped.gg/v1/latest/en-us/cards.json',{signal:AbortSignal.timeout(20000)});
    if(!response.ok||new URL(response.url).hostname!=='ygomjson.untapped.gg')throw Error(`下载失败 ${response.status}`);
    const catalog=parseCatalog(await response.json());if(Object.keys(catalog).length<1000)throw Error('卡片数据库不完整');
    store.catalog=catalog;save('catalog.json',{source:response.url,fetchedAt:Date.now(),cards:catalog});catalogMessage='卡片属性已更新';
  }catch(e){catalogMessage=`属性更新失败，${Object.keys(store.catalog).length?'继续使用本地缓存':'需要联网重试'}：${String(e)}`;}
  finally{downloading=false;publish();}
}
app.whenReady().then(async()=>{
  try{config=validateConfig({...config,...read('config.json')});}catch{notice='设置文件无效，已使用默认设置';}
  const cachedDeck=read('deck.json');if(cachedDeck&&validateDeck(cachedDeck))store.deck=cachedDeck;
  const cached=read('catalog.json');if(cached?.cards)store.catalog=cached.cards;
  const area=screen.getPrimaryDisplay().workArea;
  win=new BrowserWindow({width:Math.min(config.width,area.width),height:Math.min(config.height,area.height),minWidth:320,minHeight:480,x:area.x+area.width-Math.min(config.width,area.width),y:area.y,frame:false,backgroundColor:'#1e2228',title:'联栗炮助手',alwaysOnTop:false,
    webPreferences:{preload:fileURLToPath(new URL('./preload.cjs',import.meta.url)),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  notice=notice||'请将 MD 放在左侧，助手放在右侧；空间不足时请调整游戏窗口。';
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
  host=new ReaderHost(fileURLToPath(new URL('../reader/worker.js',import.meta.url)),value=>{
    const s=value as Snapshot;if(!s||!['waiting','menu','duel','error'].includes(s.status))return;
    store.accept(s);if(s.deck&&validateDeck(s.deck))save('deck.json',s.deck);publish();
  },reason=>{store.error=reason;publish();});
  ipcMain.handle('state',()=>payload());
  ipcMain.handle('command',async(event,command:string,value:any)=>{
    if(event.sender!==win.webContents)throw Error('无效来源');
    try{
      switch(command){
        case 'minimize':win.minimize();break;
        case 'close':win.close();break;
        case 'confirmDeck':store.confirmDeck();break;
        case 'deck':store.setDeck(value);save('deck.json',store.deck);break;
        case 'counts':store.setCounts(value);break;
        case 'monsters':store.setMonsters(value);break;
        case 'inventory':store.setInventory(value.extra,value.banished);break;
        case 'restore':store.restore();break;
        case 'pause':host.stop();store.paused=true;break;
        case 'resume':case 'reconnect':begin();break;
        case 'catalog':await updateCatalog();break;
        case 'config':config=validateConfig(value);save('config.json',config);win.setSize(config.width,config.height);begin();break;
        case 'dismissNotice':notice='';break;
        case 'export':save('diagnostic.json',{time:new Date().toISOString(),app:'0.1.0',status:store.snapshot?.status,error:store.error,logLength:store.snapshot?.logLength,inventoryQuality:store.view().inventory.quality,catalogCount:Object.keys(store.catalog).length});notice=`诊断已保存：${path.join(dataDir,'diagnostic.json')}`;break;
        default:throw Error('未知操作');
      }
      publish();return {ok:true};
    }catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)};}
  });
  if(process.env.MD_TEST_MODE==='1')ipcMain.handle('test:state',(_e,fixture)=>{
    store.restore();store.error='';store.paused=false;store.deck=fixture.deck;store.catalog=fixture.catalog;
    if(fixture.sequence){for(const snapshot of fixture.sequence)store.accept(snapshot);}else{store.accept(fixture.snapshot);store.confirmDeck();}
    if(fixture.inventory)store.setInventory(fixture.inventory.extra,fixture.inventory.banished);
    publish();return payload();
  });
  await win.loadFile(fileURLToPath(new URL('../ui/index.html',import.meta.url)));
  begin();setInterval(publish,500).unref();
  if(!Object.keys(store.catalog).length&&process.env.MD_TEST_MODE!=='1')void updateCatalog();
});
app.on('window-all-closed',()=>{host?.stop();app.quit();});
app.on('before-quit',()=>host?.stop());
