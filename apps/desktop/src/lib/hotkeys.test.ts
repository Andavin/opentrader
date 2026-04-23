import { describe, expect, it } from 'vitest';

import { HOTKEYS, HOTKEY_BY_ID } from './hotkeys';

describe('hotkeys table', () => {
  it('has unique ids and combos', () => {
    const ids = new Set<string>();
    const combos = new Set<string>();
    for (const h of HOTKEYS) {
      expect(ids.has(h.id), `dup id: ${h.id}`).toBe(false);
      expect(combos.has(h.combo), `dup combo: ${h.combo}`).toBe(false);
      ids.add(h.id);
      combos.add(h.combo);
    }
  });

  it('every hotkey has both mac and non-mac display strings', () => {
    for (const h of HOTKEYS) {
      expect(h.display.mac, `${h.id} mac display`).toBeTruthy();
      expect(h.display.other, `${h.id} other display`).toBeTruthy();
      expect(h.description, `${h.id} description`).toBeTruthy();
    }
  });

  it('HOTKEY_BY_ID exposes every entry', () => {
    expect(Object.keys(HOTKEY_BY_ID)).toHaveLength(HOTKEYS.length);
    for (const h of HOTKEYS) {
      expect(HOTKEY_BY_ID[h.id]).toBe(h);
    }
  });

  it('groups all hotkeys into one of the known buckets', () => {
    const valid: ReadonlySet<string> = new Set(['Trading', 'Workspace', 'Help']);
    for (const h of HOTKEYS) {
      expect(valid.has(h.group)).toBe(true);
    }
  });
});
