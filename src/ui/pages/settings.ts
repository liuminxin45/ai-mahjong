import type { RuleId, UiMode } from '../../store/settingsStore';
import type { UiCtx } from '../context';
import { languageStore } from '../../store/languageStore';

export function renderSettings(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';

  const t = languageStore.t().settings;
  const tCommon = languageStore.t().common;

  const container = document.createElement('div');
  container.className = 'animate-fadeIn';
  container.style.cssText = 'max-width:700px; margin:0 auto; padding:var(--sp-6);';

  // Title
  const title = document.createElement('h2');
  title.style.cssText = 'color:var(--c-accent); margin-bottom:var(--sp-6);';
  title.textContent = t.title;

  // Helper for form rows
  const makeRow = (label: string, control: HTMLElement, description?: string): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'form-row';
    const lbl = document.createElement('label');
    lbl.className = 'form-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    row.appendChild(control);
    if (description) {
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:var(--fs-xs); color:var(--text-muted); margin-top:2px;';
      desc.textContent = description;
      row.appendChild(desc);
    }
    return row;
  };

  // --- Game Settings Card ---
  const gameCard = document.createElement('div');
  gameCard.className = 'card';
  gameCard.style.marginBottom = 'var(--sp-4)';

  const gameCardTitle = document.createElement('h3');
  gameCardTitle.style.cssText = 'color:var(--text-primary); margin-bottom:var(--sp-3);';
  gameCardTitle.textContent = '⚙️ ' + (t.title || 'Game Settings');
  gameCard.appendChild(gameCardTitle);

  // AI Difficulty
  const difficultyValue = document.createElement('span');
  difficultyValue.style.cssText = 'font-weight:var(--fw-semibold); color:var(--c-success);';
  difficultyValue.textContent = t.aiDifficultyValue;
  gameCard.appendChild(makeRow(t.aiDifficulty, difficultyValue));

  // Rule selection
  const rule = document.createElement('select');
  rule.className = 'form-select';
  const ruleOptions: RuleId[] = ['placeholder', 'chengdu'];
  for (const r of ruleOptions) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r === 'chengdu' ? t.ruleChengdu : t.rulePlaceholder;
    if (ctx.settingsStore.ruleId === r) opt.selected = true;
    rule.appendChild(opt);
  }
  rule.onchange = () => ctx.settingsStore.setRuleId(rule.value as RuleId);
  gameCard.appendChild(makeRow(t.rule, rule));

  // UI Mode
  const uiMode = document.createElement('select');
  uiMode.className = 'form-select';
  const uiModeOptions: UiMode[] = ['DEBUG', 'TABLE'];
  for (const mode of uiModeOptions) {
    const opt = document.createElement('option');
    opt.value = mode;
    opt.textContent = mode === 'DEBUG' ? t.uiModeDebug : t.uiModeTable;
    if (ctx.settingsStore.uiMode === mode) opt.selected = true;
    uiMode.appendChild(opt);
  }
  uiMode.onchange = () => ctx.settingsStore.setUiMode(uiMode.value as UiMode);
  gameCard.appendChild(makeRow(t.uiMode, uiMode));

  // Language
  const language = document.createElement('select');
  language.className = 'form-select';
  const langOptions = [
    { value: 'zh', label: t.languageChinese },
    { value: 'en', label: t.languageEnglish },
  ];
  for (const lang of langOptions) {
    const opt = document.createElement('option');
    opt.value = lang.value;
    opt.textContent = lang.label;
    if (languageStore.getLanguage() === lang.value) opt.selected = true;
    language.appendChild(opt);
  }
  language.onchange = () => {
    languageStore.setLanguage(language.value as 'zh' | 'en');
    renderSettings(root, ctx);
  };
  gameCard.appendChild(makeRow(t.language, language));

  // Analysis toggle
  const analysis = document.createElement('input');
  analysis.className = 'form-checkbox';
  analysis.type = 'checkbox';
  analysis.checked = ctx.settingsStore.analysisEnabled;
  analysis.onchange = () => ctx.settingsStore.setAnalysisEnabled(analysis.checked);
  gameCard.appendChild(makeRow(t.analysisEnabled, analysis));

  // Timeout toggle
  const timeout = document.createElement('input');
  timeout.className = 'form-checkbox';
  timeout.type = 'checkbox';
  timeout.checked = ctx.settingsStore.timeoutEnabled;
  timeout.onchange = () => ctx.settingsStore.setTimeoutEnabled(timeout.checked);
  gameCard.appendChild(makeRow(t.timeoutEnabled, timeout));

  // Timeout ms
  const timeoutMsInput = document.createElement('input');
  timeoutMsInput.className = 'form-input';
  timeoutMsInput.type = 'number';
  timeoutMsInput.value = String(ctx.settingsStore.timeoutMs);
  timeoutMsInput.min = '1000';
  timeoutMsInput.max = '120000';
  timeoutMsInput.step = '1000';
  timeoutMsInput.style.width = '120px';
  timeoutMsInput.onchange = () => {
    const val = parseInt(timeoutMsInput.value, 10);
    if (!isNaN(val) && val >= 1000) {
      ctx.settingsStore.setTimeoutMs(val);
    }
  };
  gameCard.appendChild(makeRow(t.timeoutMs, timeoutMsInput));

  // --- P0 AI Mode Card (highlighted) ---
  const aiCard = document.createElement('div');
  aiCard.className = 'card';
  aiCard.style.cssText = 'margin-bottom:var(--sp-4); border-color:var(--c-warning);';

  const p0AI = document.createElement('input');
  p0AI.className = 'form-checkbox';
  p0AI.type = 'checkbox';
  p0AI.checked = ctx.settingsStore.p0IsAI;
  p0AI.onchange = () => {
    ctx.settingsStore.setP0IsAI(p0AI.checked);
    if (p0AI.checked) alert(t.p0AIModeAlert);
  };

  const aiLabel = document.createElement('label');
  aiLabel.className = 'form-label';
  aiLabel.style.color = 'var(--c-warning)';
  aiLabel.textContent = '🤖 ' + t.p0AIMode;

  const aiRow = document.createElement('div');
  aiRow.className = 'form-row';
  aiRow.appendChild(aiLabel);
  aiRow.appendChild(p0AI);
  aiCard.appendChild(aiRow);

  // --- Training Section Card ---
  const trainingCard = document.createElement('div');
  trainingCard.className = 'card';
  trainingCard.style.marginBottom = 'var(--sp-4)';

  const trainingSectionTitle = document.createElement('h3');
  trainingSectionTitle.style.cssText = 'color:var(--c-primary-light); margin-bottom:var(--sp-3);';
  trainingSectionTitle.textContent = '🧠 ' + t.trainingStatus;
  trainingCard.appendChild(trainingSectionTitle);

  // Training games input
  const trainingGamesInput = document.createElement('input');
  trainingGamesInput.className = 'form-input';
  trainingGamesInput.type = 'number';
  trainingGamesInput.value = '100';
  trainingGamesInput.min = '1';
  trainingGamesInput.max = '10000';
  trainingGamesInput.style.width = '120px';
  trainingCard.appendChild(makeRow(t.trainingGames, trainingGamesInput));

  // Blocking mode
  const blockingCheckbox = document.createElement('input');
  blockingCheckbox.className = 'form-checkbox';
  blockingCheckbox.type = 'checkbox';
  blockingCheckbox.checked = false;
  trainingCard.appendChild(makeRow(t.trainingBlocking, blockingCheckbox));

  // Verbose mode
  const verboseCheckbox = document.createElement('input');
  verboseCheckbox.className = 'form-checkbox';
  verboseCheckbox.type = 'checkbox';
  verboseCheckbox.checked = false;
  trainingCard.appendChild(makeRow(t.trainingVerbose, verboseCheckbox));

  // Progress area (hidden by default)
  const progressDiv = document.createElement('div');
  progressDiv.style.cssText = 'margin:var(--sp-3) 0; display:none;';

  const progressText = document.createElement('div');
  progressText.style.cssText = 'margin-bottom:var(--sp-1); color:var(--text-secondary); font-size:var(--fs-sm);';
  progressText.textContent = `${t.trainingProgress}: 0/0`;

  const progressBar = document.createElement('div');
  progressBar.className = 'progress-track';

  const progressBarFill = document.createElement('div');
  progressBarFill.className = 'progress-fill';
  progressBarFill.style.width = '0%';

  progressBar.appendChild(progressBarFill);
  progressDiv.appendChild(progressText);
  progressDiv.appendChild(progressBar);
  trainingCard.appendChild(progressDiv);

  // Stats area (hidden by default)
  const statsDiv = document.createElement('div');
  statsDiv.style.cssText = 'font-size:var(--fs-xs); color:var(--text-muted); margin-bottom:var(--sp-3); display:none;';
  statsDiv.innerHTML = `
    <div>${t.trainingBestFitness}: <span id="bestFitness">-</span></div>
    <div>${t.trainingCurrentFitness}: <span id="currentFitness">-</span></div>
    <div>${t.trainingAcceptRate}: <span id="acceptRate">-</span></div>
  `;
  trainingCard.appendChild(statsDiv);

  // Training buttons
  const startButton = document.createElement('button');
  startButton.className = 'btn btn-success';
  startButton.textContent = t.startTraining;

  const stopButton = document.createElement('button');
  stopButton.className = 'btn btn-danger';
  stopButton.textContent = t.stopTraining;
  stopButton.style.display = 'none';

  let trainingInterval: any = null;

  startButton.onclick = async () => {
    const games = parseInt(trainingGamesInput.value, 10);
    if (games < 1 || games > 10000) {
      alert('Training games must be between 1 and 10000');
      return;
    }

    progressDiv.style.display = 'block';
    statsDiv.style.display = 'block';
    startButton.style.display = 'none';
    stopButton.style.display = 'inline-block';

    const { AutoTrainer } = await import('../../training/autoRun');
    const { setAIParams } = await import('../../agents/algo/aiParams');
    const { loadParams } = await import('../../training/paramPersistence');

    const paramsFile = loadParams();
    setAIParams(paramsFile.params);

    const trainer = new AutoTrainer(
      ctx.orchestrator,
      {
        totalGames: games,
        blocking: blockingCheckbox.checked,
        mode: 'baseline',
        batchSize: 1,
        ruleId: 'chengdu',
        trainPlayerId: 'P0',
        verbose: verboseCheckbox.checked,
      },
      (log) => {
        if (verboseCheckbox.checked) console.log('[Training]', log);
      }
    );

    trainingInterval = setInterval(() => {
      const progress = trainer.getProgress();
      if (progress.isRunning) {
        const percentage = (progress.currentGame / progress.totalGames) * 100;
        progressText.textContent = `${t.trainingProgress}: ${progress.currentGame}/${progress.totalGames} (${percentage.toFixed(1)}%)`;
        progressBarFill.style.width = `${percentage}%`;

        const bestFitnessEl = document.getElementById('bestFitness');
        const currentFitnessEl = document.getElementById('currentFitness');
        const acceptRateEl = document.getElementById('acceptRate');

        if (bestFitnessEl) bestFitnessEl.textContent = progress.bestFitness.toFixed(1);
        if (currentFitnessEl) currentFitnessEl.textContent = progress.currentFitness.toFixed(1);
        if (acceptRateEl) acceptRateEl.textContent = `${(progress.acceptRate * 100).toFixed(1)}%`;
      } else {
        clearInterval(trainingInterval);
        startButton.style.display = 'inline-block';
        stopButton.style.display = 'none';
        alert('Training completed!');
      }
    }, 500);

    trainer.start().catch((err) => {
      console.error('Training error:', err);
      clearInterval(trainingInterval);
      startButton.style.display = 'inline-block';
      stopButton.style.display = 'none';
      alert('Training failed: ' + err.message);
    });
  };

  stopButton.onclick = () => {
    if (trainingInterval) clearInterval(trainingInterval);
    startButton.style.display = 'inline-block';
    stopButton.style.display = 'none';
    alert('Training stopped');
  };

  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex; gap:var(--sp-2);';
  buttonRow.appendChild(startButton);
  buttonRow.appendChild(stopButton);
  trainingCard.appendChild(buttonRow);

  // Back button
  const back = document.createElement('button');
  back.className = 'btn btn-ghost btn-lg';
  back.style.marginTop = 'var(--sp-4)';
  back.textContent = tCommon.back;
  back.onclick = () => ctx.navigate('#/');

  // Assemble
  container.appendChild(title);
  container.appendChild(gameCard);
  container.appendChild(aiCard);
  container.appendChild(trainingCard);
  container.appendChild(back);
  root.appendChild(container);
}
