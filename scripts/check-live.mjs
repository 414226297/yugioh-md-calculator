import {execFileSync} from 'node:child_process';
import {NativeReader} from '../dist/reader/native-reader.js';
import {mkdirSync,writeFileSync} from 'node:fs';
const pid=Number(execFileSync('powershell.exe',['-NoProfile','-Command','Get-Process masterduel | Select-Object -ExpandProperty Id'],{encoding:'utf8'}).trim());
const modulePath=process.env.MD_SCRY_PATH??process.env.LOCALAPPDATA+'/Programs/untapped-companion/resources/app.asar.unpacked/node_modules/untapped-scry/lib/binding/napi-v5/untapped-scry.node';
const snapshot=new NativeReader(modulePath,pid,'6000.0.61f1').read();
mkdirSync('local-data',{recursive:true});
writeFileSync('local-data/live-snapshot.json',JSON.stringify(snapshot,null,2));
console.log(JSON.stringify({status:snapshot.status,counts:snapshot.counts,extra:snapshot.extraCount,banished:snapshot.banishedCount,events:snapshot.moves.length,completeLog:snapshot.completeLog,deck:snapshot.deck&&{name:snapshot.deck.name,main:Object.values(snapshot.deck.main).reduce((a,b)=>a+b,0),extra:Object.values(snapshot.deck.extra).reduce((a,b)=>a+b,0),kinds:Object.keys(snapshot.deck.extra).length}},null,2));
if(process.argv.includes('--deck')) {
 if(!snapshot.deck||Object.values(snapshot.deck.main).reduce((a,b)=>a+b,0)!==40||Object.values(snapshot.deck.extra).reduce((a,b)=>a+b,0)!==15||Object.keys(snapshot.deck.extra).length!==13)throw Error('DECK-01实机验收失败');
 writeFileSync('local-data/deck.json',JSON.stringify(snapshot.deck,null,2));
 console.log('PASS DECK-01 live');
}
