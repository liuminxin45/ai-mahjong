import type { RuleId, UiMode } from '../../store/settingsStore';
import type { UiCtx } from '../context';
import { languageStore } from '../../store/languageStore';
import { createPixelButton } from '../components/pixelFrame';
import { renderLLMSettingsPanel } from '../components/LLMSettingsPanel';
import { getActiveLLMProfile } from '../../llm/browserConfig';
import { getAiText } from '../aiLocale';
import { showPixelAlertDialog } from '../components/pixelDialog';

export function renderSettings(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';

  const t = languageStore.t().settings;
  const tCommon = languageStore.t().common;

  const page = document.createElement('div');
  page.className = 'pixel-app-page';

  const shell = document.createElement('section');
  shell.className = 'pixel-page-shell pixel-page-shell--compact';

  const header = document.createElement('div');
  header.className = 'pixel-page-header';

  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'pixel-page-title';
  title.textContent = t.title;
  const subtitle = document.createElement('div');
  subtitle.className = 'pixel-page-subtitle';
  subtitle.textContent = languageStore.getLanguage() === 'zh'
    ? '像素扁平设置台。所有控制统一到单层壳体内。'
    : 'Pixel-flat control desk. All controls stay in one shell.';
  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  const toolbar = document.createElement('div');
  toolbar.className = 'pixel-page-toolbar';
  const back = createPixelButton(tCommon.back, 'neutral');
  back.onclick = () => ctx.navigate('#/');
  toolbar.appendChild(back);

  header.appendChild(titleWrap);
  header.appendChild(toolbar);

  const body = document.createElement('div');
  body.className = 'pixel-page-body';

  body.appendChild(renderSettingsSection(ctx));
  body.appendChild(renderAISection(ctx));
  body.appendChild(renderTrainingSection(ctx));

  shell.appendChild(header);
  shell.appendChild(body);
  page.appendChild(shell);
  root.appendChild(page);
}

function renderSettingsSection(ctx: UiCtx): HTMLElement {
  const t = languageStore.t().settings;
  const section = createSection(t.title, languageStore.getLanguage() === 'zh' ? 'RULE / UI / LANGUAGE / TIMEOUT' : 'RULE / UI / LANGUAGE / TIMEOUT');
  const body = section.querySelector('.pixel-page-section__body') as HTMLElement;

  const difficultyRow = createInfoRow(t.aiDifficulty, t.aiDifficultyValue);
  body.appendChild(difficultyRow);

  const rule = document.createElement('select');
  rule.className = 'pixel-select';
  for (const optionValue of ['placeholder', 'chengdu'] as RuleId[]) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue === 'chengdu' ? t.ruleChengdu : t.rulePlaceholder;
    option.selected = ctx.settingsStore.ruleId === optionValue;
    rule.appendChild(option);
  }
  rule.onchange = () => ctx.settingsStore.setRuleId(rule.value as RuleId);
  body.appendChild(createField(t.rule, rule));

  const uiMode = document.createElement('select');
  uiMode.className = 'pixel-select';
  for (const optionValue of ['DEBUG', 'TABLE'] as UiMode[]) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue === 'DEBUG' ? t.uiModeDebug : t.uiModeTable;
    option.selected = ctx.settingsStore.uiMode === optionValue;
    uiMode.appendChild(option);
  }
  uiMode.onchange = () => ctx.settingsStore.setUiMode(uiMode.value as UiMode);
  body.appendChild(createField(t.uiMode, uiMode));

  const language = document.createElement('select');
  language.className = 'pixel-select';
  for (const lang of [
    { value: 'zh', label: t.languageChinese },
    { value: 'en', label: t.languageEnglish },
  ]) {
    const option = document.createElement('option');
    option.value = lang.value;
    option.textContent = lang.label;
    option.selected = languageStore.getLanguage() === lang.value;
    language.appendChild(option);
  }
  language.onchange = () => {
    languageStore.setLanguage(language.value as 'zh' | 'en');
  };
  body.appendChild(createField(t.language, language));

  const analysis = document.createElement('input');
  analysis.type = 'checkbox';
  analysis.className = 'pixel-checkbox';
  analysis.checked = ctx.settingsStore.analysisEnabled;
  analysis.onchange = () => ctx.settingsStore.setAnalysisEnabled(analysis.checked);
  body.appendChild(createInlineField(t.analysisEnabled, analysis));

  const timeout = document.createElement('input');
  timeout.type = 'checkbox';
  timeout.className = 'pixel-checkbox';
  timeout.checked = ctx.settingsStore.timeoutEnabled;
  timeout.onchange = () => ctx.settingsStore.setTimeoutEnabled(timeout.checked);
  body.appendChild(createInlineField(t.timeoutEnabled, timeout));

  const timeoutMsInput = document.createElement('input');
  timeoutMsInput.type = 'number';
  timeoutMsInput.className = 'pixel-input';
  timeoutMsInput.value = String(ctx.settingsStore.timeoutMs);
  timeoutMsInput.min = '1000';
  timeoutMsInput.max = '120000';
  timeoutMsInput.step = '1000';
  timeoutMsInput.oninput = () => {
    const val = parseInt(timeoutMsInput.value, 10);
    if (!Number.isNaN(val) && val >= 1000) {
      ctx.settingsStore.setTimeoutMs(val);
    }
  };
  body.appendChild(createField(t.timeoutMs, timeoutMsInput));

  return section;
}

function renderAISection(ctx: UiCtx): HTMLElement {
  const t = languageStore.t().settings;
  const aiText = getAiText().settings;
  const section = createSection(t.p0AIMode, t.p0AIModeDesc);
  const body = section.querySelector('.pixel-page-section__body') as HTMLElement;
  const activeProfile = getActiveLLMProfile();

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'pixel-checkbox';
  checkbox.checked = ctx.settingsStore.p0IsAI;
  checkbox.onchange = () => {
    ctx.settingsStore.setP0IsAI(checkbox.checked);
    if (checkbox.checked) {
      showPixelAlertDialog({
        title: t.title,
        code: 'P0 AI MODE',
        message: t.p0AIModeAlert,
      });
    }
  };

  body.appendChild(createInlineField(t.p0AIMode, checkbox));

  const llmEnabled = document.createElement('input');
  llmEnabled.type = 'checkbox';
  llmEnabled.className = 'pixel-checkbox';
  llmEnabled.checked = ctx.settingsStore.llmEnabled;
  llmEnabled.onchange = () => ctx.settingsStore.setLlmEnabled(llmEnabled.checked);
  body.appendChild(createInlineField(aiText.llmTutor, llmEnabled));

  body.appendChild(createInfoRow(aiText.provider, activeProfile ? activeProfile.kind === 'kimi_coding_anthropic' ? 'Kimi Coding / Anthropic' : aiText.providerOpenAICompatible : aiText.providerOff));
  body.appendChild(createInfoRow(aiText.model, activeProfile?.model || aiText.providerOff));

  const llmRow = document.createElement('div');
  llmRow.className = 'pixel-btn-row';
  const llmButton = createPixelButton(aiText.llmSettings, 'neutral');
  llmButton.onclick = () => renderLLMSettingsPanel();
  llmRow.appendChild(llmButton);
  body.appendChild(llmRow);
  return section;
}

function renderTrainingSection(ctx: UiCtx): HTMLElement {
  const t = languageStore.t().settings;
  const section = createSection(t.trainingStatus, languageStore.getLanguage() === 'zh' ? 'TRAINING / METRICS / CONTROL' : 'TRAINING / METRICS / CONTROL');
  const body = section.querySelector('.pixel-page-section__body') as HTMLElement;

  const trainingGamesInput = document.createElement('input');
  trainingGamesInput.type = 'number';
  trainingGamesInput.className = 'pixel-input';
  trainingGamesInput.value = String(ctx.settingsStore.trainingGames);
  trainingGamesInput.min = '1';
  trainingGamesInput.max = '10000';
  trainingGamesInput.oninput = () => {
    const val = parseInt(trainingGamesInput.value, 10);
    if (!Number.isNaN(val) && val >= 1) {
      ctx.settingsStore.setTrainingGames(val);
    }
  };
  body.appendChild(createField(t.trainingGames, trainingGamesInput));

  const blockingCheckbox = document.createElement('input');
  blockingCheckbox.type = 'checkbox';
  blockingCheckbox.className = 'pixel-checkbox';
  blockingCheckbox.checked = ctx.settingsStore.trainingBlocking;
  blockingCheckbox.onchange = () => ctx.settingsStore.setTrainingBlocking(blockingCheckbox.checked);
  body.appendChild(createInlineField(t.trainingBlocking, blockingCheckbox));

  const verboseCheckbox = document.createElement('input');
  verboseCheckbox.type = 'checkbox';
  verboseCheckbox.className = 'pixel-checkbox';
  verboseCheckbox.checked = ctx.settingsStore.trainingVerbose;
  verboseCheckbox.onchange = () => ctx.settingsStore.setTrainingVerbose(verboseCheckbox.checked);
  body.appendChild(createInlineField(t.trainingVerbose, verboseCheckbox));

  const progress = document.createElement('div');
  progress.className = 'pixel-progress';
  progress.style.display = 'none';

  const progressLabel = document.createElement('div');
  progressLabel.className = 'pixel-progress__label';
  progressLabel.innerHTML = `<span>${t.trainingProgress}</span><span>0/0</span>`;

  const track = document.createElement('div');
  track.className = 'pixel-progress__track';
  const fill = document.createElement('div');
  fill.className = 'pixel-progress__fill';
  fill.style.width = '0%';
  track.appendChild(fill);
  progress.appendChild(progressLabel);
  progress.appendChild(track);
  body.appendChild(progress);

  const stats = document.createElement('div');
  stats.className = 'pixel-kv';
  stats.style.display = 'none';
  stats.appendChild(createKvRow(t.trainingBestFitness, '-'));
  stats.appendChild(createKvRow(t.trainingCurrentFitness, '-'));
  stats.appendChild(createKvRow(t.trainingAcceptRate, '-'));
  body.appendChild(stats);

  const actions = document.createElement('div');
  actions.className = 'pixel-btn-row';

  const startButton = createPixelButton(t.startTraining, 'success');
  const stopButton = createPixelButton(t.stopTraining, 'danger');
  stopButton.style.display = 'none';

  let trainingInterval: ReturnType<typeof setInterval> | null = null;

  startButton.onclick = async () => {
    const games = parseInt(trainingGamesInput.value, 10);
    if (games < 1 || games > 10000) {
      showPixelAlertDialog({
        title: t.title,
        code: 'TRAINING',
        message: 'Training games must be between 1 and 10000',
      });
      return;
    }

    progress.style.display = 'grid';
    stats.style.display = 'grid';
    startButton.style.display = 'none';
    stopButton.style.display = 'inline-flex';

    const { AutoTrainer } = await import('../../training/autoRun');
    const { setAIParams } = await import('../../agents/algo/aiParams');
    const { loadParams } = await import('../../training/paramPersistence');

    const paramsFile = loadParams();
    setAIParams(paramsFile.params);

    const trainer = new AutoTrainer(
      ctx.orchestrator,
      {
        totalGames: games,
        blocking: ctx.settingsStore.trainingBlocking,
        mode: 'baseline',
        batchSize: 1,
        ruleId: 'chengdu',
        trainPlayerId: 'P0',
        verbose: ctx.settingsStore.trainingVerbose,
      },
      (log) => {
        if (ctx.settingsStore.trainingVerbose) console.log('[Training]', log);
      },
    );

    trainingInterval = setInterval(() => {
      const currentProgress = trainer.getProgress();
      if (currentProgress.isRunning) {
        const percentage = (currentProgress.currentGame / currentProgress.totalGames) * 100;
        progressLabel.innerHTML = `<span>${t.trainingProgress}</span><span>${currentProgress.currentGame}/${currentProgress.totalGames} (${percentage.toFixed(1)}%)</span>`;
        fill.style.width = `${percentage}%`;
        setKvValue(stats, 0, currentProgress.bestFitness.toFixed(1));
        setKvValue(stats, 1, currentProgress.currentFitness.toFixed(1));
        setKvValue(stats, 2, `${(currentProgress.acceptRate * 100).toFixed(1)}%`);
      } else {
        if (trainingInterval) clearInterval(trainingInterval);
        trainingInterval = null;
        startButton.style.display = 'inline-flex';
        stopButton.style.display = 'none';
        showPixelAlertDialog({
          title: t.title,
          code: 'TRAINING',
          message: 'Training completed!',
        });
      }
    }, 500);

    trainer.start().catch((err) => {
      console.error('Training error:', err);
      if (trainingInterval) clearInterval(trainingInterval);
      trainingInterval = null;
      startButton.style.display = 'inline-flex';
      stopButton.style.display = 'none';
      showPixelAlertDialog({
        title: t.title,
        code: 'TRAINING',
        message: `Training failed: ${err.message}`,
      });
    });
  };

  stopButton.onclick = () => {
    if (trainingInterval) clearInterval(trainingInterval);
    trainingInterval = null;
    startButton.style.display = 'inline-flex';
    stopButton.style.display = 'none';
    showPixelAlertDialog({
      title: t.title,
      code: 'TRAINING',
      message: 'Training stopped',
    });
  };

  actions.appendChild(startButton);
  actions.appendChild(stopButton);
  body.appendChild(actions);

  return section;
}

function createSection(title: string, subtitle?: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${title}</div>
      ${subtitle ? `<div class="pixel-page-section__subtitle">${subtitle}</div>` : ''}
    </div>
    <div class="pixel-page-section__body"></div>
  `;
  return section;
}

function createField(label: string, control: HTMLElement, description?: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pixel-field';

  const labelEl = document.createElement('label');
  labelEl.className = 'pixel-field__label';
  labelEl.textContent = label;
  wrap.appendChild(labelEl);

  wrap.appendChild(control);

  if (description) {
    const desc = document.createElement('div');
    desc.className = 'pixel-field__desc';
    desc.textContent = description;
    wrap.appendChild(desc);
  }

  return wrap;
}

function createInlineField(label: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pixel-field__inline';

  const labelEl = document.createElement('div');
  labelEl.className = 'pixel-field__label';
  labelEl.textContent = label;
  row.appendChild(labelEl);
  row.appendChild(control);
  return row;
}

function createInfoRow(label: string, value: string): HTMLElement {
  return createKvRow(label, value);
}

function createKvRow(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pixel-kv__row';
  row.innerHTML = `<span class="pixel-kv__label">${label}</span><span class="pixel-kv__value">${value}</span>`;
  return row;
}

function setKvValue(container: HTMLElement, index: number, value: string): void {
  const row = container.children[index] as HTMLElement | undefined;
  if (!row) return;
  const valueEl = row.querySelector('.pixel-kv__value');
  if (valueEl) valueEl.textContent = value;
}
