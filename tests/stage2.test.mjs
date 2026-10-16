import test from 'node:test'; import assert from 'node:assert/strict';
import {solve} from '../dist/domain/solver.js'; import {inventory,catalog,scene} from './fixtures/scenes.mjs';
const run=(s=scene(),i=inventory())=>solve(s.counts,s.monsters,i,catalog);
test('SOLVE-01: total9 target rank5 gives two rank4 plus level1',()=>{
 const r=run(); assert.equal(r.status,'ready');assert.deepEqual(r.plans,[{rank:4,level:1,targetKind:'rank',target:5,returnRank:4,returnLevel:1,usesPrevious:false}]);
});
test('SOLVE-02: first stage possible, second impossible at total11 target5',()=>{
 const s=scene();s.counts.myHand=3;assert.equal(run(s).status,'none');
});
test('SOLVE-03: two different card names of same rank valid, one copy insufficient',()=>{
 const i=inventory();i.extra=i.extra.filter(s=>s.id!==9612);assert.equal(run(scene(),i).status,'none');
});
test('SOLVE-04: returns may use previously banished cards',()=>{
 const i=inventory();i.banished=[{id:13825,count:1,face:'up'},{id:17385,count:1,face:'up'}];
 const s=scene();s.monsters[0]={uid:1,kind:'level',value:7,faceUp:true};
 const r=run(s,i);assert.ok(r.plans.some(p=>p.rank===4&&p.level===1&&p.returnRank===3&&p.returnLevel===4&&p.usesPrevious));
});
test('face-down cards cannot provide returns, unknown is not zero',()=>{
 const i=inventory();i.banished=[{id:13825,count:1,face:'down'},{id:17385,count:1,face:'down'}];
 const s=scene();s.monsters[0].value=7;assert.equal(run(s,i).plans.some(p=>p.returnRank===3&&p.returnLevel===4),false);
 i.banished[0].face='unknown';assert.equal(run(s,i).status,'uncertain');
});
test('exhaustive complete deck solutions obey both equations and inventory',()=>{
 for(let n=0;n<=40;n++)for(let target=1;target<=15;target++){
 const s=scene();s.counts={myHand:n,opponentHand:0,myField:0,opponentField:0};s.monsters[0].value=target;
 const r=run(s);const expected=[];
 for(let rank=2;rank<=5;rank++)for(let level=1;level<=7;level++)if(2*rank+level===n&&rank+level===target)expected.push([rank,level]);
 assert.deepEqual(r.plans.map(p=>[p.rank,p.level]),expected,`n=${n},target=${target}`);
 }
});
