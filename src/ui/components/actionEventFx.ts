import type { GameEvent } from '../../core/model/event';
import type { PlayerId } from '../../core/model/types';
import { languageStore } from '../../store/languageStore';

type TransferEventType = 'PENG' | 'GANG' | 'HU';
type ActionSeat = 'top' | 'right' | 'bottom' | 'left';
type TransferEvent = GameEvent & { type: TransferEventType; playerId: PlayerId };

function isTransferEvent(event: GameEvent): event is TransferEvent {
  return Boolean(
    event.playerId
    && (event.type === 'PENG' || event.type === 'GANG' || event.type === 'HU'),
  );
}

function getActionLabel(type: TransferEventType): string {
  const t = languageStore.t().game;
  if (type === 'PENG') return t.peng;
  if (type === 'GANG') return t.gang;
  return t.hu;
}

function getTargetElement(event: TransferEvent, root: HTMLElement): HTMLElement | null {
  const selector = event.type === 'HU'
    ? `[data-action-target-hu="${event.playerId}"]`
    : `[data-action-target-hand="${event.playerId}"]`;
  return root.querySelector(selector) as HTMLElement | null;
}

function getTargetSeat(target: HTMLElement): ActionSeat {
  const seat = target.dataset.actionSeat;
  if (seat === 'top' || seat === 'right' || seat === 'left' || seat === 'bottom') {
    return seat;
  }
  return 'bottom';
}

function waitForAnimation(animation: Animation | undefined): Promise<void> {
  if (!animation) return Promise.resolve();
  return animation.finished.then(() => undefined).catch(() => undefined);
}

function clampToViewport(point: { x: number; y: number }, padding = 56): { x: number; y: number } {
  return {
    x: Math.max(padding, Math.min(window.innerWidth - padding, point.x)),
    y: Math.max(padding, Math.min(window.innerHeight - padding, point.y)),
  };
}

function getStartPoint(root: HTMLElement): { x: number; y: number } {
  const anchor = root.querySelector('.pixel-center') as HTMLElement | null;
  const rect = (anchor ?? root).getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getTargetPoint(target: HTMLElement, seat: ActionSeat): { x: number; y: number } {
  const rect = target.getBoundingClientRect();
  let x = rect.left + rect.width / 2;
  let y = rect.top + rect.height / 2;

  // Side seats are close to viewport edges. Bias toward center to avoid clipping.
  if (seat === 'left') {
    x += Math.max(14, rect.width * 0.25);
  } else if (seat === 'right') {
    x -= Math.max(14, rect.width * 0.25);
  }

  return clampToViewport({ x, y });
}

function createBadge(
  event: TransferEvent,
  start: { x: number; y: number },
  seat: ActionSeat,
): HTMLElement {
  const badge = document.createElement('div');
  badge.className = `pixel-action-fx pixel-action-fx--${event.type.toLowerCase()}`;
  if (seat === 'left' || seat === 'right') {
    badge.classList.add('pixel-action-fx--side', `pixel-action-fx--side-${seat}`);
  }
  badge.textContent = getActionLabel(event.type);
  badge.style.left = `${start.x}px`;
  badge.style.top = `${start.y}px`;
  return badge;
}

function pulseTarget(target: HTMLElement): void {
  target.classList.add('pixel-action-fx-target');
  window.setTimeout(() => {
    target.classList.remove('pixel-action-fx-target');
  }, 420);
}

export async function playActionTransferFx(event: GameEvent, root: HTMLElement): Promise<void> {
  if (!isTransferEvent(event) || !root.isConnected) return;

  const target = getTargetElement(event, root);
  if (!target) return;

  const seat = getTargetSeat(target);
  const start = getStartPoint(root);
  const end = getTargetPoint(target, seat);
  const badge = createBadge(event, start, seat);
  document.body.appendChild(badge);

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const popDuration = reduceMotion ? 120 : 220;
  const moveDuration = reduceMotion ? 180 : 430;

  try {
    const pop = badge.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.58)', opacity: 0.2 },
        { transform: 'translate(-50%, -50%) scale(1.18)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      ],
      {
        duration: popDuration,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      },
    );
    await waitForAnimation(pop);

    const move = badge.animate(
      [
        { transform: 'translate(-50%, -50%) translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.56)`, opacity: 0.08 },
      ],
      {
        duration: moveDuration,
        easing: 'cubic-bezier(0.18, 0.86, 0.2, 1)',
        fill: 'forwards',
      },
    );
    await waitForAnimation(move);
    pulseTarget(target);
  } finally {
    badge.remove();
  }
}

export function extractTransferEvents(events: GameEvent[], fromIndex: number): TransferEvent[] {
  return events.slice(fromIndex).filter(isTransferEvent);
}
