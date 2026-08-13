import fs from 'node:fs';
const f = 'tests/guafeng-xiаyu.test.ts';
const s = fs.readFileSync(f, 'utf8');
let found = [];
for (let i = 0; i < s.length; i++) {
  const c = s.charCodeAt(i);
  if (c >= 0x400 && c <= 0x4ff) found.push('U+' + c.toString(16).toUpperCase() + ' ' + JSON.stringify(s[i]) + ' @' + i);
}
console.log('cyrillic found:', found.length, found.slice(0, 8).join(' | '));
const m = s.match(/GUAFENG_XI.{1,3}YU/g);
if (m) {
  console.log('GUAFENG variants:', [...new Set(m)].map(x => [...x].map(c => c.charCodeAt(0) > 127 ? '[U+' + c.charCodeAt(0).toString(16).toUpperCase() + ']' : c).join('')));
} else { console.log('no GUAFENG match'); }
