import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.cwd(), 'dist');
for (const relative of ['dev']) {
  const target = path.join(dist, relative);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}
if (fs.existsSync(path.join(dist, 'dev'))) throw new Error('Internal verification route still exists in the website build.');
console.log('Internal verification routes removed from website output.');
