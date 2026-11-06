import {mkdirSync,writeFileSync,readFileSync,renameSync,existsSync} from 'node:fs';
import {downloadCatalog} from '../dist/data/download-catalog.js';
const previous=existsSync('local-data/catalog.json')?JSON.parse(readFileSync('local-data/catalog.json','utf8')).cards??{}:{};
const result=await downloadCatalog(fetch);
const added=Object.keys(result.cards).filter(id=>!previous[id]);
const cards={...previous,...result.cards};
mkdirSync('local-data',{recursive:true});writeFileSync('local-data/catalog.json.tmp',JSON.stringify({reportStyleVersion:1,source:result.source,fetchedAt:Date.now(),cards}));renameSync('local-data/catalog.json.tmp','local-data/catalog.json');
console.log(JSON.stringify({source:result.source,previousCount:Object.keys(previous).length,count:Object.keys(cards).length,added:added.length,newCards:added.map(id=>({id:+id,name:cards[id].name}))},null,2));
