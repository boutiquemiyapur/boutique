import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// This Vite project deploys one function per API file on Vercel Hobby.
const sourceExtensions = /\.(?:[cm]?js|[cm]?ts|jsx|tsx|py|go|rb)$/;
const entries = [];
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (sourceExtensions.test(entry.name) && !entry.name.endsWith('.d.ts')) entries.push(relative(process.cwd(), path));
  }
}
scan('api');
if (entries.length > 12) throw Error(`Vercel Hobby supports 12 functions; found ${entries.length}. Move shared handlers outside api/ and consolidate entrypoints before deployment.\n${entries.sort().join('\n')}`);
console.log(`Vercel Hobby function budget: ${entries.length}/12.`);
