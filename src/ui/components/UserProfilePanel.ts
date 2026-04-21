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
import { languageStore } from '../../store/languageStore';

let cachedProfile: UserProfile | null = null;

function getProfileText() {
  return languageStore.t().profilePanel;
}

export async function renderUserProfilePanel(onClose?: () => void): Promise<HTMLElement> {
  const text = getProfileText();
  const surface = createPixelModalSurface({
    title: text.title,
    subtitle: text.subtitle,
    width: 'min(94vw, 680px)',
    onClose,
  });

  surface.body.appendChild(createPixelLoadingState('LOAD', text.loading));
  mountPixelSurface(surface);

  try {
    await historyStorage.init();
    const stats = await historyStorage.calculateStatsForAnalysis();

    surface.body.innerHTML = '';
    if (stats.totalGames < 3) {
      surface.body.appendChild(
        createPixelEmptyState('LOW DATA', text.lowDataTitle, text.lowDataDetail(stats.totalGames)),
      );
      return surface.panel;
    }

    if (!cachedProfile) {
      const profileData = await llmService.analyzeProfile(stats);
      cachedProfile = {
        userId: 'default_user',
        nickname: text.player,
        createdAt: new Date(),
        lastActive: new Date(),
        ...profileData,
      } as UserProfile;
      await historyStorage.saveProfile(cachedProfile);
    }

    renderProfileContent(surface.body, cachedProfile, stats);

    const refresh = createPixelButton(text.refresh, 'success');
    refresh.onclick = async () => {
      cachedProfile = null;
      surface.body.innerHTML = '';
      surface.body.appendChild(createPixelLoadingState('LOAD', text.refreshing));
      try {
        const newStats = await historyStorage.calculateStatsForAnalysis();
        const profileData = await llmService.analyzeProfile(newStats);
        cachedProfile = {
          userId: 'default_user',
          nickname: text.player,
          createdAt: new Date(),
          lastActive: new Date(),
          ...profileData,
        } as UserProfile;
        await historyStorage.saveProfile(cachedProfile);
        surface.body.innerHTML = '';
        renderProfileContent(surface.body, cachedProfile, newStats);
        createPixelToast(text.refreshToast);
      } catch (error) {
        console.error('[UserProfile] Refresh failed:', error);
      }
    };
    surface.footer.appendChild(refresh);
  } catch (error) {
    console.error('[UserProfile] Failed to load:', error);
    surface.body.innerHTML = '';
    surface.body.appendChild(createPixelEmptyState('ERROR', text.errorTitle, text.errorDetail));
  }

  return surface.panel;
}

function renderProfileContent(
  container: HTMLElement,
  profile: UserProfile,
  stats: { totalGames: number; winRate: number; avgDealIn: number },
): void {
  const text = getProfileText();
  const rankNames: Record<string, string> = {
    beginner: text.rankBeginner,
    intermediate: text.rankIntermediate,
    advanced: text.rankAdvanced,
    expert: text.rankExpert,
  };

  const summary = document.createElement('section');
  summary.className = 'pixel-page-section';
  summary.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.profile}</div>
      <div class="pixel-page-section__subtitle">${rankNames[profile.skillLevel.rank] || text.unknown}</div>
    </div>
  `;
  const summaryBody = document.createElement('div');
  summaryBody.className = 'pixel-page-section__body';
  summaryBody.innerHTML = `
    <div class="pixel-grid pixel-grid--stats">
      <div class="pixel-stat"><div class="pixel-stat__label">${text.overall}</div><div class="pixel-stat__value">${profile.skillLevel.overall}</div></div>
      <div class="pixel-stat"><div class="pixel-stat__label">${text.games}</div><div class="pixel-stat__value">${stats.totalGames}</div></div>
      <div class="pixel-stat"><div class="pixel-stat__label">${text.winRate}</div><div class="pixel-stat__value">${(stats.winRate * 100).toFixed(1)}%</div></div>
      <div class="pixel-stat"><div class="pixel-stat__label">${text.dealIn}</div><div class="pixel-stat__value">${stats.avgDealIn.toFixed(2)}</div></div>
    </div>
  `;
  summary.appendChild(summaryBody);
  container.appendChild(summary);

  const skillsSection = document.createElement('section');
  skillsSection.className = 'pixel-page-section';
  skillsSection.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.skills}</div>
      <div class="pixel-page-section__subtitle">${text.currentLevels}</div>
    </div>
  `;
  const skillsBody = document.createElement('div');
  skillsBody.className = 'pixel-page-section__body';
  const skillLabels: Record<string, string> = {
    handReading: text.skillHandReading,
    efficiency: text.skillEfficiency,
    defense: text.skillDefense,
    riskManagement: text.skillRiskManagement,
    timing: text.skillTiming,
    adaptation: text.skillAdaptation,
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
      <div class="pixel-page-section__title">${text.style}</div>
      <div class="pixel-page-section__subtitle">${profile.playStyle.primaryStyle.toUpperCase()}</div>
    </div>
  `;
  const styleBody = document.createElement('div');
  styleBody.className = 'pixel-page-section__body pixel-grid pixel-grid--two';
  styleBody.appendChild(renderListBlock(text.description, [profile.playStyle.description]));
  styleBody.appendChild(renderListBlock(text.strengths, profile.playStyle.strengths));
  styleBody.appendChild(renderListBlock(text.weaknesses, profile.playStyle.weaknesses));
  styleBody.appendChild(renderListBlock(text.focus, [profile.learningProgress.currentFocus]));
  styleSection.appendChild(styleBody);
  container.appendChild(styleSection);

  const learningSection = document.createElement('section');
  learningSection.className = 'pixel-page-section';
  learningSection.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${text.recommendations}</div>
      <div class="pixel-page-section__subtitle">${text.nextSteps}</div>
    </div>
  `;
  const learningBody = document.createElement('div');
  learningBody.className = 'pixel-page-section__body';
  learningBody.appendChild(renderListBlock(text.improve, profile.learningProgress.recommendations));
  learningBody.appendChild(renderListBlock(text.mistakes, profile.patterns.commonMistakes));
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
  titleEl.className = 'pixel-page-section__title pixel-page-section__title--compact';
  titleEl.textContent = title;
  block.appendChild(titleEl);

  const list = document.createElement('div');
  list.className = 'pixel-list pixel-list--gap';

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
  const text = getProfileText();
  const btn = createPixelButton(text.button, 'neutral');
  btn.onclick = () => { void renderUserProfilePanel(); };
  return btn;
}

export function clearProfileCache(): void {
  cachedProfile = null;
}
