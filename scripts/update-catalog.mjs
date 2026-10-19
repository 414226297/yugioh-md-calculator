import {mkdirSync,writeFileSync,readFileSync,renameSync} from 'node:fs';
import {downloadCatalog} from '../dist/data/download-catalog.js';
const {source,cards}=await downloadCatalog(fetch);
const deck=JSON.parse(readFileSync('local-data/deck.json','utf8'));
for(const id of Object.keys(deck.extra))if(!cards[id])throw Error(`卡片属性缺失 ${id}`);
mkdirSync('local-data',{recursive:true});writeFileSync('local-data/catalog.json.tmp',JSON.stringify({source,fetchedAt:Date.now(),cards}));renameSync('local-data/catalog.json.tmp','local-data/catalog.json');
console.log(`PASS catalog download: ${Object.keys(cards).length} cards; all ${Object.keys(deck.extra).length} extra card types mapped`);
