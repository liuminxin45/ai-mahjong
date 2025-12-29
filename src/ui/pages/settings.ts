import type { RuleId, UiMode } from '../../store/settingsStore';
import type { UiCtx } from '../context';
import { languageStore } from '../../store/languageStore';

export function renderSettings(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';
  
  const t = languageStore.t().settings;
  const tCommon = languageStore.t().common;

  const title = document.createElement('h2');
  title.textContent = t.title;

  const difficultyLabel = document.createElement('label');
  difficultyLabel.textContent = t.aiDifficulty;

  const difficultyValue = document.createElement('span');
  difficultyValue.textContent = t.aiDifficultyValue;
  difficultyValue.style.fontWeight = '600';
  difficultyValue.style.color = '#5cb85c';

  const ruleLabel = document.createElement('label');
  ruleLabel.textContent = t.rule;

  const rule = document.createElement('select');
  const ruleOptions: RuleId[] = ['placeholder', 'chengdu'];
  for (const r of ruleOptions) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r === 'chengdu' ? t.ruleChengdu : t.rulePlaceholder;
    if (ctx.settingsStore.ruleId === r) opt.selected = true;
    rule.appendChild(opt);
  }
  rule.onchange = () => ctx.settingsStore.setRuleId(rule.value as RuleId);

  const analysisLabel = document.createElement('label');
  analysisLabel.textContent = t.analysisEnabled;

  const analysis = document.createElement('input');
  analysis.type = 'checkbox';
  analysis.checked = ctx.settingsStore.analysisEnabled;
  analysis.onchange = () => ctx.settingsStore.setAnalysisEnabled(analysis.checked);


  const uiModeLabel = document.createElement('label');
  uiModeLabel.textContent = t.uiMode;

  const uiMode = document.createElement('select');
  const uiModeOptions: UiMode[] = ['DEBUG', 'TABLE'];
  for (const mode of uiModeOptions) {
    const opt = document.createElement('option');
    opt.value = mode;
    opt.textContent = mode === 'DEBUG' ? t.uiModeDebug : t.uiModeTable;
    if (ctx.settingsStore.uiMode === mode) opt.selected = true;
    uiMode.appendChild(opt);
  }
  uiMode.onchange = () => ctx.settingsStore.setUiMode(uiMode.value as UiMode);

  // 语言切换
  const languageLabel = document.createElement('label');
  languageLabel.textContent = t.language;

  const language = document.createElement('select');
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
    renderSettings(root, ctx); // 重新渲染以应用新语言
  };

  const back = document.createElement('button');
  back.textContent = tCommon.back;
  back.onclick = () => {
    ctx.navigate('#/');
  };

  const row1 = document.createElement('div');
  row1.style.display = 'flex';
  row1.style.gap = '8px';
  row1.style.alignItems = 'center';
  row1.appendChild(difficultyLabel);
  row1.appendChild(difficultyValue);

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


  const rowUiMode = document.createElement('div');
  rowUiMode.style.display = 'flex';
  rowUiMode.style.gap = '8px';
  rowUiMode.style.alignItems = 'center';
  rowUiMode.appendChild(uiModeLabel);
  rowUiMode.appendChild(uiMode);

  const timeoutLabel = document.createElement('label');
  timeoutLabel.textContent = t.timeoutEnabled;

  const timeout = document.createElement('input');
  timeout.type = 'checkbox';
  timeout.checked = ctx.settingsStore.timeoutEnabled;
  timeout.onchange = () => ctx.settingsStore.setTimeoutEnabled(timeout.checked);

  const timeoutMsLabel = document.createElement('label');
  timeoutMsLabel.textContent = t.timeoutMs;

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
  p0AILabel.textContent = t.p0AIMode;
  p0AILabel.style.fontWeight = '600';
  p0AILabel.style.color = '#d9534f';

  const p0AI = document.createElement('input');
  p0AI.type = 'checkbox';
  p0AI.checked = ctx.settingsStore.p0IsAI;
  p0AI.onchange = () => {
    ctx.settingsStore.setP0IsAI(p0AI.checked);
    if (p0AI.checked) {
      alert(t.p0AIModeAlert);
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


  // ========== 训练控制区域 ==========
  const trainingSection = document.createElement('div');
  trainingSection.style.padding = '12px';
  trainingSection.style.backgroundColor = '#e3f2fd';
  trainingSection.style.border = '2px solid #2196f3';
  trainingSection.style.borderRadius = '6px';
  trainingSection.style.marginTop = '16px';

  const trainingSectionTitle = document.createElement('h3');
  trainingSectionTitle.textContent = t.trainingStatus;
  trainingSectionTitle.style.marginTop = '0';
  trainingSectionTitle.style.marginBottom = '12px';
  trainingSectionTitle.style.color = '#1976d2';

  // 训练局数输入
  const trainingGamesLabel = document.createElement('label');
  trainingGamesLabel.textContent = t.trainingGames;

  const trainingGamesInput = document.createElement('input');
  trainingGamesInput.type = 'number';
  trainingGamesInput.value = '100';
  trainingGamesInput.min = '1';
  trainingGamesInput.max = '10000';
  trainingGamesInput.style.width = '100px';

  const rowTrainingGames = document.createElement('div');
  rowTrainingGames.style.display = 'flex';
  rowTrainingGames.style.gap = '8px';
  rowTrainingGames.style.alignItems = 'center';
  rowTrainingGames.style.marginBottom = '8px';
  rowTrainingGames.appendChild(trainingGamesLabel);
  rowTrainingGames.appendChild(trainingGamesInput);

  // 阻塞模式开关
  const blockingLabel = document.createElement('label');
  blockingLabel.textContent = t.trainingBlocking;

  const blockingCheckbox = document.createElement('input');
  blockingCheckbox.type = 'checkbox';
  blockingCheckbox.checked = false;

  const rowBlocking = document.createElement('div');
  rowBlocking.style.display = 'flex';
  rowBlocking.style.gap = '8px';
  rowBlocking.style.alignItems = 'center';
  rowBlocking.style.marginBottom = '8px';
  rowBlocking.appendChild(blockingLabel);
  rowBlocking.appendChild(blockingCheckbox);

  // 详细日志开关
  const verboseLabel = document.createElement('label');
  verboseLabel.textContent = t.trainingVerbose;

  const verboseCheckbox = document.createElement('input');
  verboseCheckbox.type = 'checkbox';
  verboseCheckbox.checked = false;

  const rowVerbose = document.createElement('div');
  rowVerbose.style.display = 'flex';
  rowVerbose.style.gap = '8px';
  rowVerbose.style.alignItems = 'center';
  rowVerbose.style.marginBottom = '12px';
  rowVerbose.appendChild(verboseLabel);
  rowVerbose.appendChild(verboseCheckbox);

  // 训练进度显示
  const progressDiv = document.createElement('div');
  progressDiv.style.marginBottom = '12px';
  progressDiv.style.padding = '8px';
  progressDiv.style.backgroundColor = 'white';
  progressDiv.style.borderRadius = '4px';
  progressDiv.style.display = 'none'; // 默认隐藏

  const progressText = document.createElement('div');
  progressText.textContent = `${t.trainingProgress}: 0/0`;
  progressText.style.marginBottom = '4px';

  const progressBar = document.createElement('div');
  progressBar.style.width = '100%';
  progressBar.style.height = '20px';
  progressBar.style.backgroundColor = '#e0e0e0';
  progressBar.style.borderRadius = '10px';
  progressBar.style.overflow = 'hidden';

  const progressBarFill = document.createElement('div');
  progressBarFill.style.width = '0%';
  progressBarFill.style.height = '100%';
  progressBarFill.style.backgroundColor = '#4caf50';
  progressBarFill.style.transition = 'width 0.3s';

  progressBar.appendChild(progressBarFill);
  progressDiv.appendChild(progressText);
  progressDiv.appendChild(progressBar);

  // 训练统计显示
  const statsDiv = document.createElement('div');
  statsDiv.style.fontSize = '12px';
  statsDiv.style.color = '#666';
  statsDiv.style.marginBottom = '12px';
  statsDiv.style.display = 'none'; // 默认隐藏
  statsDiv.innerHTML = `
    <div>${t.trainingBestFitness}: <span id="bestFitness">-</span></div>
    <div>${t.trainingCurrentFitness}: <span id="currentFitness">-</span></div>
    <div>${t.trainingAcceptRate}: <span id="acceptRate">-</span></div>
  `;

  // 开始/停止训练按钮
  const startButton = document.createElement('button');
  startButton.textContent = t.startTraining;
  startButton.style.padding = '8px 16px';
  startButton.style.backgroundColor = '#4caf50';
  startButton.style.color = 'white';
  startButton.style.border = 'none';
  startButton.style.borderRadius = '4px';
  startButton.style.cursor = 'pointer';
  startButton.style.fontWeight = '600';

  const stopButton = document.createElement('button');
  stopButton.textContent = t.stopTraining;
  stopButton.style.padding = '8px 16px';
  stopButton.style.backgroundColor = '#f44336';
  stopButton.style.color = 'white';
  stopButton.style.border = 'none';
  stopButton.style.borderRadius = '4px';
  stopButton.style.cursor = 'pointer';
  stopButton.style.fontWeight = '600';
  stopButton.style.display = 'none'; // 默认隐藏

  // 训练控制逻辑
  let trainingInterval: any = null;

  startButton.onclick = async () => {
    const games = parseInt(trainingGamesInput.value, 10);
    if (games < 1 || games > 10000) {
      alert('Training games must be between 1 and 10000');
      return;
    }

    // 显示进度
    progressDiv.style.display = 'block';
    statsDiv.style.display = 'block';
    startButton.style.display = 'none';
    stopButton.style.display = 'inline-block';

    // 动态导入训练模块
    const { AutoTrainer } = await import('../../training/autoRun');
    const { setAIParams } = await import('../../agents/algo/aiParams');
    const { loadParams } = await import('../../training/paramPersistence');

    // 加载参数
    const paramsFile = loadParams();
    setAIParams(paramsFile.params);

    // 创建训练器
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
        if (verboseCheckbox.checked) {
          console.log('[Training]', log);
        }
      }
    );

    // 更新进度
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

    // 开始训练
    trainer.start().catch((err) => {
      console.error('Training error:', err);
      clearInterval(trainingInterval);
      startButton.style.display = 'inline-block';
      stopButton.style.display = 'none';
      alert('Training failed: ' + err.message);
    });
  };

  stopButton.onclick = () => {
    if (trainingInterval) {
      clearInterval(trainingInterval);
    }
    startButton.style.display = 'inline-block';
    stopButton.style.display = 'none';
    alert('Training stopped');
  };

  const buttonRow = document.createElement('div');
  buttonRow.style.display = 'flex';
  buttonRow.style.gap = '8px';
  buttonRow.appendChild(startButton);
  buttonRow.appendChild(stopButton);

  trainingSection.appendChild(trainingSectionTitle);
  trainingSection.appendChild(rowTrainingGames);
  trainingSection.appendChild(rowBlocking);
  trainingSection.appendChild(rowVerbose);
  trainingSection.appendChild(progressDiv);
  trainingSection.appendChild(statsDiv);
  trainingSection.appendChild(buttonRow);

  // 语言选择行
  const rowLanguage = document.createElement('div');
  rowLanguage.style.display = 'flex';
  rowLanguage.style.gap = '8px';
  rowLanguage.style.alignItems = 'center';
  rowLanguage.appendChild(languageLabel);
  rowLanguage.appendChild(language);

  root.appendChild(title);
  root.appendChild(row1);
  root.appendChild(rowRule);
  row1.style.marginBottom = '8px';
  rowRule.style.marginBottom = '8px';
  row2.style.marginBottom = '8px';
  rowUiMode.style.marginBottom = '8px';
  rowLanguage.style.marginBottom = '8px';
  rowTimeout.style.marginBottom = '8px';
  rowTimeoutMs.style.marginBottom = '16px';
  root.appendChild(row2);
  root.appendChild(rowUiMode);
  root.appendChild(rowLanguage);
  root.appendChild(rowTimeout);
  root.appendChild(rowTimeoutMs);
  rowP0AI.style.marginBottom = '16px';
  root.appendChild(rowP0AI);
  root.appendChild(trainingSection);
  trainingSection.style.marginBottom = '16px';
  root.appendChild(back);
}
