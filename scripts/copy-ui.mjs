import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist/ui', { recursive: true });
cpSync('src/ui/index.html', 'dist/ui/index.html');
cpSync('src/ui/style.css', 'dist/ui/style.css');
cpSync('src/desktop/preload.cjs', 'dist/desktop/preload.cjs');
