/**
 * 游戏日志面板组件
 * 显示游戏日志并提供复制功能
 */

import { gameLogStore } from '../../store/gameLogStore';

export function renderGameLogPanel(container: HTMLElement): void {
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';
  container.style.border = '1px solid #ccc';
  container.style.borderRadius = '4px';
  container.style.backgroundColor = '#fff';
  container.style.overflow = 'hidden';

  // 标题栏
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.padding = '6px 8px';
  header.style.backgroundColor = '#f5f5f5';
  header.style.borderBottom = '1px solid #ccc';

  const title = document.createElement('div');
  title.textContent = '📋 Game Log';
  title.style.fontWeight = '600';
  title.style.fontSize = '13px';

  const buttonGroup = document.createElement('div');
  buttonGroup.style.display = 'flex';
  buttonGroup.style.gap = '8px';

  // 复制按钮
  const copyBtn = document.createElement('button');
  copyBtn.textContent = '📋 Copy';
  copyBtn.style.padding = '3px 8px';
  copyBtn.style.fontSize = '11px';
  copyBtn.style.backgroundColor = '#4a90e2';
  copyBtn.style.color = '#fff';
  copyBtn.style.border = 'none';
  copyBtn.style.borderRadius = '3px';
  copyBtn.style.cursor = 'pointer';
  copyBtn.onclick = () => {
    const text = gameLogStore.getAllLogsAsText();
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✅';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy';
      }, 2000);
    }).catch(() => {
      alert('Failed to copy logs to clipboard');
    });
  };

  // 清空按钮
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '🗑️';
  clearBtn.style.padding = '3px 8px';
  clearBtn.style.fontSize = '11px';
  clearBtn.style.backgroundColor = '#dc3545';
  clearBtn.style.color = '#fff';
  clearBtn.style.border = 'none';
  clearBtn.style.borderRadius = '3px';
  clearBtn.style.cursor = 'pointer';
  clearBtn.onclick = () => {
    if (confirm('Clear all logs?')) {
      gameLogStore.clear();
    }
  };

  buttonGroup.appendChild(copyBtn);
  buttonGroup.appendChild(clearBtn);
  header.appendChild(title);
  header.appendChild(buttonGroup);

  // 日志内容区域
  const logContent = document.createElement('div');
  logContent.style.flex = '1';
  logContent.style.overflowY = 'auto';
  logContent.style.padding = '6px';
  logContent.style.fontFamily = 'monospace';
  logContent.style.fontSize = '11px';
  logContent.style.lineHeight = '1.4';
  logContent.style.whiteSpace = 'pre-wrap';
  logContent.style.wordBreak = 'break-word';

  const renderLogs = () => {
    const logs = gameLogStore.getLogs();
    logContent.innerHTML = '';

    if (logs.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = 'No logs yet. Start a game to see logs.';
      emptyMsg.style.color = '#999';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.marginTop = '20px';
      logContent.appendChild(emptyMsg);
      return;
    }

    for (const log of logs) {
      const logLine = document.createElement('div');
      logLine.style.marginBottom = '2px';
      
      // 根据类型设置颜色
      if (log.type === 'phase') {
        logLine.style.color = '#4a90e2';
        logLine.style.fontWeight = '600';
      } else if (log.type === 'action') {
        logLine.style.color = '#333';
      } else if (log.type === 'error') {
        logLine.style.color = '#dc3545';
      } else {
        logLine.style.color = '#666';
      }

      logLine.textContent = log.message;
      logContent.appendChild(logLine);
    }

    // 自动滚动到底部
    logContent.scrollTop = logContent.scrollHeight;
  };

  // 初始渲染
  renderLogs();

  // 订阅日志更新
  const unsubscribe = gameLogStore.subscribe(() => {
    renderLogs();
  });

  // 清理函数（如果需要）
  (container as any).__unsubscribe = unsubscribe;

  container.appendChild(header);
  container.appendChild(logContent);
}
