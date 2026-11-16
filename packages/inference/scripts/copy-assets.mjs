import { cpSync, mkdirSync } from 'node:fs';
const target = new URL('../dist/image/scripts/', import.meta.url);
mkdirSync(target, { recursive: true });
cpSync(new URL('../src/image/scripts/', import.meta.url), target, { recursive: true });
