import { cp, mkdir } from 'node:fs/promises';
await mkdir('lib',{recursive:true});
await cp('src/styles.css','lib/styles.css');
