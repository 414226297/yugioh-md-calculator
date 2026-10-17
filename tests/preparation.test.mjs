import test from 'node:test';
import assert from 'node:assert/strict';
import {readPreparation} from '../dist/reader/preparation.js';
import {resolveSelectedDeck} from '../dist/domain/deck-cache.js';
import {DuelStore} from '../dist/domain/store.js';
import {deck,catalog,scene} from './fixtures/scenes.mjs';
const ref=o=>({get(k){if(!(k in o))throw Error(`No field ${k}`);return o[k];},getClassName:()=>''});
const list=a=>ref({_size:a.length,_items:{at:i=>a[i]}});
const dict=o=>{const a=Object.entries(o).map(([key,value])=>ref({key,value}));return ref({_count:a.length,_entries:{at:i=>a[i]}});};
const ids=counts=>Object.entries(counts).flatMap(([id,n])=>Array(n).fill(+id));
const metadata=dict({name:deck.name,et:10});
const contents=dict({m:dict({ids:list(ids(deck.main))}),e:dict({ids:list(ids(deck.extra))})});
const widget=(path,rentalState=0)=>ref({buttonInfo:ref({isSetDeck:true,rentalState,deckManager:ref({pm:ref({path:ref({deck_list:path})})})})});
const view=(items,index=0)=>ref({modeBehaviour:ref({colosseumDeckWidget:ref({colosseumDecks:list(items),toggleGroup:ref({m_ToggleGroupWidget:ref({m_CurrentIdx:index})})})})});
const root=(full=true)=>dict({Deck:dict({list:dict({'1':metadata})}),DeckList:full?dict({'1':contents}):null});
const selection={id:'1',name:deck.name,revision:10,cacheId:'1'};
const cached={...deck,id:'1',revision:10};
const menu=(d=cached,selectionValue=selection)=>({...scene(),status:'menu',session:null,deckSource:'preparation',deckSelection:selectionValue,deck:d});

test('preparation reads full main/extra from selected widget path without deck editor',()=>{
 const s=readPreparation(view([widget('$.Deck.list.1')]),root());
 assert.deepEqual(s.deckSelection,selection);assert.deepEqual(s.deck.main,deck.main);assert.deepEqual(s.deck.extra,deck.extra);
});
test('active tab controls event deck selection instead of first tab or remembered name',()=>{
 const r=dict({EXHDeck:dict({list:dict({'7':metadata})}),EXHDeckList:dict({'7':contents})});
 const s=readPreparation(view([widget('$.Deck.list.1'),widget('$.EXHDeck.list.7')],1),r);
 assert.equal(s.deck.id,'EXHDeck:7');assert.equal(s.deckSelection.cacheId,'EXH_7_Deck');
});
test('unloaded card list retains identity but never creates a fake empty deck',()=>{
 const s=readPreparation(view([widget('$.Deck.list.1')]),root(false));
 assert.equal(s.deck,null);assert.deepEqual(s.deckSelection,selection);
});
test('Duelist Cup uses a fixed deck root and separate card list without a numeric deck id',()=>{
 const r=dict({CUPDeck:metadata,CUPDeckList:contents});
 const s=readPreparation(view([widget('$.CUPDeck')]),r);
 assert.equal(s.deck.id,'CUPDeck');assert.equal(s.deckSelection.cacheId,'CUP_Deck');
 assert.deepEqual(s.deck.extra,deck.extra);
});
test('missing extra region is unknown, not a valid zero-card extra deck',()=>{
 const r=dict({CUPDeck:metadata,CUPDeckList:dict({m:dict({ids:list(ids(deck.main))})})});
 assert.throws(()=>readPreparation(view([widget('$.CUPDeck')]),r),/缺失/);
});
test('rental and unsupported paths never fall back to another tab or account node',()=>{
 assert.equal(readPreparation(view([widget('$.Deck.list.1',1)]),root()).deckSelection,null);
 assert.throws(()=>readPreparation(view([widget('$.User.profile')]),root()),/路径/);
 assert.throws(()=>readPreparation(view([widget('$.Deck.list.1')],2),root()),/选项/);
});
test('cache requires exact live id, revision and name, including imported local records',()=>{
 assert.ok(resolveSelectedDeck(selection,{'1':cached},null));
 const external={'1':{...cached,edited:10}};
 assert.ok(resolveSelectedDeck(selection,{},external));
 for(const changed of [{...selection,revision:11},{...selection,id:'2',cacheId:'2'},{...selection,name:'changed'},{...selection,revision:0}]){
  assert.equal(resolveSelectedDeck(changed,{'1':cached},external),null);
 }
 assert.equal(resolveSelectedDeck(selection,{}, {'1':{...external['1'],main:{}}}),null);
});
test('preparation works for consecutive games and deck switching, without editor or confirmation',()=>{
 const s=new DuelStore();s.catalog=catalog;s.accept(menu());assert.equal(s.view().deckReady,true);
 s.accept(scene());assert.equal(s.view().deckReady,true);
 s.accept(menu());s.accept({...scene(),session:'second'});assert.equal(s.view().deckReady,true);
 s.accept(menu({...cached,id:'2',extra:{}},{...selection,id:'2'}));
 s.accept({...scene(),session:'third',extraCount:0});
 assert.equal(s.deck.id,'2');assert.equal(s.view().inventory.extra.length,0);assert.equal(s.view().deckReady,true);
});
test('localized event labels may differ but event identity and edited revision must match',()=>{
 const selected={id:'CUPDeck',cacheId:'CUP_Deck',name:'DUELIST CUP',revision:10,localizedName:true};
 const external={'CUP_Deck':{...cached,id:'CUP_Deck',name:'Duelist Cup Deck',edited:10}};
 const d=resolveSelectedDeck(selected,{},external);assert.equal(d.name,'DUELIST CUP');
 assert.equal(resolveSelectedDeck({...selected,revision:11},{},external),null);
 assert.equal(resolveSelectedDeck({...selected,cacheId:'WCS_Deck'},{},external),null);
});
test('missing or revised selected deck clears the old ready state and prevents stale binding',()=>{
 const s=new DuelStore();s.catalog=catalog;s.accept(menu());
 s.accept(menu(null,{...selection,id:'2'}));assert.equal(s.deck,null);assert.equal(s.view().deckReady,false);
 s.accept(scene());assert.equal(s.view().result.plans.length,0);assert.equal(s.boundSession,null);
});
