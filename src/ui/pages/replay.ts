import { renderEventLine } from '../components/eventLogView';
import type { UiCtx } from '../context';

export function renderReplay(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Replay';

  const back = document.createElement('button');
  back.textContent = 'Home';
  back.onclick = () => {
    ctx.navigate('#/');
  };

  const play = document.createElement('button');
  play.textContent = 'Play';

  const stop = document.createElement('button');
  stop.textContent = 'Stop';
  stop.disabled = true;

  const out = document.createElement('div');
  out.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  out.style.fontSize = '12px';
  out.style.whiteSpace = 'pre-wrap';
  out.style.border = '1px solid #eee';
  out.style.borderRadius = '8px';
  out.style.padding = '8px';
  out.style.maxHeight = '360px';
  out.style.overflow = 'auto';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '8px';
  controls.appendChild(back);
  controls.appendChild(play);
  controls.appendChild(stop);

  root.appendChild(title);
  root.appendChild(controls);
  root.appendChild(out);

  const replay = ctx.storage.loadLatest();
  if (!replay) {
    out.textContent = 'No replay available. Export one from Match page.';
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
    for (const ev of replay.events) {
      if (shouldStop) break;
      out.textContent += renderEventLine(ev) + '\n';
      out.scrollTop = out.scrollHeight;
      await new Promise((r) => setTimeout(r, 300));
    }

    playing = false;
    play.disabled = false;
    stop.disabled = true;
  };
}
