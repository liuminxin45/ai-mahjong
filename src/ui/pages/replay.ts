import { renderEventLine } from '../components/eventLogView';
import type { UiCtx } from '../context';
import { languageStore } from '../../store/languageStore';
import { createPixelButton, createPixelEmptyState } from '../components/pixelFrame';

export function renderReplay(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';
  const t = languageStore.t();
  const tr = t.replay;

  const page = document.createElement('div');
  page.className = 'pixel-app-page';

  const shell = document.createElement('section');
  shell.className = 'pixel-page-shell';

  const header = document.createElement('div');
  header.className = 'pixel-page-header';

  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'pixel-page-title';
  title.textContent = tr.title;
  const subtitle = document.createElement('div');
  subtitle.className = 'pixel-page-subtitle';
  subtitle.textContent = tr.subtitle;
  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  const toolbar = document.createElement('div');
  toolbar.className = 'pixel-page-toolbar';

  const back = createPixelButton(t.common.back, 'neutral');
  back.onclick = () => ctx.navigate('#/');
  const play = createPixelButton(tr.play, 'success');
  const stop = createPixelButton(tr.stop, 'danger');
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
      <div class="pixel-page-section__title">${tr.eventLogTitle}</div>
      <div class="pixel-page-section__subtitle">${tr.eventLogSubtitle}</div>
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
    out.appendChild(createPixelEmptyState('NO DATA', tr.noDataTitle, tr.noDataDetail));
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
