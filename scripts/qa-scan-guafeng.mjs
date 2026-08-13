import fs from 'node:fs';
for (const f of ['src/core/rules/packs/chengdu/patterns.ts', 'src/llm/RuleContext.ts', 'tests/guafeng-xiаyu.test.ts']) {
  const s = fs.readFileSync(f, 'utf8');
  const lat = (s.match(/GUAFENG_XIAYU/g) || []).length; // 纯拉丁
  const cyr = (s.match(/GUAFENG_XIАYU/g) || []).length; // 西里尔 А
  console.log(`${f}  latin(GUAFENG_XIAYU)=${lat}  cyrillic(GUAFENG_XIАYU)=${cyr}`);
}
