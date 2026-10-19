import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCatalog} from '../dist/data/catalog.js';
import {downloadCardDetail,parseCardDetail} from '../dist/data/card-detail.js';
const raw={id:94344242,cid:12307,text:{md_name:'电子光虫－焊接网蜘蛛',types:'[怪兽|效果] 昆虫/光\n[★3] 500/1500',desc:'①：效果\n②：效果'}};
test('catalog preserves password mapping and detail identity is checked against both IDs',()=>{
 assert.equal(parseCatalog([{id:12307,name:'蜘蛛',kind:1,level:3,ydk_id:94344242}])[12307].password,94344242);
 assert.equal(parseCardDetail(raw,12307,94344242).description,raw.text.desc);
 for(const bad of [{...raw,id:1},{...raw,cid:1},{...raw,text:{name:'卡'}}])assert.throws(()=>parseCardDetail(bad,12307,94344242));
});
test('detail fetch uses fixed endpoint, rejects redirects and invalid identifiers',async()=>{
 const detail=await downloadCardDetail(12307,94344242,async(url,options)=>{assert.equal(url,'https://ygocdb.com/api/v0/card/94344242');assert.equal(options.redirect,'manual');return new Response(JSON.stringify(raw));});
 assert.match(detail.image,/94344242.jpg!half$/);
 await assert.rejects(downloadCardDetail(12307,94344242,async()=>new Response(null,{status:302,headers:{location:'https://other.invalid'}})));
 await assert.rejects(downloadCardDetail(12307,NaN,async()=>{throw Error('should not fetch');}),/编号无效/);
});
