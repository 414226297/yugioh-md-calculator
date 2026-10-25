import test from 'node:test';
import assert from 'node:assert/strict';
import {sidebarHeight} from '../dist/domain/sidebar-layout.js';
test('sidebar shrinks to measured content and grows until the configured or screen limit',()=>{
 assert.equal(sidebarHeight(230.2,850,1080),231);
 assert.equal(sidebarHeight(680,850,1080),680);
 assert.equal(sidebarHeight(1400,850,1080),850);
 assert.equal(sidebarHeight(1400,850,720),720);
 assert.equal(sidebarHeight(50,850,1080),100);
});
test('invalid measurements are not used to size the native sidebar',()=>{
 for(const height of [0,-1,NaN,Infinity])assert.equal(sidebarHeight(height,850,1080),0);
});
