import { loadParams } from '../../training/paramPersistence';
import { getLearningStats } from '../../training/onlineLearning';
import {
  createPixelButton,
  createPixelModalSurface,
  createPixelToast,
  mountPixelSurface,
} from './pixelFrame';

function calculateAICapability(): number {
  try {
    const paramsFile = loadParams();
    const trainingState = paramsFile.trainingState;
    const learningStats = getLearningStats();

    const stepScore = Math.min(30, (trainingState.currentStep / 1000) * 30);
    const winRateScore = learningStats.winRate * 40;

    let qualityScore = 0;
    if (trainingState.bestFitness && trainingState.bestFitness !== -Infinity && trainingState.bestFitness !== -999999 && trainingState.bestFitness > -999999) {
      const normalizedFitness = Math.max(0, Math.min(1, (trainingState.bestFitness + 1000) / 2000));
      qualityScore = normalizedFitness * 30;
    }

    const totalScore = Math.round(stepScore + winRateScore + qualityScore);
    return Math.min(100, Math.max(0, totalScore));
  } catch (error) {
    console.error('[AICapability] Failed to calculate:', error);
    return 50;
  }
}

export function renderAIParamsButton(): HTMLElement {
  const capability = calculateAICapability();
  const variant = capability >= 70 ? 'success' : capability >= 40 ? 'accent' : 'danger';
  const btn = createPixelButton(`AI ${capability}/100`, variant);
  btn.onclick = () => {
    const existing = document.getElementById('ai-params-panel');
    if (existing) {
      existing.previousElementSibling?.remove();
      existing.remove();
      return;
    }
    renderAIParamsPanel();
  };
  return btn;
}

export function renderAIParamsPanel(): HTMLElement {
  const surface = createPixelModalSurface({
    title: 'AI Parameters',
    subtitle: 'TRAINING / FITNESS / PARAMS',
    width: 'min(94vw, 540px)',
  });

  surface.panel.id = 'ai-params-panel';

  const paramsFile = loadParams();
  const params = paramsFile.params as Record<string, unknown>;
  const trainingState = paramsFile.trainingState;
  const learningStats = getLearningStats();
  const capability = calculateAICapability();

  surface.body.appendChild(renderCapability(capability));
  surface.body.appendChild(renderStats(trainingState, learningStats));
  surface.body.appendChild(renderParams(params));

  const resetBtn = createPixelButton('Reset', 'danger');
  resetBtn.onclick = () => {
    if (confirm('Reset all AI parameters to default values?')) {
      const { resetParams } = require('../../training/paramPersistence');
      resetParams();
      createPixelToast('RESET');
      surface.close();
    }
  };

  const exportBtn = createPixelButton('Export', 'success');
  exportBtn.onclick = () => {
    const json = JSON.stringify(paramsFile, null, 2);
    navigator.clipboard.writeText(json).then(() => createPixelToast('COPIED'));
  };

  surface.footer.appendChild(resetBtn);
  surface.footer.appendChild(exportBtn);
  mountPixelSurface(surface);
  return surface.panel;
}

function renderCapability(capability: number): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">CAPABILITY</div>
      <div class="pixel-page-section__subtitle">CURRENT SCORE</div>
    </div>
    <div class="pixel-page-section__body">
      <div class="pixel-stat">
        <div class="pixel-stat__label">AI SCORE</div>
        <div class="pixel-stat__value">${capability}/100</div>
      </div>
    </div>
  `;
  return section;
}

function renderStats(trainingState: any, learningStats: ReturnType<typeof getLearningStats>): HTMLElement {
  const bestFitness = !trainingState.bestFitness || trainingState.bestFitness === -Infinity || trainingState.bestFitness === -999999 || trainingState.bestFitness === null
    ? 'N/A'
    : trainingState.bestFitness.toFixed(0);
  const acceptRate = trainingState.acceptCount + trainingState.rejectCount > 0
    ? `${((trainingState.acceptCount / (trainingState.acceptCount + trainingState.rejectCount)) * 100).toFixed(1)}%`
    : 'N/A';

  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">TRAINING STATS</div>
      <div class="pixel-page-section__subtitle">CURRENT RUN</div>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'pixel-page-section__body';
  body.appendChild(createKv('Training Steps', String(trainingState.currentStep)));
  body.appendChild(createKv('Best Fitness', bestFitness));
  body.appendChild(createKv('Accept Rate', acceptRate));
  body.appendChild(createKv('Games Played', String(learningStats.gamesPlayed)));
  body.appendChild(createKv('AI Win Rate', `${(learningStats.winRate * 100).toFixed(1)}%`));
  section.appendChild(body);
  return section;
}

function renderParams(params: Record<string, unknown>): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">PARAM LIST</div>
      <div class="pixel-page-section__subtitle">READ ONLY</div>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'pixel-page-section__body';

  const categories: Record<string, string[]> = {
    'Shanten & Stage': ['xiangtingBase', 'pimproveNStageA', 'pimproveNStageB', 'stageFactorB'],
    'Risk & Defense': ['basePloseScale', 'stageFactorPloseB', 'stageFactorPloseC', 'genbutsuRiskScale', 'dingQueRiskScale', 'turnRiskFactor'],
    'Value & Score': ['baseWinValue', 'speedBonusK', 'firstWinBonus', 'baseLoss'],
    'Meld Penalties': ['informationPenaltyPengA', 'informationPenaltyPengB', 'informationPenaltyGangA', 'informationPenaltyGangB'],
    Multipliers: ['stageMultiplierA', 'stageMultiplierB', 'stageMultiplierC', 'oppNotHuMultiplier'],
  };

  for (const [category, keys] of Object.entries(categories)) {
    const block = document.createElement('div');
    block.className = 'pixel-note-box';

    const title = document.createElement('div');
    title.className = 'pixel-page-section__title';
    title.style.fontSize = '11px';
    title.textContent = category;
    block.appendChild(title);

    const list = document.createElement('div');
    list.className = 'pixel-kv';
    list.style.marginTop = '8px';

    for (const key of keys) {
      if (key in params) {
        const rawValue = params[key];
        const value = typeof rawValue === 'number'
          ? (Number.isInteger(rawValue) ? rawValue.toString() : rawValue.toFixed(4))
          : String(rawValue);
        list.appendChild(createKv(key, value));
      }
    }

    block.appendChild(list);
    body.appendChild(block);
  }

  section.appendChild(body);
  return section;
}

function createKv(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pixel-kv__row';
  row.innerHTML = `<span class="pixel-kv__label">${label}</span><span class="pixel-kv__value">${value}</span>`;
  return row;
}
