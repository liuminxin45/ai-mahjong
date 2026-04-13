import { renderEventLine } from '../components/eventLogView';
import type { UiCtx } from '../context';
import { languageStore } from '../../store/languageStore';
import { createPixelButton, createPixelEmptyState } from '../components/pixelFrame';

export function renderReplay(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'pixel-app-page';

  const shell = document.createElement('section');
  shell.className = 'pixel-page-shell';

  const header = document.createElement('div');
  header.className = 'pixel-page-header';

  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'pixel-page-title';
  title.textContent = languageStore.getLanguage() === 'zh' ? 'Replay' : 'Replay';
  const subtitle = document.createElement('div');
  subtitle.className = 'pixel-page-subtitle';
  subtitle.textContent = languageStore.getLanguage() === 'zh'
    ? '像素回放台。按时间顺序播放最近一局。'
    : 'Pixel replay desk. Play the latest match in order.';
  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  const toolbar = document.createElement('div');
  toolbar.className = 'pixel-page-toolbar';

  const back = createPixelButton(languageStore.t().common.back, 'neutral');
  back.onclick = () => ctx.navigate('#/');
  const play = createPixelButton('Play', 'success');
  const stop = createPixelButton('Stop', 'danger');
  stop.disabled = true;

  toolbar.appendChild(back);
  toolbar.appendChild(play);
  toolbar.appendChild(stop);

  header.appendChild(titleWrap);
  header.appendChild(toolbar);

  const body = document.createElement('div');
  body.className = 'pixel-page-body';

  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">EVENT LOG</div>
      <div class="pixel-page-section__subtitle">LATEST REPLAY</div>
    </div>
  `;

  const sectionBody = document.createElement('div');
  sectionBody.className = 'pixel-page-section__body';
  const out = document.createElement('div');
  out.className = 'pixel-log';
  sectionBody.appendChild(out);
  section.appendChild(sectionBody);
  body.appendChild(section);

  shell.appendChild(header);
  shell.appendChild(body);
  page.appendChild(shell);
  root.appendChild(page);

  const replay = ctx.storage.loadLatest();
  if (!replay) {
    out.innerHTML = '';
    out.appendChild(createPixelEmptyState('NO DATA', languageStore.getLanguage() === 'zh' ? '没有可用回放' : 'No replay available', languageStore.getLanguage() === 'zh' ? '先在对局页导出一局。' : 'Export one from the match page first.'));
    play.disabled = true;
    return;
  }

  let playing = false;
  let shouldStop = false;

  stop.onclick = () => {
    shouldStop = true;
  };

  play.onclick = async () => {
    if (playing) return;
    playing = true;
    shouldStop = false;
    play.disabled = true;
    stop.disabled = false;

    out.textContent = '';
    for (const event of replay.events) {
      if (shouldStop) break;
      out.textContent += `${renderEventLine(event)}\n`;
      out.scrollTop = out.scrollHeight;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    playing = false;
    play.disabled = false;
    stop.disabled = true;
  };
}
