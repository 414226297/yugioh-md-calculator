import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {resolveModulePath,dataDirectory,redactLocalPaths} from '../dist/desktop/config.js';

test('reader discovery uses the new machine environment instead of a saved missing path',()=>{
 const profile=path.resolve('test-results','another-user');
 const env={LOCALAPPDATA:profile,ProgramFiles:path.resolve('test-results','program-files')};
 const wanted=path.join(profile,'Programs/untapped-companion/resources/app.asar.unpacked/node_modules/untapped-scry/lib/binding/napi-v5/untapped-scry.node');
 assert.equal(resolveModulePath(path.resolve('old-machine','module.node'),env,p=>p===wanted),wanted);
 const custom=path.resolve('custom-reader','reader.node');
 assert.equal(resolveModulePath(custom,env,p=>p===custom),custom);
 assert.equal(resolveModulePath(undefined,{...env,MD_SCRY_PATH:custom},()=>false),custom);
});

test('portable application stores data in the current user profile, not executable directory',()=>{
 const root=path.resolve('read-only-extracted-package','resources','app'),profile=path.resolve('new-user-profile');
 assert.equal(dataDirectory(root,profile,true,false),path.join(profile,'md-cannon-assistant'));
 assert.equal(dataDirectory(root,profile,false,false),path.join(root,'local-data'));
 assert.equal(dataDirectory(root,profile,true,true),path.join(root,'test-results','app-data'));
});

test('exported diagnostics redact local paths',()=>{
 const drive=String.fromCharCode(67)+':';
 assert.equal(redactLocalPaths(`Load failed: ${drive}\\Users\\sample\\module.node`),'Load failed: <local-path>');
 assert.equal(redactLocalPaths('failure in /home/example/reader'),'failure in <user-home>/reader');
});
