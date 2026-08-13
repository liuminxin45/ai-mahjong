import fs from 'node:fs';
const CYR = /GUAFENG_XIАYU/g; // 西里尔 А (U+0410)
const LAT = 'GUAFENG_XIAYU';     // 纯拉丁
for (const f of ['src/core/rules/packs/chengdu/patterns.ts', 'tests/guafeng-xiаyu.test.ts']) {
  const before = fs.readFileSync(f, 'utf8');
  const n = (before.match(CYR) || []).length;
  const after = before.replace(CYR, LAT);
  fs.writeFileSync(f, after, 'utf8');
  console.log(`${f}: 替换 ${n} 处西里尔标识符 → 纯拉丁`);
}
