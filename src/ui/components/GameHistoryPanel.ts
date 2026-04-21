import { historyStorage } from '../../llm';
import type { GameHistory, GameRecord } from '../../llm/types';
import { quickReview } from './GameReviewPanel';
import {
  createPixelButton,
  createPixelEmptyState,
  createPixelLoadingState,
  createPixelModalSurface,
  createPixelToast,
  mountPixelSurface,
} from './pixelFrame';
import { showPixelConfirmDialog } from './pixelDialog';
import { languageStore } from '../../store/languageStore';

let historyData: GameHistory | null = null;

function getHistoryText() {
  return languageStore.t().historyPanel;
}

export async function renderGameHistoryPanel(onClose?: () => void): Promise<HTMLElement> {
  const text = getHistoryText();
  const surface = createPixelModalSurface({
    title: text.title,
    subtitle: text.subtitle,
    width: 'min(94vw, 760px)',
    onClose,
  });

  surface.body.appendChild(createPixelLoadingState('LOAD', text.loading));
  mountPixelSurface(surface);

  try {
    await historyStorage.init();
    historyData = await historyStorage.getGameHistory();
  } catch (error) {
    console.error('[GameHistory] Failed to load:', error);
    historyData = null;
  }

  surface.body.innerHTML = '';

  if (!historyData || historyData.games.length === 0) {
    surface.body.appendChild(createPixelEmptyState('EMPTY', text.emptyTitle, text.emptyDetail));
  } else {
    const stats = historyData.aggregateStats;
    surface.body.appendChild(renderStats(stats));
    surface.body.appendChild(renderDistribution(stats));
    surface.body.appendChild(renderRecentGames(historyData.games));
  }

  const exportBtn = createPixelButton(text.export, 'success');
  exportBtn.onclick = async () => {
    try {
      const data = await historyStorage.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mahjong-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      createPixelToast(text.exported);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const clearBtn = createPixelButton(text.clear, 'danger');
  clearBtn.onclick = async () => {
    const confirmed = await showPixelConfirmDialog({
      title: text.clearTitle,
      code: text.historyCode,
      message: text.clearMessage,
      confirmText: text.clear,
    });
    if (confirmed) {
      await historyStorage.clearAll();
      surface.close();
      void renderGameHistoryPanel(onClose);
    }
  };

  surface.footer.appendChild(exportBtn);
  surface.footer.appendChild(clearBtn);

  return surface.panel;
}

function renderStats(stats: GameHistory['aggregateStats']): HTMLElement {
  const text = getHistoryText();
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.summary}</div>
      <div class="pixel-page-section__subtitle">${text.aggregate}</div>
    </div>
    <div class="pixel-page-section__body">
      <div class="pixel-grid pixel-grid--stats">
        <div class="pixel-stat"><div class="pixel-stat__label">${text.games}</div><div class="pixel-stat__value">${stats.totalGames}</div></div>
        <div class="pixel-stat"><div class="pixel-stat__label">${text.winRate}</div><div class="pixel-stat__value">${(stats.winRate * 100).toFixed(1)}%</div></div>
        <div class="pixel-stat"><div class="pixel-stat__label">${text.bestStreak}</div><div class="pixel-stat__value">${stats.bestStreak}</div></div>
        <div class="pixel-stat"><div class="pixel-stat__label">${text.avgScore}</div><div class="pixel-stat__value">${stats.avgScore.toFixed(0)}</div></div>
      </div>
    </div>
  `;
  return section;
}

function renderDistribution(stats: GameHistory['aggregateStats']): HTMLElement {
  const text = getHistoryText();
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.split}</div>
      <div class="pixel-page-section__subtitle">${text.splitSub}</div>
    </div>
  `;

  const total = stats.totalGames || 1;
  const wins = (stats.wins / total) * 100;
  const losses = (stats.losses / total) * 100;
  const draws = (stats.draws / total) * 100;

  const body = document.createElement('div');
  body.className = 'pixel-page-section__body';

  const track = document.createElement('div');
  track.className = 'pixel-progress__track pixel-progress__track--history';
  track.innerHTML = `
    <div class="pixel-progress__fill" style="width:${wins}%; background:#8ed4a7;"></div>
    <div class="pixel-progress__fill" style="width:${losses}%; background:#d97a54;"></div>
    <div class="pixel-progress__fill" style="width:${draws}%; background:#d8c57e;"></div>
  `;
  body.appendChild(track);

  const kv = document.createElement('div');
  kv.className = 'pixel-kv';
  kv.appendChild(createKv(text.wins, String(stats.wins)));
  kv.appendChild(createKv(text.losses, String(stats.losses)));
  kv.appendChild(createKv(text.draws, String(stats.draws)));
  body.appendChild(kv);

  section.appendChild(body);
  return section;
}

function renderRecentGames(games: GameRecord[]): HTMLElement {
  const text = getHistoryText();
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.recent}</div>
      <div class="pixel-page-section__subtitle">${text.latest}</div>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'pixel-page-section__body';
  const list = document.createElement('div');
  list.className = 'pixel-list';

  const recentGames = [...games]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  for (const game of recentGames) {
    list.appendChild(renderGameItem(game));
  }

  body.appendChild(list);
  section.appendChild(body);
  return section;
}

function renderGameItem(game: GameRecord): HTMLElement {
  const text = getHistoryText();
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'pixel-list-item pixel-list-item--clickable';

  const resultText = game.result === 'win' ? text.win : game.result === 'lose' ? text.lose : text.draw;
  const chipClass = game.result === 'win' ? 'pixel-chip pixel-chip--good' : game.result === 'lose' ? 'pixel-chip pixel-chip--bad' : 'pixel-chip pixel-chip--warn';
  const date = new Date(game.timestamp);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  item.innerHTML = `
    <div class="pixel-list-item__row">
      <div class="pixel-list-item__title">${resultText}</div>
      <span class="${chipClass}">${game.score >= 0 ? `+${game.score}` : game.score}</span>
    </div>
    <div class="pixel-list-item__meta">${dateStr} / ${Math.floor(game.duration / 60)} ${text.minutes} / ${text.melds} ${game.stats.meldCount}</div>
  `;

  item.onclick = () => { void quickReview(game); };
  return item;
}

function createKv(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pixel-kv__row';
  row.innerHTML = `<span class="pixel-kv__label">${label}</span><span class="pixel-kv__value">${value}</span>`;
  return row;
}

export function renderHistoryButton(): HTMLElement {
  const text = getHistoryText();
  const btn = createPixelButton(text.button, 'neutral');
  btn.onclick = () => { void renderGameHistoryPanel(); };
  return btn;
}
