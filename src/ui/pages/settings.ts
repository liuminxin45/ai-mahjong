import type { Difficulty, RuleId, UiMode } from '../../store/settingsStore';
import type { UiCtx } from '../context';

export function renderSettings(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Settings';

  const difficultyLabel = document.createElement('label');
  difficultyLabel.textContent = 'Difficulty: ';

  const difficulty = document.createElement('select');
  const options: Difficulty[] = ['low', 'mid', 'high'];
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    if (ctx.settingsStore.difficulty === o) opt.selected = true;
    difficulty.appendChild(opt);
  }
  difficulty.onchange = () => ctx.settingsStore.setDifficulty(difficulty.value as Difficulty);

  const ruleLabel = document.createElement('label');
  ruleLabel.textContent = 'Rule: ';

  const rule = document.createElement('select');
  const ruleOptions: RuleId[] = ['placeholder', 'chengdu'];
  for (const r of ruleOptions) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    if (ctx.settingsStore.ruleId === r) opt.selected = true;
    rule.appendChild(opt);
  }
  rule.onchange = () => ctx.settingsStore.setRuleId(rule.value as RuleId);

  const analysisLabel = document.createElement('label');
  analysisLabel.textContent = 'Analysis Enabled: ';

  const analysis = document.createElement('input');
  analysis.type = 'checkbox';
  analysis.checked = ctx.settingsStore.analysisEnabled;
  analysis.onchange = () => ctx.settingsStore.setAnalysisEnabled(analysis.checked);

  const llmLabel = document.createElement('label');
  llmLabel.textContent = 'LLM Enabled: ';

  const llm = document.createElement('input');
  llm.type = 'checkbox';
  llm.checked = ctx.settingsStore.llmEnabled;
  llm.onchange = () => ctx.settingsStore.setLlmEnabled(llm.checked);

  const uiModeLabel = document.createElement('label');
  uiModeLabel.textContent = 'UI Mode: ';

  const uiMode = document.createElement('select');
  const uiModeOptions: UiMode[] = ['DEBUG', 'TABLE'];
  for (const mode of uiModeOptions) {
    const opt = document.createElement('option');
    opt.value = mode;
    opt.textContent = mode;
    if (ctx.settingsStore.uiMode === mode) opt.selected = true;
    uiMode.appendChild(opt);
  }
  uiMode.onchange = () => ctx.settingsStore.setUiMode(uiMode.value as UiMode);

  const back = document.createElement('button');
  back.textContent = 'Back';
  back.onclick = () => {
    ctx.navigate('#/');
  };

  const row1 = document.createElement('div');
  row1.style.display = 'flex';
  row1.style.gap = '8px';
  row1.style.alignItems = 'center';
  row1.appendChild(difficultyLabel);
  row1.appendChild(difficulty);

  const rowRule = document.createElement('div');
  rowRule.style.display = 'flex';
  rowRule.style.gap = '8px';
  rowRule.style.alignItems = 'center';
  rowRule.appendChild(ruleLabel);
  rowRule.appendChild(rule);

  const row2 = document.createElement('div');
  row2.style.display = 'flex';
  row2.style.gap = '8px';
  row2.style.alignItems = 'center';
  row2.appendChild(analysisLabel);
  row2.appendChild(analysis);

  const row3 = document.createElement('div');
  row3.style.display = 'flex';
  row3.style.gap = '8px';
  row3.style.alignItems = 'center';
  row3.appendChild(llmLabel);
  row3.appendChild(llm);

  const rowUiMode = document.createElement('div');
  rowUiMode.style.display = 'flex';
  rowUiMode.style.gap = '8px';
  rowUiMode.style.alignItems = 'center';
  rowUiMode.appendChild(uiModeLabel);
  rowUiMode.appendChild(uiMode);

  root.appendChild(title);
  root.appendChild(row1);
  root.appendChild(rowRule);
  row1.style.marginBottom = '8px';
  rowRule.style.marginBottom = '8px';
  row2.style.marginBottom = '8px';
  row3.style.marginBottom = '8px';
  rowUiMode.style.marginBottom = '16px';
  root.appendChild(row2);
  root.appendChild(row3);
  root.appendChild(rowUiMode);
  root.appendChild(back);
}
