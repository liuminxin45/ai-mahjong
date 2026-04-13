import { llmService, historyStorage } from '../../llm';
import type { UserProfile } from '../../llm/types';
import {
  createPixelButton,
  createPixelEmptyState,
  createPixelLoadingState,
  createPixelModalSurface,
  createPixelToast,
  mountPixelSurface,
} from './pixelFrame';

let cachedProfile: UserProfile | null = null;

export async function renderUserProfilePanel(onClose?: () => void): Promise<HTMLElement> {
  const surface = createPixelModalSurface({
    title: 'Player Profile',
    subtitle: 'SKILL / STYLE / LEARNING',
    width: 'min(94vw, 680px)',
    onClose,
  });

  surface.body.appendChild(createPixelLoadingState('LOAD', '正在分析你的游戏数据...'));
  mountPixelSurface(surface);

  try {
    await historyStorage.init();
    const stats = await historyStorage.calculateStatsForAnalysis();

    surface.body.innerHTML = '';
    if (stats.totalGames < 3) {
      surface.body.appendChild(
        createPixelEmptyState('LOW DATA', '数据不足', `当前仅有 ${stats.totalGames} 局记录，至少需要 3 局才能生成画像。`),
      );
      return surface.panel;
    }

    if (!cachedProfile) {
      const profileData = await llmService.analyzeProfile(stats);
      cachedProfile = {
        userId: 'default_user',
        nickname: '玩家',
        createdAt: new Date(),
        lastActive: new Date(),
        ...profileData,
      } as UserProfile;
      await historyStorage.saveProfile(cachedProfile);
    }

    renderProfileContent(surface.body, cachedProfile, stats);

    const refresh = createPixelButton('Refresh', 'success');
    refresh.onclick = async () => {
      cachedProfile = null;
      surface.body.innerHTML = '';
      surface.body.appendChild(createPixelLoadingState('LOAD', '重新分析中...'));
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
        surface.body.innerHTML = '';
        renderProfileContent(surface.body, cachedProfile, newStats);
        createPixelToast('REFRESH');
      } catch (error) {
        console.error('[UserProfile] Refresh failed:', error);
      }
    };
    surface.footer.appendChild(refresh);
  } catch (error) {
    console.error('[UserProfile] Failed to load:', error);
    surface.body.innerHTML = '';
    surface.body.appendChild(createPixelEmptyState('ERROR', '加载失败', '请稍后再试。'));
  }

  return surface.panel;
}

function renderProfileContent(
  container: HTMLElement,
  profile: UserProfile,
  stats: { totalGames: number; winRate: number; avgDealIn: number },
): void {
  const rankNames: Record<string, string> = {
    beginner: '初学者',
    intermediate: '进阶玩家',
    advanced: '高级玩家',
    expert: '专家',
  };

  const summary = document.createElement('section');
  summary.className = 'pixel-page-section';
  summary.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">PROFILE</div>
      <div class="pixel-page-section__subtitle">${rankNames[profile.skillLevel.rank] || '未知'}</div>
    </div>
  `;
  const summaryBody = document.createElement('div');
  summaryBody.className = 'pixel-page-section__body';
  summaryBody.innerHTML = `
    <div class="pixel-grid pixel-grid--stats">
      <div class="pixel-stat"><div class="pixel-stat__label">Overall</div><div class="pixel-stat__value">${profile.skillLevel.overall}</div></div>
      <div class="pixel-stat"><div class="pixel-stat__label">Games</div><div class="pixel-stat__value">${stats.totalGames}</div></div>
      <div class="pixel-stat"><div class="pixel-stat__label">Win Rate</div><div class="pixel-stat__value">${(stats.winRate * 100).toFixed(1)}%</div></div>
      <div class="pixel-stat"><div class="pixel-stat__label">Deal In</div><div class="pixel-stat__value">${stats.avgDealIn.toFixed(2)}</div></div>
    </div>
  `;
  summary.appendChild(summaryBody);
  container.appendChild(summary);

  const skillsSection = document.createElement('section');
  skillsSection.className = 'pixel-page-section';
  skillsSection.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">SKILLS</div>
      <div class="pixel-page-section__subtitle">CURRENT LEVELS</div>
    </div>
  `;
  const skillsBody = document.createElement('div');
  skillsBody.className = 'pixel-page-section__body';
  const skillLabels: Record<string, string> = {
    handReading: '读牌能力',
    efficiency: '牌效率',
    defense: '防守意识',
    riskManagement: '风险控制',
    timing: '时机把握',
    adaptation: '应变能力',
  };
  for (const [key, rawValue] of Object.entries(profile.skillLevel.skills)) {
    skillsBody.appendChild(renderProgress(skillLabels[key] || key, rawValue));
  }
  skillsSection.appendChild(skillsBody);
  container.appendChild(skillsSection);

  const styleSection = document.createElement('section');
  styleSection.className = 'pixel-page-section';
  styleSection.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">STYLE</div>
      <div class="pixel-page-section__subtitle">${profile.playStyle.primaryStyle.toUpperCase()}</div>
    </div>
  `;
  const styleBody = document.createElement('div');
  styleBody.className = 'pixel-page-section__body pixel-grid pixel-grid--two';
  styleBody.appendChild(renderListBlock('DESCRIPTION', [profile.playStyle.description]));
  styleBody.appendChild(renderListBlock('STRENGTHS', profile.playStyle.strengths));
  styleBody.appendChild(renderListBlock('WEAKNESSES', profile.playStyle.weaknesses));
  styleBody.appendChild(renderListBlock('FOCUS', [profile.learningProgress.currentFocus]));
  styleSection.appendChild(styleBody);
  container.appendChild(styleSection);

  const learningSection = document.createElement('section');
  learningSection.className = 'pixel-page-section';
  learningSection.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">RECOMMENDATIONS</div>
      <div class="pixel-page-section__subtitle">NEXT STEPS</div>
    </div>
  `;
  const learningBody = document.createElement('div');
  learningBody.className = 'pixel-page-section__body';
  learningBody.appendChild(renderListBlock('IMPROVE', profile.learningProgress.recommendations));
  learningBody.appendChild(renderListBlock('MISTAKES', profile.patterns.commonMistakes));
  learningSection.appendChild(learningBody);
  container.appendChild(learningSection);
}

function renderProgress(label: string, value: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pixel-progress';
  wrap.innerHTML = `
    <div class="pixel-progress__label"><span>${label}</span><span>${value}</span></div>
    <div class="pixel-progress__track"><div class="pixel-progress__fill" style="width:${value}%;"></div></div>
  `;
  return wrap;
}

function renderListBlock(title: string, items: string[]): HTMLElement {
  const block = document.createElement('div');
  block.className = 'pixel-note-box';

  const titleEl = document.createElement('div');
  titleEl.className = 'pixel-page-section__title';
  titleEl.style.fontSize = '11px';
  titleEl.textContent = title;
  block.appendChild(titleEl);

  const list = document.createElement('div');
  list.className = 'pixel-list';
  list.style.marginTop = '8px';

  const safeItems = items.length > 0 ? items : ['-'];
  for (const item of safeItems) {
    const line = document.createElement('div');
    line.className = 'pixel-note';
    line.textContent = item;
    list.appendChild(line);
  }

  block.appendChild(list);
  return block;
}

export function renderProfileButton(): HTMLElement {
  const btn = createPixelButton('Profile', 'neutral');
  btn.onclick = () => { void renderUserProfilePanel(); };
  return btn;
}

export function clearProfileCache(): void {
  cachedProfile = null;
}
