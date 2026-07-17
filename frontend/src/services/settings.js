// Playback preferences persisted in localStorage and consumed by the Dashboard player.
const KEY = 'videoapp_settings';

const DEFAULTS = {
  defaultVolume: 1,     // 0..1, initial volume for the player
  autoPlayNext: true,   // show the "Up Next" countdown and auto-advance when a video ends
};

export function getSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(partial) {
  const next = { ...getSettings(), ...partial };
  localStorage.setItem(KEY, JSON.stringify(next));
  // Notify listeners in the same tab (the native 'storage' event only fires cross-tab).
  window.dispatchEvent(new CustomEvent('settingschange', { detail: next }));
  return next;
}
