/**
 * UI style helpers — applies CSS class-based styling
 * Works across all language modes with the new dark theme
 */

/**
 * Apply button styling via CSS classes (replaces inline style approach)
 */
export function applyChineseButtonStyle(
  button: HTMLButtonElement,
  variant: 'primary' | 'success' | 'danger' | 'warning' | 'info' = 'primary',
): void {
  button.classList.add('btn');
  const classMap: Record<string, string> = {
    primary: 'btn-primary',
    success: 'btn-success',
    danger: 'btn-danger',
    warning: 'btn-accent',
    info: 'btn-ghost',
  };
  button.classList.add(classMap[variant] || 'btn-primary');
}

/**
 * Apply card container styling
 */
export function applyChineseCardStyle(container: HTMLElement): void {
  container.classList.add('card');
}

/**
 * Apply player area styling
 */
export function applyChinesePlayerAreaStyle(container: HTMLElement, isWinner = false): void {
  container.classList.add('player-panel');
  if (isWinner) {
    container.classList.add('player-panel--winner');
  }
}

/**
 * Apply title styling
 */
export function applyChineseTitleStyle(title: HTMLElement): void {
  title.style.color = 'var(--c-accent)';
  title.style.fontWeight = 'var(--fw-bold)';
}

/**
 * Apply panel styling
 */
export function applyChinesePanelStyle(panel: HTMLElement): void {
  panel.classList.add('card-elevated');
}

/**
 * Legacy compat — always returns true to enable styled mode everywhere
 */
export function isChineseMode(): boolean {
  return true;
}
