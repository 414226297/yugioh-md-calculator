import {CardOverlay} from './card-overlay.js';
import {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage} from 'electron';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {DuelStore} from '../domain/store.js';import {validateDeck,type Snapshot} from '../domain/model.js';
import {downloadCatalog,needsChineseCatalog} from '../data/download-catalog.js';import {ReaderHost} from './reader-host.js';import {defaults,validateConfig,resolveModulePath,dataDirectory,redactLocalPaths} from './config.js';
import {fetchCatalogResponse} from './catalog-fetch.js';
import {downloadCardDetail,type CardDetail} from '../data/card-detail.js';
import {resolveSelectedDeck} from '../domain/deck-cache.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dataDir=dataDirectory(root,process.env.APPDATA??app.getPath('appData'),app.isPackaged,process.env.MD_TEST_MODE==='1');
mkdirSync(dataDir,{recursive:true});app.setPath('userData',path.join(dataDir,'electron'));
let overlay:CardOverlay|undefined;
let tray:Tray|undefined;let quitting=false;
function showMain(){if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();}
const store=new DuelStore();let win:BrowserWindow;let host:ReaderHost;let config=defaults();let notice='';let catalogMessage='';let downloading=false;
const read=(name:string)=>{try{return JSON.parse(readFileSync(path.join(dataDir,name),'utf8'));}catch{return null;}};
function save(name:string,value:unknown){const file=path.join(dataDir,name);writeFileSync(file+'.tmp',JSON.stringify(value,null,2));renameSync(file+'.tmp',file);}
let knownDecks:Record<string,unknown>={};let lastDeckSaved='';
function companionDecks(){
  if(process.env.MD_TEST_MODE==='1')return null;
  try{return JSON.parse(readFileSync(path.join(process.env.APPDATA??app.getPath('appData'),'untapped-companion','ygom','decks.json'),'utf8'));}catch{return null;}
}
function payload(){return {...store.view(),notice,catalogMessage,config};}
function publish(){if(win&&!win.isDestroyed())win.webContents.send('state',payload());overlay?.refresh();}
function begin(){
  if(process.env.MD_TEST_MODE==='1')return;store.paused=false;store.error='';
  config={...config,modulePath:resolveModulePath(config.modulePath)};
  if(!path.isAbsolute(config.modulePath)||!existsSync(config.modulePath)){
    host.stop();store.error='未找到本机读取模块。请安装兼容的 Untapped Companion，或在设置中填写本机 .node 模块路径后重新连接。';publish();return;
  }
  host.start({MD_SCRY_PATH:config.modulePath,MD_UNITY_VERSION:config.unityVersion,MD_INTERVAL:String(config.interval)});
}
async function updateCatalog(){
  if(downloading)return;downloading=true;catalogMessage='正在获取中文卡名与卡片属性';publish();
  try{
    const result=await downloadCatalog(fetchCatalogResponse);
    store.catalog=result.cards;save('catalog.json',{reportStyleVersion:1,source:result.source,fetchedAt:Date.now(),cards:result.cards});catalogMessage='中文卡名与卡片属性已更新';
  }catch(e){catalogMessage=`属性更新失败，${Object.keys(store.catalog).length?'继续使用本地缓存':'需要联网重试'}：${String(e)}`;}
  finally{downloading=false;publish();}
}
app.whenReady().then(async()=>{
  try{config=validateConfig({...config,...read('config.json')});}catch{notice='设置文件无效，已使用默认设置';}
  const cachedDeck=read('deck.json');if(cachedDeck&&validateDeck(cachedDeck))store.deck=cachedDeck;
  const cachedDecks=read('decks.json');if(cachedDecks&&typeof cachedDecks==='object'&&!Array.isArray(cachedDecks))knownDecks=cachedDecks;
  const cached=read('catalog.json');if(cached?.cards)store.catalog=cached.cards;
  const area=screen.getPrimaryDisplay().workArea;
  win=new BrowserWindow({width:Math.min(config.width,area.width),height:Math.min(config.height,area.height),minWidth:300,minHeight:480,x:area.x+area.width-Math.min(config.width,area.width),y:area.y,frame:false,backgroundColor:'#1e2228',title:'MD助手',alwaysOnTop:false,
    webPreferences:{preload:fileURLToPath(new URL('./preload.cjs',import.meta.url)),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
  overlay=new CardOverlay(()=>store.view(),()=>config);
  const trayIcon=nativeImage.createFromPath(fileURLToPath(new URL('../ui/assets/md/icon-GUI_T_Icon1_Attr08.png',import.meta.url))).resize({width:32,height:32});
  tray=new Tray(trayIcon);tray.setToolTip('MD助手');
  const trayMenu=Menu.buildFromTemplate([
    {id:'show',label:'显示 MD助手',click:showMain},
    {id:'hide',label:'隐藏窗口',click:()=>win.hide()},
    {type:'separator'},
    {id:'quit',label:'退出 MD助手',click:()=>app.quit()}
  ]);
  tray.setContextMenu(trayMenu);tray.on('click',showMain);tray.on('double-click',showMain);
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
  win.on('minimize',()=>{if(!quitting)win.hide();});
  if(process.env.MD_TEST_MODE==='1')ipcMain.handle('test:tray',(_event,id:string)=>{
    const item=trayMenu.getMenuItemById(id);if(!item)throw Error('Unknown tray action');item.click(undefined as any,undefined as any,{} as any);return true;
  });
  host=new ReaderHost(fileURLToPath(new URL('../reader/worker.js',import.meta.url)),value=>{
    const s=value as Snapshot;if(!s||!['waiting','menu','duel','error'].includes(s.status))return;
    const captured=s.cachedPreparationDeck;
    if(captured&&validateDeck(captured)&&Number.isSafeInteger(captured.revision)&&captured.revision!>0){
      const previous=knownDecks[captured.id];
      if(JSON.stringify(previous&&{...previous as object,readAt:0})!==JSON.stringify({...captured,readAt:0})){
        knownDecks[captured.id]=captured;save('decks.json',knownDecks);
      }
    }
    if(s.deckSource==='preparation'&&s.deckSelection&&!s.deck)s.deck=resolveSelectedDeck(s.deckSelection,knownDecks,companionDecks());
    store.accept(s);
    if(s.deck&&validateDeck(s.deck)){
      const signature=JSON.stringify({...s.deck,readAt:0});
      if(signature!==lastDeckSaved){
        save('deck.json',s.deck);lastDeckSaved=signature;
        if(s.deck.revision!==undefined){knownDecks[s.deck.id]=s.deck;save('decks.json',knownDecks);}
      }
    }
    publish();
  },reason=>{store.error=reason;publish();});
  ipcMain.handle('state',()=>payload());
  const detailCache:Record<number,CardDetail>=read('card-details.json')??{};
  const pendingDetails=new Map<number,Promise<CardDetail>>();
  let testDetails:Record<number,CardDetail>={};
  ipcMain.handle('card-detail',async(event,id:number)=>{
    try{
      if((event.sender!==win.webContents&&!overlay?.accepts(event.sender))||!Number.isInteger(id))throw Error('无效来源或卡片编号');
      const view=store.view(),hand=view.publicHand;
      if(![...hand.cards,...hand.uncertainCards].some(c=>c.id===id)&&!view.backrow.cards.some(c=>c.candidates.includes(id)))throw Error('这张卡已不在公开记录中');
      if(process.env.MD_TEST_MODE==='1'){
        if(!testDetails[id])throw Error('测试资料不可用');
        return {ok:true,detail:testDetails[id]};
      }
      const password=store.catalog[id]?.password;
      if(!password)throw Error('卡片编号映射尚未获取，请在设置中更新卡片属性后重试');
      if(detailCache[id]?.password===password)return {ok:true,detail:detailCache[id]};
      let request=pendingDetails.get(id);
      if(!request){request=downloadCardDetail(id,password,fetchCatalogResponse);pendingDetails.set(id,request);}
      try{const detail=await request;detailCache[id]=detail;save('card-details.json',detailCache);return {ok:true,detail};}
      finally{pendingDetails.delete(id);}
    }catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)};}
  });
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
        case 'export':save('diagnostic.json',{time:new Date().toISOString(),app:'0.3.0',status:store.snapshot?.status,error:redactLocalPaths(store.error),logLength:store.snapshot?.logLength,inventoryQuality:store.view().inventory.quality,catalogCount:Object.keys(store.catalog).length});notice=`诊断已保存：${path.join(dataDir,'diagnostic.json')}`;break;
        default:throw Error('未知操作');
      }
      publish();return {ok:true};
    }catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)};}
  });
  if(process.env.MD_TEST_MODE==='1')ipcMain.handle('test:window',(_e,frame)=>{overlay?.observe(frame);return true;});
  if(process.env.MD_TEST_MODE==='1')ipcMain.handle('test:state',(_e,fixture)=>{
    if(fixture.cardDetails)testDetails=fixture.cardDetails;
    store.restore();store.error='';store.paused=false;store.deck=fixture.deck;store.catalog=fixture.catalog;
    if(fixture.sequence){for(const snapshot of fixture.sequence)store.accept(snapshot);}else{store.accept(fixture.snapshot);store.confirmDeck();}
    if(fixture.inventory)store.setInventory(fixture.inventory.extra,fixture.inventory.banished);
    publish();return payload();
  });
  await win.loadFile(fileURLToPath(new URL('../ui/index.html',import.meta.url)));
  begin();setInterval(publish,500).unref();
  if((!Object.keys(store.catalog).length||needsChineseCatalog(cached)||cached?.reportStyleVersion!==1||!Object.values(store.catalog).some(c=>c.password&&c.category))&&process.env.MD_TEST_MODE!=='1')void updateCatalog();
});
app.on('window-all-closed',()=>{host?.stop();app.quit();});
app.on('activate',showMain);
app.on('before-quit',()=>{quitting=true;tray?.destroy();tray=undefined;overlay?.destroy();overlay=undefined;host?.stop();});
