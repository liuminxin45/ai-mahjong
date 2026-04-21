import { loadParams } from '../../training/paramPersistence';
import { getLearningStats } from '../../training/onlineLearning';
import {
  createPixelButton,
  createPixelModalSurface,
  createPixelToast,
  mountPixelSurface,
} from './pixelFrame';
import { showPixelConfirmDialog } from './pixelDialog';
import { languageStore } from '../../store/languageStore';

function getAIParamsText() {
  return languageStore.t().aiParamsPanel;
}

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
  const text = getAIParamsText();
  const capability = calculateAICapability();
  const variant = capability >= 70 ? 'success' : capability >= 40 ? 'accent' : 'danger';
  const btn = createPixelButton(text.btnLabel(capability), variant);
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
  const text = getAIParamsText();
  const surface = createPixelModalSurface({
    title: text.panelTitle,
    subtitle: text.panelSubtitle,
    width: 'min(94vw, 540px)',
  });

  surface.panel.id = 'ai-params-panel';

  const paramsFile = loadParams();
  const params = paramsFile.params as unknown as Record<string, unknown>;
  const trainingState = paramsFile.trainingState;
  const learningStats = getLearningStats();
  const capability = calculateAICapability();

  surface.body.appendChild(renderCapability(capability));
  surface.body.appendChild(renderStats(trainingState, learningStats));
  surface.body.appendChild(renderParams(params));

  const resetBtn = createPixelButton(text.reset, 'danger');
  resetBtn.onclick = async () => {
    const confirmed = await showPixelConfirmDialog({
      title: text.panelTitle,
      code: text.resetCode,
      message: text.resetMessage,
      confirmText: text.reset,
    });
    if (confirmed) {
      const { resetParams } = require('../../training/paramPersistence');
      resetParams();
      createPixelToast(text.resetDone);
      surface.close();
    }
  };

  const exportBtn = createPixelButton(text.export, 'success');
  exportBtn.onclick = () => {
    const json = JSON.stringify(paramsFile, null, 2);
    navigator.clipboard.writeText(json).then(() => createPixelToast(text.copied));
  };

  surface.footer.appendChild(resetBtn);
  surface.footer.appendChild(exportBtn);
  mountPixelSurface(surface);
  return surface.panel;
}

function renderCapability(capability: number): HTMLElement {
  const text = getAIParamsText();
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.capability}</div>
      <div class="pixel-page-section__subtitle">${text.currentScore}</div>
    </div>
    <div class="pixel-page-section__body">
      <div class="pixel-stat">
        <div class="pixel-stat__label">${text.aiScore}</div>
        <div class="pixel-stat__value">${capability}/100</div>
      </div>
    </div>
  `;
  return section;
}

function renderStats(trainingState: any, learningStats: ReturnType<typeof getLearningStats>): HTMLElement {
  const text = getAIParamsText();
  const bestFitness = !trainingState.bestFitness || trainingState.bestFitness === -Infinity || trainingState.bestFitness === -999999 || trainingState.bestFitness === null
    ? text.na
    : trainingState.bestFitness.toFixed(0);
  const acceptRate = trainingState.acceptCount + trainingState.rejectCount > 0
    ? `${((trainingState.acceptCount / (trainingState.acceptCount + trainingState.rejectCount)) * 100).toFixed(1)}%`
    : text.na;

  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.trainingStats}</div>
      <div class="pixel-page-section__subtitle">${text.currentRun}</div>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'pixel-page-section__body';
  body.appendChild(createKv(text.trainingSteps, String(trainingState.currentStep)));
  body.appendChild(createKv(text.bestFitness, bestFitness));
  body.appendChild(createKv(text.acceptRate, acceptRate));
  body.appendChild(createKv(text.gamesPlayed, String(learningStats.gamesPlayed)));
  body.appendChild(createKv(text.aiWinRate, `${(learningStats.winRate * 100).toFixed(1)}%`));
  section.appendChild(body);
  return section;
}

function renderParams(params: Record<string, unknown>): HTMLElement {
  const text = getAIParamsText();
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.paramList}</div>
      <div class="pixel-page-section__subtitle">${text.readOnly}</div>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'pixel-page-section__body';

  const categories: Record<string, string[]> = {
    [text.catShantenStage]: ['xiangtingBase', 'pimproveNStageA', 'pimproveNStageB', 'stageFactorB'],
    [text.catRiskDefense]: ['basePloseScale', 'stageFactorPloseB', 'stageFactorPloseC', 'genbutsuRiskScale', 'dingQueRiskScale', 'turnRiskFactor'],
    [text.catValueScore]: ['baseWinValue', 'speedBonusK', 'firstWinBonus', 'baseLoss'],
    [text.catMeldPenalties]: ['informationPenaltyPengA', 'informationPenaltyPengB', 'informationPenaltyGangA', 'informationPenaltyGangB'],
    [text.catMultipliers]: ['stageMultiplierA', 'stageMultiplierB', 'stageMultiplierC', 'oppNotHuMultiplier'],
  };

  for (const [category, keys] of Object.entries(categories)) {
    const block = document.createElement('div');
    block.className = 'pixel-note-box';

    const title = document.createElement('div');
    title.className = 'pixel-page-section__title pixel-page-section__title--compact';
    title.textContent = category;
    block.appendChild(title);

    const list = document.createElement('div');
    list.className = 'pixel-kv pixel-kv--gap';

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
