import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.cwd(), 'dist');
const spaSource = path.join(dist, 'login', 'index.html');
if (!fs.existsSync(spaSource)) throw new Error('Authentication SPA entry is missing; cannot create public form entries.');
const spa = fs.readFileSync(spaSource, 'utf8');
for (const route of ['reportabuse']) {
  const output = path.join(dist, route, 'index.html');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, spa);
}
console.log('Public SPA entries created for interactive public forms.');
