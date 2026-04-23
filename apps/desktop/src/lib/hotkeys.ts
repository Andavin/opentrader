/**
 * Centralized hotkey table — single source of truth for what binds
 * what. Used by GlobalHotkeys to register the bindings AND by
 * ShortcutsModal to render the help overlay so the two never drift.
 *
 * react-hotkeys-hook combo syntax: '+' joins modifiers, ',' splits
 * alternatives. `mod` is Cmd on macOS, Ctrl elsewhere.
 */

export interface HotkeyDef {
  id: string;
  combo: string;
  /** Display strings for the help overlay (one per platform). */
  display: { mac: string; other: string };
  description: string;
  group: 'Trading' | 'Workspace' | 'Help';
}

export const HOTKEYS: HotkeyDef[] = [
  {
    id: 'buyMarket',
    combo: 'shift+b',
    display: { mac: '⇧B', other: 'Shift+B' },
    description: 'Buy market for active symbol',
    group: 'Trading',
  },
  {
    id: 'sellMarket',
    combo: 'shift+s',
    display: { mac: '⇧S', other: 'Shift+S' },
    description: 'Sell market for active symbol',
    group: 'Trading',
  },
  {
    id: 'buyLimitAsk',
    combo: 'shift+alt+b',
    display: { mac: '⇧⌥B', other: 'Shift+Alt+B' },
    description: 'Buy limit at the ask',
    group: 'Trading',
  },
  {
    id: 'sellLimitBid',
    combo: 'shift+alt+s',
    display: { mac: '⇧⌥S', other: 'Shift+Alt+S' },
    description: 'Sell limit at the bid',
    group: 'Trading',
  },
  {
    id: 'flattenPosition',
    combo: 'shift+alt+f',
    display: { mac: '⇧⌥F', other: 'Shift+Alt+F' },
    description: 'Flatten the active-symbol position (market opposite)',
    group: 'Trading',
  },
  {
    id: 'openShortcuts',
    combo: 'mod+/',
    display: { mac: '⌘/', other: 'Ctrl+/' },
    description: 'Open shortcuts overlay',
    group: 'Help',
  },
  {
    id: 'closeModal',
    combo: 'escape',
    display: { mac: '⎋', other: 'Esc' },
    description: 'Close any open modal',
    group: 'Workspace',
  },
];

export const HOTKEY_BY_ID = Object.fromEntries(HOTKEYS.map((h) => [h.id, h])) as Record<
  string,
  HotkeyDef
>;

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}
