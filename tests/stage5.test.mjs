import test from 'node:test';import assert from 'node:assert/strict';
import {defaults,validateConfig} from '../dist/desktop/config.js';
import {DuelStore} from '../dist/domain/store.js';import {catalog,deck,scene} from './fixtures/scenes.mjs';
test('settings reject unsupported interval, unsafe relative paths and unusable sizes',()=>{
 assert.equal(validateConfig(defaults()).interval,500);
 for(const c of [{interval:1},{width:100},{readerBackend:'companion',modulePath:'module.node'},{unityVersion:'invalid'}])assert.throws(()=>validateConfig({...defaults(),...c}));
});
test('cached deck alone does not display acquisition success',()=>{
 const store=new DuelStore();store.deck=deck;store.catalog=catalog;store.accept({...scene(),status:'menu',session:null});assert.equal(store.view().deckReady,false);
 store.accept({...scene(),status:'menu',session:null,deck});assert.equal(store.view().deckReady,true);
});
