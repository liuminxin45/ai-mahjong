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

let historyData: GameHistory | null = null;

export async function renderGameHistoryPanel(onClose?: () => void): Promise<HTMLElement> {
  const surface = createPixelModalSurface({
    title: 'Game History',
    subtitle: 'STATS / RESULTS / REVIEW',
    width: 'min(94vw, 760px)',
    onClose,
  });

  surface.body.appendChild(createPixelLoadingState('LOAD', '正在读取对局记录...'));
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
    surface.body.appendChild(createPixelEmptyState('EMPTY', '暂无对局记录', '完成一局游戏后，记录将自动保存。'));
  } else {
    const stats = historyData.aggregateStats;
    surface.body.appendChild(renderStats(stats));
    surface.body.appendChild(renderDistribution(stats));
    surface.body.appendChild(renderRecentGames(historyData.games));
  }

  const exportBtn = createPixelButton('Export', 'success');
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
      createPixelToast('EXPORTED');
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const clearBtn = createPixelButton('Clear', 'danger');
  clearBtn.onclick = async () => {
    if (confirm('确定要清除所有对局记录吗？此操作不可恢复。')) {
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
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">SUMMARY</div>
      <div class="pixel-page-section__subtitle">AGGREGATE</div>
    </div>
    <div class="pixel-page-section__body">
      <div class="pixel-grid pixel-grid--stats">
        <div class="pixel-stat"><div class="pixel-stat__label">Games</div><div class="pixel-stat__value">${stats.totalGames}</div></div>
        <div class="pixel-stat"><div class="pixel-stat__label">Win Rate</div><div class="pixel-stat__value">${(stats.winRate * 100).toFixed(1)}%</div></div>
        <div class="pixel-stat"><div class="pixel-stat__label">Best Streak</div><div class="pixel-stat__value">${stats.bestStreak}</div></div>
        <div class="pixel-stat"><div class="pixel-stat__label">Avg Score</div><div class="pixel-stat__value">${stats.avgScore.toFixed(0)}</div></div>
      </div>
    </div>
  `;
  return section;
}

function renderDistribution(stats: GameHistory['aggregateStats']): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">RESULT SPLIT</div>
      <div class="pixel-page-section__subtitle">WIN / LOSE / DRAW</div>
    </div>
  `;

  const total = stats.totalGames || 1;
  const wins = (stats.wins / total) * 100;
  const losses = (stats.losses / total) * 100;
  const draws = (stats.draws / total) * 100;

  const body = document.createElement('div');
  body.className = 'pixel-page-section__body';

  const track = document.createElement('div');
  track.className = 'pixel-progress__track';
  track.style.height = '20px';
  track.innerHTML = `
    <div class="pixel-progress__fill" style="width:${wins}%; background:#8ed4a7;"></div>
    <div class="pixel-progress__fill" style="width:${losses}%; background:#d97a54;"></div>
    <div class="pixel-progress__fill" style="width:${draws}%; background:#d8c57e;"></div>
  `;
  body.appendChild(track);

  const kv = document.createElement('div');
  kv.className = 'pixel-kv';
  kv.appendChild(createKv('Wins', String(stats.wins)));
  kv.appendChild(createKv('Losses', String(stats.losses)));
  kv.appendChild(createKv('Draws', String(stats.draws)));
  body.appendChild(kv);

  section.appendChild(body);
  return section;
}

function renderRecentGames(games: GameRecord[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">RECENT GAMES</div>
      <div class="pixel-page-section__subtitle">LATEST 20</div>
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
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'pixel-list-item';
  item.style.cursor = 'pointer';

  const resultText = game.result === 'win' ? '胜利' : game.result === 'lose' ? '失败' : '流局';
  const chipClass = game.result === 'win' ? 'pixel-chip pixel-chip--good' : game.result === 'lose' ? 'pixel-chip pixel-chip--bad' : 'pixel-chip pixel-chip--warn';
  const date = new Date(game.timestamp);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  item.innerHTML = `
    <div class="pixel-list-item__row">
      <div class="pixel-list-item__title">${resultText}</div>
      <span class="${chipClass}">${game.score >= 0 ? `+${game.score}` : game.score}</span>
    </div>
    <div class="pixel-list-item__meta">${dateStr} / ${Math.floor(game.duration / 60)} 分钟 / 副露 ${game.stats.meldCount}</div>
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
  const btn = createPixelButton('History', 'neutral');
  btn.onclick = () => { void renderGameHistoryPanel(); };
  return btn;
}
