/**
 * 中文模式下的游戏风格样式
 * 提供精美的麻将游戏UI风格
 */

import { languageStore } from '../../store/languageStore';

/**
 * 获取当前语言
 */
export function isChineseMode(): boolean {
  return languageStore.getLanguage() === 'zh';
}

/**
 * 应用中文游戏风格到按钮
 */
export function applyChineseButtonStyle(button: HTMLButtonElement, variant: 'primary' | 'success' | 'danger' | 'warning' | 'info' = 'primary'): void {
  if (!isChineseMode()) return;
  
  const colors = {
    primary: {
      bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      shadow: 'rgba(102, 126, 234, 0.4)',
      hover: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
    },
    success: {
      bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      shadow: 'rgba(17, 153, 142, 0.4)',
      hover: 'linear-gradient(135deg, #0e8577 0%, #2dd46a 100%)',
    },
    danger: {
      bg: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
      shadow: 'rgba(235, 51, 73, 0.4)',
      hover: 'linear-gradient(135deg, #d42a3f 0%, #dc4a39 100%)',
    },
    warning: {
      bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      shadow: 'rgba(240, 147, 251, 0.4)',
      hover: 'linear-gradient(135deg, #e07fe8 0%, #e24459 100%)',
    },
    info: {
      bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      shadow: 'rgba(79, 172, 254, 0.4)',
      hover: 'linear-gradient(135deg, #3d96e5 0%, #00d9e5 100%)',
    },
  };
  
  const color = colors[variant];
  
  button.style.background = color.bg;
  button.style.border = 'none';
  button.style.borderRadius = '8px';
  button.style.padding = '10px 20px';
  button.style.color = 'white';
  button.style.fontWeight = '600';
  button.style.fontSize = '14px';
  button.style.cursor = 'pointer';
  button.style.boxShadow = `0 4px 15px ${color.shadow}`;
  button.style.transition = 'all 0.3s ease';
  button.style.textShadow = '0 1px 2px rgba(0,0,0,0.2)';
  
  button.onmouseenter = () => {
    button.style.background = color.hover;
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = `0 6px 20px ${color.shadow}`;
  };
  
  button.onmouseleave = () => {
    button.style.background = color.bg;
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = `0 4px 15px ${color.shadow}`;
  };
}

/**
 * 应用中文游戏风格到卡片容器
 */
export function applyChineseCardStyle(container: HTMLElement): void {
  if (!isChineseMode()) return;
  
  container.style.background = 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)';
  container.style.borderRadius = '12px';
  container.style.padding = '16px';
  container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
  container.style.border = '1px solid rgba(255,255,255,0.8)';
}

/**
 * 应用中文游戏风格到玩家区域
 */
export function applyChinesePlayerAreaStyle(container: HTMLElement, isWinner: boolean = false): void {
  if (!isChineseMode()) return;
  
  if (isWinner) {
    container.style.background = 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)';
    container.style.boxShadow = '0 4px 20px rgba(253, 203, 110, 0.5)';
    container.style.border = '2px solid #fdcb6e';
  } else {
    container.style.background = 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)';
    container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    container.style.border = '1px solid #a5d6a7';
  }
  
  container.style.borderRadius = '12px';
  container.style.padding = '12px';
  container.style.transition = 'all 0.3s ease';
}

/**
 * 应用中文游戏风格到标题
 */
export function applyChineseTitleStyle(title: HTMLElement): void {
  if (!isChineseMode()) return;
  
  title.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  title.style.webkitBackgroundClip = 'text';
  title.style.webkitTextFillColor = 'transparent';
  title.style.backgroundClip = 'text';
  title.style.fontWeight = '700';
  title.style.fontSize = '20px';
  title.style.textShadow = '0 2px 4px rgba(0,0,0,0.1)';
}

/**
 * 应用中文游戏风格到面板
 */
export function applyChinesePanelStyle(panel: HTMLElement): void {
  if (!isChineseMode()) return;
  
  panel.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)';
  panel.style.borderRadius = '16px';
  panel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)';
  panel.style.border = '1px solid rgba(255,255,255,0.8)';
}
