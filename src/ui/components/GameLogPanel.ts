/**
 * 游戏日志面板组件
 * 显示游戏日志并提供复制功能
 */

import { gameLogStore } from '../../store/gameLogStore';

export function renderGameLogPanel(container: HTMLElement): void {
  container.innerHTML = '';
  container.style.cssText = `
    display:flex; flex-direction:column; height:100%;
    border:1px solid var(--border-default); border-radius:var(--r-md);
    background:var(--bg-surface); overflow:hidden;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display:flex; justify-content:space-between; align-items:center;
    padding:var(--sp-2); background:var(--bg-hover);
    border-bottom:1px solid var(--border-default);
  `;

  const title = document.createElement('div');
  title.style.cssText = 'font-weight:var(--fw-semibold); font-size:var(--fs-sm);';
  title.textContent = '📋 Game Log';

  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = 'display:flex; gap:var(--sp-1);';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-primary btn-sm';
  copyBtn.style.cssText += 'font-size:11px; padding:3px 8px;';
  copyBtn.textContent = '📋 Copy';
  copyBtn.onclick = () => {
    const text = gameLogStore.getAllLogsAsText();
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✅';
      setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
    }).catch(() => alert('Failed to copy logs'));
  };

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn btn-danger btn-sm';
  clearBtn.style.cssText += 'font-size:11px; padding:3px 8px;';
  clearBtn.textContent = '🗑️';
  clearBtn.onclick = () => {
    if (confirm('Clear all logs?')) gameLogStore.clear();
  };

  buttonGroup.appendChild(copyBtn);
  buttonGroup.appendChild(clearBtn);
  header.appendChild(title);
  header.appendChild(buttonGroup);

  // Log content
  const logContent = document.createElement('div');
  logContent.style.cssText = `
    flex:1; overflow-y:auto; padding:var(--sp-2);
    font-family:monospace; font-size:11px;
    line-height:1.4; white-space:pre-wrap; word-break:break-word;
  `;

  const renderLogs = () => {
    const logs = gameLogStore.getLogs();
    logContent.innerHTML = '';

    if (logs.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = 'No logs yet. Start a game to see logs.';
      emptyMsg.style.cssText = 'color:var(--text-muted); text-align:center; margin-top:20px;';
      logContent.appendChild(emptyMsg);
      return;
    }

    for (const log of logs) {
      const logLine = document.createElement('div');
      logLine.style.marginBottom = '2px';

      if (log.type === 'phase') {
        logLine.style.color = 'var(--c-primary-light)';
        logLine.style.fontWeight = 'var(--fw-semibold)';
      } else if (log.type === 'action') {
        logLine.style.color = 'var(--text-primary)';
      } else if (log.type === 'error') {
        logLine.style.color = 'var(--c-danger)';
      } else {
        logLine.style.color = 'var(--text-muted)';
      }

      logLine.textContent = log.message;
      logContent.appendChild(logLine);
    }

    logContent.scrollTop = logContent.scrollHeight;
  };

  renderLogs();
  const unsubscribe = gameLogStore.subscribe(() => renderLogs());
  (container as any).__unsubscribe = unsubscribe;

  container.appendChild(header);
  container.appendChild(logContent);
}
