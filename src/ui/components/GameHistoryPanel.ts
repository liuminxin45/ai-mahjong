/**
 * 游戏历史记录面板
 * 显示玩家的对局历史和统计数据
 */

import { historyStorage } from '../../llm';
import type { GameHistory, GameRecord } from '../../llm/types';

let historyData: GameHistory | null = null;

/**
 * 渲染游戏历史面板
 */
export async function renderGameHistoryPanel(onClose?: () => void): Promise<HTMLElement> {
  const panel = document.createElement('div');
  panel.className = 'game-history-panel';
  panel.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    max-width: 95vw;
    max-height: 85vh;
    background: var(--bg-surface);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
    z-index: 2000;
    display: flex;
    flex-direction: column;
  `;

  // 背景遮罩
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.onclick = () => {
    overlay.remove();
    panel.remove();
    onClose?.();
  };

  // 头部
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--sp-5) var(--sp-6);
    background: linear-gradient(135deg, var(--c-accent) 0%, var(--c-primary) 100%);
    color: white;
  `;

  const title = document.createElement('div');
  title.innerHTML = '<div style="font-size: 18px; font-weight: 600;">📊 对局历史</div>';

  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
  `;
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => {
    overlay.remove();
    panel.remove();
    onClose?.();
  };

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // 内容区域
  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-6);
  `;

  // 加载数据
  try {
    await historyStorage.init();
    historyData = await historyStorage.getGameHistory();
  } catch (e) {
    console.error('[GameHistory] Failed to load:', e);
    historyData = null;
  }

  if (!historyData || historyData.games.length === 0) {
    content.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
        <div style="font-size: 16px; margin-bottom: 8px;">暂无对局记录</div>
        <div style="font-size: 13px;">完成一局游戏后，记录将自动保存</div>
      </div>
    `;
  } else {
    // 统计概览
    const stats = historyData.aggregateStats;
    const statsSection = document.createElement('div');
    statsSection.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-3);
      margin-bottom: var(--sp-6);
    `;

    const statItems = [
      { label: '总对局', value: stats.totalGames, icon: '🎮' },
      { label: '胜率', value: `${(stats.winRate * 100).toFixed(1)}%`, icon: '🏆' },
      { label: '最高连胜', value: stats.bestStreak, icon: '🔥' },
      { label: '平均得分', value: stats.avgScore.toFixed(0), icon: '💰' },
    ];

    for (const item of statItems) {
      const statCard = document.createElement('div');
      statCard.style.cssText = `
        background: var(--bg-hover);
        border-radius: var(--r-lg);
        padding: var(--sp-4);
        text-align: center;
      `;
      statCard.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 8px;">${item.icon}</div>
        <div style="font-size: 20px; font-weight: 600; color: var(--text-primary);">${item.value}</div>
        <div style="font-size: 12px; color: var(--text-muted);">${item.label}</div>
      `;
      statsSection.appendChild(statCard);
    }

    content.appendChild(statsSection);

    // 胜负分布图
    const chartSection = document.createElement('div');
    chartSection.style.cssText = `
      background: var(--bg-hover);
      border-radius: var(--r-lg);
      padding: var(--sp-4);
      margin-bottom: var(--sp-6);
    `;

    const total = stats.totalGames || 1;
    const winPct = (stats.wins / total * 100).toFixed(1);
    const lossPct = (stats.losses / total * 100).toFixed(1);
    const drawPct = (stats.draws / total * 100).toFixed(1);

    chartSection.innerHTML = `
      <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">胜负分布</div>
      <div style="display: flex; height: 24px; border-radius: 12px; overflow: hidden;">
        <div style="width: ${winPct}%; background: var(--c-success);" title="胜: ${stats.wins}"></div>
        <div style="width: ${lossPct}%; background: var(--c-danger);" title="负: ${stats.losses}"></div>
        <div style="width: ${drawPct}%; background: var(--text-muted);" title="平: ${stats.draws}"></div>
      </div>
      <div style="display: flex; justify-content: space-around; margin-top: 8px; font-size: 12px;">
        <span style="color: var(--c-success);">● 胜 ${stats.wins}</span>
        <span style="color: var(--c-danger);">● 负 ${stats.losses}</span>
        <span style="color: var(--text-muted);">● 平 ${stats.draws}</span>
      </div>
    `;
    content.appendChild(chartSection);

    // 最近对局列表
    const listTitle = document.createElement('div');
    listTitle.style.cssText = `
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    listTitle.innerHTML = `
      <span>最近对局</span>
      <span style="font-size: 12px; color: #999;">共 ${historyData.games.length} 局</span>
    `;
    content.appendChild(listTitle);

    const gameList = document.createElement('div');
    gameList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    const recentGames = [...historyData.games]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    for (const game of recentGames) {
      gameList.appendChild(renderGameItem(game));
    }

    content.appendChild(gameList);
  }

  panel.appendChild(content);

  // 底部操作
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    gap: 12px;
    padding: 16px 24px;
    background: var(--bg-hover);
    border-top: 1px solid var(--border-subtle);
  `;

  const exportBtn = document.createElement('button');
  exportBtn.textContent = '📤 导出数据';
  exportBtn.className = 'btn btn-success';
  exportBtn.style.flex = '1';
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
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const clearBtn = document.createElement('button');
  clearBtn.textContent = '🗑️ 清除全部';
  clearBtn.className = 'btn btn-ghost';
  clearBtn.onclick = async () => {
    if (confirm('确定要清除所有对局记录吗？此操作不可恢复。')) {
      await historyStorage.clearAll();
      overlay.remove();
      panel.remove();
      document.body.appendChild(await renderGameHistoryPanel(onClose));
    }
  };

  footer.appendChild(exportBtn);
  footer.appendChild(clearBtn);
  panel.appendChild(footer);

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  return panel;
}

/**
 * 渲染单个游戏条目
 */
function renderGameItem(game: GameRecord): HTMLElement {
  const item = document.createElement('div');
  item.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: var(--sp-3) var(--sp-4);
    background: var(--bg-surface);
    border-radius: var(--r-md);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: box-shadow 0.2s;
  `;
  item.onmouseover = () => item.style.boxShadow = 'var(--shadow-md)';
  item.onmouseout = () => item.style.boxShadow = 'none';

  // 结果图标
  const resultIcons: Record<string, string> = {
    win: '🏆',
    lose: '😢',
    draw: '🤝',
  };
  const resultColors: Record<string, string> = {
    win: 'var(--c-success)',
    lose: 'var(--c-danger)',
    draw: 'var(--text-muted)',
  };

  const icon = document.createElement('div');
  icon.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: ${resultColors[game.result]}20;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  `;
  icon.textContent = resultIcons[game.result] || '❓';

  // 信息区
  const info = document.createElement('div');
  info.style.flex = '1';

  const date = new Date(game.timestamp);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  info.innerHTML = `
    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
      ${game.result === 'win' ? '胜利' : game.result === 'lose' ? '失败' : '流局'}
    </div>
    <div style="font-size: 12px; color: var(--text-muted);">${dateStr} · 时长 ${Math.floor(game.duration / 60)}分钟</div>
  `;

  // 得分
  const score = document.createElement('div');
  score.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    color: ${game.score >= 0 ? 'var(--c-success)' : 'var(--c-danger)'};
  `;
  score.textContent = game.score >= 0 ? `+${game.score}` : String(game.score);

  item.appendChild(icon);
  item.appendChild(info);
  item.appendChild(score);

  return item;
}

/**
 * 渲染历史记录按钮
 */
export function renderHistoryButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.style.cssText = `
    padding: 8px 16px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  btn.innerHTML = '📊 <span>对局历史</span>';
  btn.onclick = () => renderGameHistoryPanel();

  return btn;
}
