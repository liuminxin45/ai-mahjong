/**
 * 用户画像面板
 * 显示玩家技能评估和风格分析
 */

import { llmService, historyStorage } from '../../llm';
import type { UserProfile } from '../../llm/types';

let cachedProfile: UserProfile | null = null;

/**
 * 渲染用户画像面板
 */
export async function renderUserProfilePanel(onClose?: () => void): Promise<HTMLElement> {
  const panel = document.createElement('div');
  panel.className = 'user-profile-panel';
  panel.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 550px;
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
    background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-light) 100%);
    color: white;
  `;

  const title = document.createElement('div');
  title.innerHTML = `
    <div style="font-size: 18px; font-weight: 600;">👤 我的画像</div>
    <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">基于对局数据的AI分析</div>
  `;

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

  // Loading
  content.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <div style="font-size: 32px; margin-bottom: 16px;">🔄</div>
      <div style="color: var(--text-muted);">正在分析你的游戏数据...</div>
    </div>
  `;

  panel.appendChild(content);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  // 异步加载画像数据
  try {
    await historyStorage.init();
    const stats = await historyStorage.calculateStatsForAnalysis();

    if (stats.totalGames < 3) {
      renderInsufficientData(content, stats.totalGames);
    } else {
      // 尝试从缓存或LLM获取画像
      if (!cachedProfile) {
        const profileData = await llmService.analyzeProfile(stats);
        cachedProfile = {
          userId: 'default_user',
          nickname: '玩家',
          createdAt: new Date(),
          lastActive: new Date(),
          ...profileData,
        } as UserProfile;

        // 保存到存储
        await historyStorage.saveProfile(cachedProfile);
      }

      renderProfileContent(content, cachedProfile, stats);
    }
  } catch (e) {
    console.error('[UserProfile] Failed to load:', e);
    content.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--c-danger);">
        <div style="font-size: 32px; margin-bottom: 16px;">❌</div>
        <div>加载失败，请稍后重试</div>
      </div>
    `;
  }

  return panel;
}

/**
 * 渲染数据不足提示
 */
function renderInsufficientData(container: HTMLElement, gameCount: number): void {
  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">数据不足</div>
      <div style="color: #666; margin-bottom: 24px; line-height: 1.6;">
        你目前只完成了 <strong>${gameCount}</strong> 局游戏。<br>
        至少需要 <strong>3局</strong> 对局数据才能生成画像分析。
      </div>
      <div style="
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        border-radius: 12px;
        padding: 20px;
        text-align: left;
      ">
        <div style="font-weight: 600; margin-bottom: 12px;">🎯 如何获得画像分析：</div>
        <ol style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
          <li>完成更多对局（至少3局）</li>
          <li>对局数据会自动保存</li>
          <li>再次打开此面板查看分析</li>
        </ol>
      </div>
    </div>
  `;
}

/**
 * 渲染画像内容
 */
function renderProfileContent(
  container: HTMLElement,
  profile: UserProfile,
  stats: { totalGames: number; winRate: number; avgDealIn: number }
): void {
  container.innerHTML = '';

  // 等级卡片
  const levelCard = document.createElement('div');
  levelCard.style.cssText = `
    background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-light) 100%);
    border-radius: var(--r-lg);
    padding: var(--sp-6);
    color: white;
    margin-bottom: var(--sp-5);
    display: flex;
    align-items: center;
    gap: 20px;
  `;

  const rankIcons: Record<string, string> = {
    beginner: '🌱',
    intermediate: '🌿',
    advanced: '🌳',
    expert: '🏆',
  };

  const rankNames: Record<string, string> = {
    beginner: '初学者',
    intermediate: '进阶玩家',
    advanced: '高级玩家',
    expert: '专家',
  };

  const rank = profile.skillLevel?.rank || 'beginner';
  const overall = profile.skillLevel?.overall || 50;

  levelCard.innerHTML = `
    <div style="
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    ">${rankIcons[rank] || '🎮'}</div>
    <div style="flex: 1;">
      <div style="font-size: 14px; opacity: 0.9;">技术等级</div>
      <div style="font-size: 24px; font-weight: 600; margin: 4px 0;">${rankNames[rank] || '未知'}</div>
      <div style="font-size: 14px;">综合评分: <strong>${overall}</strong>/100</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 12px; opacity: 0.8;">对局统计</div>
      <div style="font-size: 14px; margin-top: 4px;">
        总对局: ${stats.totalGames}<br>
        胜率: ${(stats.winRate * 100).toFixed(1)}%
      </div>
    </div>
  `;
  container.appendChild(levelCard);

  // 技能雷达
  if (profile.skillLevel?.skills) {
    const skillsSection = document.createElement('div');
    skillsSection.style.cssText = `
      background: #f8f9fa;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    `;

    const skills = profile.skillLevel.skills;
    const skillLabels: Record<string, string> = {
      handReading: '读牌能力',
      efficiency: '牌效率',
      defense: '防守意识',
      riskManagement: '风险控制',
      timing: '时机把握',
      adaptation: '应变能力',
    };

    skillsSection.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 16px;">📈 技能评估</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        ${Object.entries(skills).map(([key, value]) => {
      const pct = value as number;
      const color = pct >= 70 ? '#4caf50' : pct >= 40 ? '#ff9800' : '#f44336';
      return `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                <span>${skillLabels[key] || key}</span>
                <span style="font-weight: 600;">${pct}</span>
              </div>
              <div style="height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: ${color};"></div>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
    container.appendChild(skillsSection);
  }

  // 游戏风格
  if (profile.playStyle) {
    const styleSection = document.createElement('div');
    styleSection.style.cssText = `
      background: white;
      border: 1px solid #eee;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    `;

    const styleIcons: Record<string, string> = {
      aggressive: '⚔️',
      defensive: '🛡️',
      balanced: '⚖️',
      opportunistic: '🎯',
    };

    const styleNames: Record<string, string> = {
      aggressive: '进攻型',
      defensive: '防守型',
      balanced: '平衡型',
      opportunistic: '机会型',
    };

    const style = profile.playStyle.primaryStyle || 'balanced';

    styleSection.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span style="font-size: 32px;">${styleIcons[style] || '🎮'}</span>
        <div>
          <div style="font-weight: 600; font-size: 16px;">${styleNames[style] || '未知'} 玩家</div>
          <div style="font-size: 13px; color: #666;">${profile.playStyle.description || ''}</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background: #e8f5e9; border-radius: 8px; padding: 12px;">
          <div style="font-weight: 600; color: #2e7d32; margin-bottom: 8px;">✅ 优点</div>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
            ${(profile.playStyle.strengths || ['继续保持']).map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
        <div style="background: #fff3e0; border-radius: 8px; padding: 12px;">
          <div style="font-weight: 600; color: #e65100; margin-bottom: 8px;">⚠️ 改进点</div>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
            ${(profile.playStyle.weaknesses || ['无明显弱点']).map(w => `<li>${w}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
    container.appendChild(styleSection);
  }

  // 学习建议
  if (profile.learningProgress?.recommendations) {
    const recommendSection = document.createElement('div');
    recommendSection.style.cssText = `
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border-radius: 12px;
      padding: 20px;
    `;
    recommendSection.innerHTML = `
      <div style="font-weight: 600; color: #1565c0; margin-bottom: 12px;">💡 提升建议</div>
      <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 1.8;">
        ${profile.learningProgress.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ol>
    `;
    container.appendChild(recommendSection);
  }

  // 刷新按钮
  const refreshBtn = document.createElement('button');
  refreshBtn.style.cssText = `
    width: 100%;
    padding: 12px;
    margin-top: 16px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    color: #666;
    font-size: 14px;
    cursor: pointer;
  `;
  refreshBtn.textContent = '🔄 重新分析';
  refreshBtn.onclick = async () => {
    cachedProfile = null;
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 32px; margin-bottom: 16px;">🔄</div>
        <div style="color: #666;">正在重新分析...</div>
      </div>
    `;

    try {
      const newStats = await historyStorage.calculateStatsForAnalysis();
      const profileData = await llmService.analyzeProfile(newStats);
      cachedProfile = {
        userId: 'default_user',
        nickname: '玩家',
        createdAt: new Date(),
        lastActive: new Date(),
        ...profileData,
      } as UserProfile;
      await historyStorage.saveProfile(cachedProfile);
      renderProfileContent(container, cachedProfile, newStats);
    } catch (e) {
      console.error('[UserProfile] Refresh failed:', e);
    }
  };
  container.appendChild(refreshBtn);
}

/**
 * 渲染用户画像按钮
 */
export function renderProfileButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.style.cssText = `
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  btn.innerHTML = '👤 <span>我的画像</span>';
  btn.onclick = () => renderUserProfilePanel();

  return btn;
}

/**
 * 清除缓存的画像
 */
export function clearProfileCache(): void {
  cachedProfile = null;
}
