import { llmService } from '../../llm';
import type { GameReview, GameRecord, KeyMoment } from '../../llm/types';
import {
  createPixelEmptyState,
  createPixelLoadingState,
  createPixelModalSurface,
  mountPixelSurface,
} from './pixelFrame';
import { languageStore } from '../../store/languageStore';

function getReviewText() {
  const text = languageStore.t().reviewPanel;
  return {
    ...text,
    impact: {
      critical: text.impactCritical,
      significant: text.impactSignificant,
      minor: text.impactMinor,
    },
  };
}

export async function renderGameReviewPanel(
  gameRecord: GameRecord,
  onClose?: () => void,
): Promise<HTMLElement> {
  const text = getReviewText();
  const surface = createPixelModalSurface({
    title: text.title,
    subtitle: text.subtitle,
    width: 'min(94vw, 840px)',
    onClose,
  });

  surface.body.appendChild(createPixelLoadingState('ANALYZE', text.loading));
  mountPixelSurface(surface);

  try {
    const review = await generateReview(gameRecord);
    surface.body.innerHTML = '';
    renderReviewContent(surface.body, review, gameRecord);
  } catch (error) {
    console.error('[GameReview] Failed to generate:', error);
    surface.body.innerHTML = '';
    surface.body.appendChild(createPixelEmptyState('ERROR', text.errorTitle, text.errorDetail));
  }

  return surface.panel;
}

async function generateReview(gameRecord: GameRecord): Promise<GameReview> {
  const keyDecisions: Array<{ turn: number; action: any; state: any }> = [];
  if (gameRecord.replay?.events) {
    const events = gameRecord.replay.events.filter((event) => event.playerId === 'P0');
    const sampleIndices = [0, Math.floor(events.length / 3), Math.floor(events.length * 2 / 3), events.length - 1];
    for (const idx of sampleIndices) {
      if (events[idx]) {
        keyDecisions.push({
          turn: events[idx].turn,
          action: events[idx].action,
          state: events[idx].state,
        });
      }
    }
  }
  return llmService.generateReview(gameRecord, keyDecisions);
}

function renderReviewContent(container: HTMLElement, review: GameReview, gameRecord: GameRecord): void {
  const text = getReviewText();
  container.appendChild(renderSummary(review, gameRecord));
  container.appendChild(renderStrengthsWeaknesses(review));

  if (review.keyMoments?.length > 0) {
    const moments = document.createElement('section');
    moments.className = 'pixel-page-section';
    moments.innerHTML = `
      <div class="pixel-page-section__header">
        <div class="pixel-page-section__title">${text.keyMoments}</div>
        <div class="pixel-page-section__subtitle">${review.keyMoments.length} ${text.items}</div>
      </div>
    `;
    const body = document.createElement('div');
    body.className = 'pixel-page-section__body';
    for (const moment of review.keyMoments) {
      body.appendChild(renderKeyMoment(moment));
    }
    moments.appendChild(body);
    container.appendChild(moments);
  }

  const improvements = document.createElement('section');
  improvements.className = 'pixel-page-section';
  improvements.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.improvements}</div>
      <div class="pixel-page-section__subtitle">${text.nextGames}</div>
    </div>
  `;
  const improveBody = document.createElement('div');
  improveBody.className = 'pixel-page-section__body';
  improveBody.appendChild(renderListBox(text.actions, review.improvements));
  improveBody.appendChild(renderStats(review.statistics));
  improvements.appendChild(improveBody);
  container.appendChild(improvements);
}

function renderSummary(review: GameReview, gameRecord: GameRecord): HTMLElement {
  const text = getReviewText();
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.summary}</div>
      <div class="pixel-page-section__subtitle">${new Date(gameRecord.timestamp).toLocaleString()}</div>
    </div>
    <div class="pixel-page-section__body">
      <div class="pixel-grid pixel-grid--stats">
        <div class="pixel-stat"><div class="pixel-stat__label">${text.grade}</div><div class="pixel-stat__value">${review.overallAssessment.grade}</div></div>
        <div class="pixel-stat"><div class="pixel-stat__label">${text.score}</div><div class="pixel-stat__value">${review.overallAssessment.score}/100</div></div>
        <div class="pixel-stat"><div class="pixel-stat__label">${text.dealIn}</div><div class="pixel-stat__value">${gameRecord.stats?.dealInCount || 0}</div></div>
        <div class="pixel-stat"><div class="pixel-stat__label">${text.melds}</div><div class="pixel-stat__value">${gameRecord.stats?.meldCount || 0}</div></div>
      </div>
    </div>
  `;
  return section;
}

function renderStrengthsWeaknesses(review: GameReview): HTMLElement {
  const text = getReviewText();
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.assessment}</div>
      <div class="pixel-page-section__subtitle">${text.goodBad}</div>
    </div>
  `;
  const body = document.createElement('div');
  body.className = 'pixel-page-section__body pixel-grid pixel-grid--two';
  body.appendChild(renderListBox(text.strengths, review.overallAssessment.strengths, 'success'));
  body.appendChild(renderListBox(text.weaknesses, review.overallAssessment.weaknesses, 'danger'));
  section.appendChild(body);
  return section;
}

function renderKeyMoment(moment: KeyMoment): HTMLElement {
  const text = getReviewText();
  const card = document.createElement('div');
  card.className = 'pixel-note-box';

  const impactClass = moment.impact === 'critical'
    ? 'pixel-chip pixel-chip--bad'
    : moment.impact === 'significant'
      ? 'pixel-chip pixel-chip--warn'
      : 'pixel-chip pixel-chip--good';

  card.innerHTML = `
    <div class="pixel-list-item__row">
      <div class="pixel-page-section__title pixel-page-section__title--compact">${text.turn} ${moment.turn}</div>
      <span class="${impactClass}">${text.impact[moment.impact]}</span>
    </div>
    <div class="pixel-note pixel-note--gap">${moment.situation}</div>
    <div class="pixel-kv pixel-kv--gap">
      <div class="pixel-kv__row"><span class="pixel-kv__label">${text.yourAction}</span><span class="pixel-kv__value">${String(moment.playerAction?.type ?? '')}</span></div>
      <div class="pixel-kv__row"><span class="pixel-kv__label">${text.optimal}</span><span class="pixel-kv__value">${String(moment.optimalAction?.type ?? '')}</span></div>
    </div>
    <div class="pixel-note pixel-note--gap">${moment.analysis}</div>
    <div class="pixel-note pixel-note--gap-sm">${text.lesson}: ${moment.lesson}</div>
  `;
  return card;
}

function renderStats(statistics: GameReview['statistics']): HTMLElement {
  const text = getReviewText();
  const block = document.createElement('div');
  block.className = 'pixel-note-box';
  block.innerHTML = `
    <div class="pixel-page-section__title pixel-page-section__title--compact">${text.skills}</div>
    <div class="pixel-page-section__body pixel-page-section__body--compact">
      ${renderProgress(text.efficiency, statistics.efficiency)}
      ${renderProgress(text.defense, statistics.defense)}
      ${renderProgress(text.timing, statistics.timing)}
    </div>
  `;
  return block;
}

function renderProgress(label: string, value: number): string {
  const percentage = Math.round(value * 100);
  return `
    <div class="pixel-progress">
      <div class="pixel-progress__label"><span>${label}</span><span>${percentage}%</span></div>
      <div class="pixel-progress__track"><div class="pixel-progress__fill" style="width:${percentage}%;"></div></div>
    </div>
  `;
}

function renderListBox(title: string, items: string[], tone: 'neutral' | 'success' | 'danger' = 'neutral'): HTMLElement {
  const className = tone === 'success'
    ? 'pixel-note-box pixel-note-box--success'
    : tone === 'danger'
      ? 'pixel-note-box pixel-note-box--danger'
      : 'pixel-note-box';

  const block = document.createElement('div');
  block.className = className;

  const titleEl = document.createElement('div');
  titleEl.className = 'pixel-page-section__title pixel-page-section__title--compact';
  titleEl.textContent = title;
  block.appendChild(titleEl);

  const list = document.createElement('div');
  list.className = 'pixel-list pixel-list--gap';
  for (const item of items.length > 0 ? items : ['-']) {
    const line = document.createElement('div');
    line.className = 'pixel-note';
    line.textContent = item;
    list.appendChild(line);
  }
  block.appendChild(list);
  return block;
}

export async function quickReview(gameRecord: GameRecord): Promise<void> {
  await renderGameReviewPanel(gameRecord);
}
