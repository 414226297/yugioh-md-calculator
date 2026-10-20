import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist/ui', { recursive: true });
cpSync('src/ui/assets','dist/ui/assets',{recursive:true});
cpSync('src/ui/index.html', 'dist/ui/index.html');
cpSync('src/ui/style.css', 'dist/ui/style.css');
cpSync('src/desktop/preload.cjs', 'dist/desktop/preload.cjs');

for(const name of ['overlay.html','overlay.css'])cpSync('src/ui/'+name,'dist/ui/'+name);
for(const name of ['overlay-preload.cjs','window-tracker.ps1'])cpSync('src/desktop/'+name,'dist/desktop/'+name);
