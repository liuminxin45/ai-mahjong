/**
 * 游戏日志面板组件
 * 显示游戏日志并提供复制功能
 */

import { gameLogStore } from '../../store/gameLogStore';
import { languageStore } from '../../store/languageStore';
import { showPixelAlertDialog, showPixelConfirmDialog } from './pixelDialog';
import { createPixelButton } from './pixelFrame';

export function renderGameLogPanel(container: HTMLElement): void {
  const t = languageStore.t().gameLog;
  container.innerHTML = '';
  container.className = 'pixel-log-panel';

  const header = document.createElement('div');
  header.className = 'pixel-log-panel__header';

  const title = document.createElement('div');
  title.className = 'pixel-log-panel__title';
  title.textContent = t.title;

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'pixel-btn-row';

  const copyBtn = createPixelButton(t.copy, 'success', { size: 'sm' });
  copyBtn.onclick = () => {
    const text = gameLogStore.getAllLogsAsText();
    navigator.clipboard.writeText(text).then(() => {
      const label = copyBtn.querySelector('.pixel-btn__text');
      if (label) label.textContent = t.copyDone;
      setTimeout(() => {
        const nextLabel = copyBtn.querySelector('.pixel-btn__text');
        if (nextLabel) nextLabel.textContent = t.copy;
      }, 2000);
    }).catch(() => {
      showPixelAlertDialog({
        title: t.clearTitle,
        code: 'COPY LOGS',
        message: t.copyFailed,
      });
    });
  };

  const clearBtn = createPixelButton(t.clear, 'danger', { size: 'sm' });
  clearBtn.onclick = async () => {
    const confirmed = await showPixelConfirmDialog({
      title: t.clearTitle,
      code: 'CLEAR LOGS',
      message: t.clearMessage,
      confirmText: t.clear,
    });
    if (confirmed) gameLogStore.clear();
  };

  buttonGroup.appendChild(copyBtn);
  buttonGroup.appendChild(clearBtn);
  header.appendChild(title);
  header.appendChild(buttonGroup);

  const logContent = document.createElement('div');
  logContent.className = 'pixel-log-panel__content';

  const renderLogs = () => {
    const logs = gameLogStore.getLogs();
    logContent.innerHTML = '';

    if (logs.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = t.empty;
      emptyMsg.className = 'pixel-log-panel__empty';
      logContent.appendChild(emptyMsg);
      return;
    }

    for (const log of logs) {
      const logLine = document.createElement('div');
      logLine.className = 'pixel-log-panel__line';

      if (log.type === 'phase') {
        logLine.classList.add('pixel-log-panel__line--phase');
      } else if (log.type === 'action') {
        logLine.classList.add('pixel-log-panel__line--action');
      } else if (log.type === 'error') {
        logLine.classList.add('pixel-log-panel__line--error');
      } else {
        logLine.classList.add('pixel-log-panel__line--misc');
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
