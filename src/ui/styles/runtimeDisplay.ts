import type { settingsStore as settingsStoreType } from '../../store/settingsStore';

type SettingsStoreLike = typeof settingsStoreType;

export function buildDisplayCssVars(uiScale: number, hudSafeZonePercent: number): Record<string, string> {
  const safeUiScale = Number.isFinite(uiScale) ? Math.max(0.85, Math.min(1.35, uiScale)) : 1;
  const safeZone = Number.isFinite(hudSafeZonePercent)
    ? Math.max(0, Math.min(8, Math.round(hudSafeZonePercent)))
    : 3;

  return {
    '--ui-scale': safeUiScale.toFixed(2),
    '--safe-zone-percent': `${safeZone}`,
  };
}

export function applyDisplaySettings(settingsStore: SettingsStoreLike): void {
  const root = document.documentElement;
  const cssVars = buildDisplayCssVars(settingsStore.uiScale, settingsStore.hudSafeZonePercent);
  for (const [key, value] of Object.entries(cssVars)) {
    root.style.setProperty(key, value);
  }
}
