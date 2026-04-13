type PixelSurfaceOptions = {
  title: string;
  subtitle?: string;
  panelClassName?: string;
  width?: string;
  onClose?: () => void;
};

export type PixelSurface = {
  overlay: HTMLElement;
  panel: HTMLElement;
  body: HTMLElement;
  footer: HTMLElement;
  close: () => void;
};

export function createPixelModalSurface(options: PixelSurfaceOptions): PixelSurface {
  const overlay = document.createElement('div');
  overlay.className = 'pixel-overlay';

  const panel = document.createElement('section');
  panel.className = options.panelClassName ? `pixel-surface pixel-surface--modal ${options.panelClassName}` : 'pixel-surface pixel-surface--modal';
  if (options.width) {
    panel.style.width = options.width;
  }

  const close = () => {
    overlay.remove();
    panel.remove();
    options.onClose?.();
  };

  overlay.onclick = () => close();
  panel.onclick = (event) => event.stopPropagation();

  const header = createSurfaceHeader(options.title, options.subtitle, close);
  const body = document.createElement('div');
  body.className = 'pixel-surface__body';
  const footer = document.createElement('div');
  footer.className = 'pixel-surface__footer';

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);

  return { overlay, panel, body, footer, close };
}

export function createPixelDrawerSurface(options: PixelSurfaceOptions): PixelSurface {
  const overlay = document.createElement('div');
  overlay.className = 'pixel-overlay pixel-overlay--drawer';

  const panel = document.createElement('aside');
  panel.className = options.panelClassName ? `pixel-surface pixel-surface--drawer ${options.panelClassName}` : 'pixel-surface pixel-surface--drawer';
  if (options.width) {
    panel.style.width = options.width;
  }

  const close = () => {
    overlay.remove();
    panel.remove();
    options.onClose?.();
  };

  overlay.onclick = () => close();
  panel.onclick = (event) => event.stopPropagation();

  const header = createSurfaceHeader(options.title, options.subtitle, close);
  const body = document.createElement('div');
  body.className = 'pixel-surface__body pixel-surface__body--drawer';
  const footer = document.createElement('div');
  footer.className = 'pixel-surface__footer';

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);

  return { overlay, panel, body, footer, close };
}

function createSurfaceHeader(title: string, subtitle: string | undefined, onClose: () => void): HTMLElement {
  const header = document.createElement('div');
  header.className = 'pixel-surface__header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'pixel-surface__title-wrap';

  const titleEl = document.createElement('div');
  titleEl.className = 'pixel-surface__title';
  titleEl.textContent = title;
  titleWrap.appendChild(titleEl);

  if (subtitle) {
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'pixel-surface__subtitle';
    subtitleEl.textContent = subtitle;
    titleWrap.appendChild(subtitleEl);
  }

  const closeBtn = createPixelButton('X', 'neutral');
  closeBtn.classList.add('pixel-close-btn');
  closeBtn.onclick = onClose;

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);
  return header;
}

export function createPixelButton(
  label: string,
  variant: 'neutral' | 'accent' | 'success' | 'danger' = 'neutral',
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `pixel-btn pixel-btn--${variant}`;
  btn.textContent = label;
  return btn;
}

export function createPixelEmptyState(code: string, title: string, detail?: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pixel-empty';

  const badge = document.createElement('div');
  badge.className = 'pixel-empty__code';
  badge.textContent = code;
  wrap.appendChild(badge);

  const titleEl = document.createElement('div');
  titleEl.className = 'pixel-empty__title';
  titleEl.textContent = title;
  wrap.appendChild(titleEl);

  if (detail) {
    const detailEl = document.createElement('div');
    detailEl.className = 'pixel-empty__detail';
    detailEl.textContent = detail;
    wrap.appendChild(detailEl);
  }

  return wrap;
}

export function createPixelLoadingState(code: string, text: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pixel-loading';

  const badge = document.createElement('div');
  badge.className = 'pixel-loading__code';
  badge.textContent = code;
  wrap.appendChild(badge);

  const textEl = document.createElement('div');
  textEl.className = 'pixel-loading__text';
  textEl.textContent = text;
  wrap.appendChild(textEl);

  return wrap;
}

export function mountPixelSurface(surface: PixelSurface): void {
  document.body.appendChild(surface.overlay);
  document.body.appendChild(surface.panel);
}

export function createPixelToast(text: string): void {
  const toast = document.createElement('div');
  toast.className = 'pixel-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}
