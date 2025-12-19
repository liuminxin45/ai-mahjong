import { renderHome } from './ui/pages/home';
import { renderMatch } from './ui/pages/match';
import { renderReplay } from './ui/pages/replay';
import { renderSettings } from './ui/pages/settings';
import { GameOrchestrator } from './orchestration/GameOrchestrator';
import { gameStore } from './store/gameStore';
import { settingsStore } from './store/settingsStore';
import { languageStore } from './store/languageStore';
import { storage } from './persistence/storage';
import { HeuristicAnalyzer } from './analysis/HeuristicAnalyzer';
import { createBrowserLLMAnalyzerFromStorage } from './analysis/LLMAnalyzer';
import { placeholderRulePack } from './core/rules/packs/placeholder';
import type { UiCtx } from './ui/context';

let currentCleanup: (() => void) | null = null;

const analyzer = new HeuristicAnalyzer();
const llmAnalyzer = createBrowserLLMAnalyzerFromStorage();

const ctx: UiCtx = {
  analyzer,
  llmAnalyzer,
  gameStore,
  orchestrator: new GameOrchestrator(placeholderRulePack, undefined, gameStore, settingsStore, analyzer),
  settingsStore,
  storage,
  navigate: (hash: string) => {
    window.location.hash = hash;
  },
};

function mountRouter(root: HTMLElement): void {
  const render = () => {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }

    const h = window.location.hash || '#/';
    if (h === '#/' || h === '#') {
      renderHome(root, ctx);
      return;
    }
    if (h === '#/match') {
      currentCleanup = renderMatch(root, ctx);
      return;
    }
    if (h === '#/settings') {
      renderSettings(root, ctx);
      return;
    }
    if (h === '#/replay') {
      renderReplay(root, ctx);
      return;
    }

    renderHome(root, ctx);
  };

  window.addEventListener('hashchange', render);
  
  // 监听语言变化，自动重新渲染
  languageStore.subscribe(() => {
    render();
  });
  
  render();
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app');
}

app.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
app.style.padding = '16px';

mountRouter(app);
