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

  const timeoutLabel = document.createElement('label');
  timeoutLabel.textContent = 'Timeout Enabled: ';

  const timeout = document.createElement('input');
  timeout.type = 'checkbox';
  timeout.checked = ctx.settingsStore.timeoutEnabled;
  timeout.onchange = () => ctx.settingsStore.setTimeoutEnabled(timeout.checked);

  const timeoutMsLabel = document.createElement('label');
  timeoutMsLabel.textContent = 'Timeout (ms): ';

  const timeoutMsInput = document.createElement('input');
  timeoutMsInput.type = 'number';
  timeoutMsInput.value = String(ctx.settingsStore.timeoutMs);
  timeoutMsInput.min = '1000';
  timeoutMsInput.max = '120000';
  timeoutMsInput.step = '1000';
  timeoutMsInput.style.width = '100px';
  timeoutMsInput.onchange = () => {
    const val = parseInt(timeoutMsInput.value, 10);
    if (!isNaN(val) && val >= 1000) {
      ctx.settingsStore.setTimeoutMs(val);
    }
  };

  const rowTimeout = document.createElement('div');
  rowTimeout.style.display = 'flex';
  rowTimeout.style.gap = '8px';
  rowTimeout.style.alignItems = 'center';
  rowTimeout.appendChild(timeoutLabel);
  rowTimeout.appendChild(timeout);

  const rowTimeoutMs = document.createElement('div');
  rowTimeoutMs.style.display = 'flex';
  rowTimeoutMs.style.gap = '8px';
  rowTimeoutMs.style.alignItems = 'center';
  rowTimeoutMs.appendChild(timeoutMsLabel);
  rowTimeoutMs.appendChild(timeoutMsInput);

  // P0 AI 模式开关
  const p0AILabel = document.createElement('label');
  p0AILabel.textContent = 'P0 AI Mode (for testing): ';
  p0AILabel.style.fontWeight = '600';
  p0AILabel.style.color = '#d9534f';

  const p0AI = document.createElement('input');
  p0AI.type = 'checkbox';
  p0AI.checked = ctx.settingsStore.p0IsAI;
  p0AI.onchange = () => {
    ctx.settingsStore.setP0IsAI(p0AI.checked);
    if (p0AI.checked) {
      alert('P0 AI mode enabled. Please start a new game to see full AI vs AI gameplay.');
    }
  };

  const rowP0AI = document.createElement('div');
  rowP0AI.style.display = 'flex';
  rowP0AI.style.gap = '8px';
  rowP0AI.style.alignItems = 'center';
  rowP0AI.style.padding = '8px';
  rowP0AI.style.backgroundColor = '#fff3cd';
  rowP0AI.style.border = '1px solid #ffc107';
  rowP0AI.style.borderRadius = '4px';
  rowP0AI.appendChild(p0AILabel);
  rowP0AI.appendChild(p0AI);

  root.appendChild(title);
  root.appendChild(row1);
  root.appendChild(rowRule);
  row1.style.marginBottom = '8px';
  rowRule.style.marginBottom = '8px';
  row2.style.marginBottom = '8px';
  row3.style.marginBottom = '8px';
  rowUiMode.style.marginBottom = '8px';
  rowTimeout.style.marginBottom = '8px';
  rowTimeoutMs.style.marginBottom = '16px';
  root.appendChild(row2);
  root.appendChild(row3);
  root.appendChild(rowUiMode);
  root.appendChild(rowTimeout);
  root.appendChild(rowTimeoutMs);
  rowP0AI.style.marginBottom = '16px';
  root.appendChild(rowP0AI);
  root.appendChild(back);
}
