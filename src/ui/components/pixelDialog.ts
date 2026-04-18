import { languageStore } from '../../store/languageStore';
import { createPixelButton, createPixelModalSurface, mountPixelSurface } from './pixelFrame';

type PixelDialogOptions = {
  title?: string;
  message: string;
  code?: string;
  confirmText?: string;
  cancelText?: string;
};

let activeClose: (() => void) | null = null;

export function showPixelAlertDialog(options: PixelDialogOptions): () => void {
  dismissPixelAlertDialog();

  const t = languageStore.t().common;
  const surface = createPixelModalSurface({
    title: options.title || t.error,
    subtitle: options.code,
    panelClassName: 'pixel-dialog-surface',
    width: 'min(92vw, 420px)',
  });
  const baseClose = surface.close;

  const message = document.createElement('div');
  message.className = 'pixel-dialog__message';
  message.textContent = options.message;
  surface.body.appendChild(message);

  const confirmBtn = createPixelButton(options.confirmText || t.confirm, 'accent');
  confirmBtn.onclick = () => surface.close();
  surface.footer.appendChild(confirmBtn);

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault();
      surface.close();
    }
  };

  const close = () => {
    document.removeEventListener('keydown', handleKeydown);
    if (activeClose === close) {
      activeClose = null;
    }
    baseClose();
  };

  surface.close = close;
  document.addEventListener('keydown', handleKeydown);
  mountPixelSurface(surface);
  confirmBtn.focus();

  activeClose = close;
  return close;
}

export function showPixelConfirmDialog(options: PixelDialogOptions): Promise<boolean> {
  dismissPixelAlertDialog();

  const t = languageStore.t().common;
  const surface = createPixelModalSurface({
    title: options.title || t.confirm,
    subtitle: options.code,
    panelClassName: 'pixel-dialog-surface',
    width: 'min(92vw, 420px)',
  });
  const baseClose = surface.close;

  const message = document.createElement('div');
  message.className = 'pixel-dialog__message';
  message.textContent = options.message;
  surface.body.appendChild(message);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        close(true);
      }
    };

    const close = (result = false) => {
      document.removeEventListener('keydown', handleKeydown);
      if (activeClose === dismiss) {
        activeClose = null;
      }
      baseClose();
      settle(result);
    };

    const dismiss = () => close(false);
    surface.close = dismiss;

    const cancelBtn = createPixelButton(options.cancelText || t.cancel, 'neutral');
    cancelBtn.onclick = () => close(false);
    const confirmBtn = createPixelButton(options.confirmText || t.confirm, 'danger');
    confirmBtn.onclick = () => close(true);

    surface.footer.appendChild(cancelBtn);
    surface.footer.appendChild(confirmBtn);

    document.addEventListener('keydown', handleKeydown);
    mountPixelSurface(surface);
    confirmBtn.focus();

    activeClose = dismiss;
  });
}

export function dismissPixelAlertDialog(): void {
  activeClose?.();
}
