import { renderEventLine } from '../components/eventLogView';
import type { UiCtx } from '../context';

export function renderReplay(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'animate-fadeIn';
  container.style.cssText = 'max-width:800px; margin:0 auto; padding:var(--sp-6);';

  const title = document.createElement('h2');
  title.style.cssText = 'color:var(--c-accent); margin-bottom:var(--sp-4);';
  title.textContent = 'Replay';

  const back = document.createElement('button');
  back.className = 'btn btn-ghost btn-sm';
  back.textContent = 'Home';
  back.onclick = () => ctx.navigate('#/');

  const play = document.createElement('button');
  play.className = 'btn btn-primary btn-sm';
  play.textContent = 'Play';

  const stop = document.createElement('button');
  stop.className = 'btn btn-danger btn-sm';
  stop.textContent = 'Stop';
  stop.disabled = true;

  const out = document.createElement('div');
  out.className = 'card';
  out.style.cssText += `
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: var(--fs-xs); white-space: pre-wrap;
    max-height: 400px; overflow: auto; margin-top: var(--sp-4);
  `;

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex; gap:var(--sp-2);';
  controls.appendChild(back);
  controls.appendChild(play);
  controls.appendChild(stop);

  container.appendChild(title);
  container.appendChild(controls);
  container.appendChild(out);
  root.appendChild(container);

  const replay = ctx.storage.loadLatest();
  if (!replay) {
    out.textContent = 'No replay available. Export one from Match page.';
    play.disabled = true;
    return;
  }

  let playing = false;
  let shouldStop = false;

  stop.onclick = () => { shouldStop = true; };

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
