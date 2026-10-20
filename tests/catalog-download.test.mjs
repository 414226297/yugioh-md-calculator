import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadCatalog,catalogURL,needsChineseCatalog} from '../dist/data/download-catalog.js';
import {parseCatalog} from '../dist/data/catalog.js';
test('field subtype is preserved and old spell caches are refreshed',()=>{
 const cards=parseCatalog([{id:4338,name:'山',kind:13,spell_type:2},{id:4837,name:'融合',kind:13,spell_type:null}]);
 assert.equal(cards[4338].fieldSpell,true);assert.equal(cards[4837].fieldSpell,false);
 assert.equal(needsChineseCatalog({source:catalogURL,cards}),false);
 assert.equal(needsChineseCatalog({source:catalogURL,cards:{4338:{category:'spell'}}}),true);
});
const dataset=()=>Array.from({length:1001},(_,i)=>({id:i+1,name:`Fixture ${i+1}`,kind:3,level:1}));
test('fresh Electron-style response with empty URL still loads validated card attributes',async()=>{
 const result=await downloadCatalog(async(url,options)=>{
  assert.equal(url,catalogURL);assert.equal(options.redirect,'manual');
  return new Response(JSON.stringify(dataset()),{status:200});
 });
 assert.equal(result.source,catalogURL);assert.equal(Object.keys(result.cards).length,1001);
 assert.equal(result.cards[1].kind,'fusion');
});
test('explicit same-host redirects retain a valid source when response URL is blank',async()=>{
 const seen=[];
 const result=await downloadCatalog(async(url)=>{seen.push(url);return seen.length===1?new Response(null,{status:302,headers:{location:'/v1/fixture/en-us/cards.json'}}):new Response(JSON.stringify(dataset()));});
 assert.equal(seen.length,2);assert.equal(result.source,'https://ygomjson.untapped.gg/v1/fixture/en-us/cards.json');
});
test('cross-host, non-HTTPS and credential-bearing redirects are rejected before fetching target',async()=>{
 for(const target of ['https://example.com/cards.json','http://ygomjson.untapped.gg/cards.json','https://user:example@ygomjson.untapped.gg/cards.json']){
  let requests=0;await assert.rejects(downloadCatalog(async()=>{requests++;return new Response(null,{status:302,headers:{location:target}});}),/不受信任/);assert.equal(requests,1);
 }
});
test('incomplete attributes and HTTP failures are never accepted as a ready catalog',async()=>{
 await assert.rejects(downloadCatalog(async()=>new Response('[]')),/不完整/);
 await assert.rejects(downloadCatalog(async()=>new Response(null,{status:503})),/503/);
});
test('redirect loops are bounded',async()=>{
 let count=0;await assert.rejects(downloadCatalog(async()=>{count++;return new Response(null,{status:302,headers:{location:catalogURL}});}),/次数过多/);assert.equal(count,6);
});
test('Chinese names are requested and preserved, old English caches require migration',async()=>{
 assert.match(catalogURL,/\/zh-cn\/cards\.json$/);
 const data=dataset();data[0].name='愚蠢埋葬';
 const result=await downloadCatalog(async()=>new Response(JSON.stringify(data)));
 assert.equal(result.cards[1].name,'愚蠢埋葬');
 assert.equal(needsChineseCatalog({source:'https://ygomjson.untapped.gg/v1/24462996.5/en-us/cards.json',cards:{}}),true);
 assert.equal(needsChineseCatalog({source:'https://ygomjson.untapped.gg/v1/24462996.5/zh-cn/cards.json',cards:{}}),false);
 assert.equal(needsChineseCatalog(null),true);
});
