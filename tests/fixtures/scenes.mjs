// 人工重建自会话实测；不是原始内存或日志导出。
export const cards = [
  {id:4740,name:'千眼纳祭神',kind:'fusion',value:1},
  {id:9612,name:'侵入魔人·蟑螂',kind:'xyz',value:4},
  {id:10942,name:'励辉士 入魔蝇王',kind:'xyz',value:4},
  {id:13825,name:'No.75',kind:'xyz',value:3},
  {id:17645,name:'No.2',kind:'xyz',value:2},
  {id:17383,name:'神碑之翼 胡基',kind:'fusion',value:2},
  {id:17384,name:'神碑之翼 穆宁',kind:'fusion',value:3},
  {id:17385,name:'神碑之牙 格利',kind:'fusion',value:4},
  {id:17796,name:'神碑之牙 弗力奇',kind:'fusion',value:5},
  {id:17746,name:'共命之翼',kind:'fusion',value:6},
  {id:14910,name:'日出侠',kind:'fusion',value:7},
  {id:21380,name:'K9-17',kind:'xyz',value:5},
  {id:21381,name:'K9-00',kind:'xyz',value:5},
  {id:19921,name:'联栗炮固定式',kind:'other',value:0},
];
export const catalog = Object.fromEntries(cards.map(c=>[c.id,c]));
export const deck = {id:'fixture-deck-001', name:'白银城（测试样例）', readAt:1, main:Object.fromEntries(Array.from({length:40},(_,i)=>[30000+i,1])), extra:{4740:1,9612:1,10942:1,13825:2,17645:2,17383:1,17384:1,17385:1,17796:1,17746:1,14910:1,21380:1,21381:1}};
export const inventory = () => ({extra:Object.entries(deck.extra).map(([id,count])=>({id:+id,count,face:'up'})),banished:[],quality:'confirmed',reasons:[]});
export const scene = () => ({status:'duel',session:'test-game-1',timestamp:Date.now(),counts:{myHand:1,opponentHand:2,myField:4,opponentField:2},monsters:[{uid:87,kind:'rank',value:5,faceUp:true}],myTeam:0,extraCount:15,banishedCount:0,moves:[],logLength:11,completeLog:true,deck:null,busy:false});
export const move = (index,id,from,to,extra={}) => ({key:`${index}:0`,index,cardId:id,player:0,targetPlayer:0,from,to,action:to===17?18:33,face:'up',affectsInventory:true,...extra});
