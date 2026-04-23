import { X } from 'lucide-react';

import { HOTKEYS, isMac } from '../lib/hotkeys';

import './ShortcutsModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ open, onClose }: Props) {
  if (!open) return null;
  const mac = isMac();
  const groups = HOTKEYS.reduce<Record<string, typeof HOTKEYS>>((acc, h) => {
    (acc[h.group] ??= []).push(h);
    return acc;
  }, {});

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="shortcuts-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="shortcuts-header">
          <h2>Keyboard shortcuts</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="shortcuts-body">
          {Object.entries(groups).map(([group, hotkeys]) => (
            <section key={group} className="shortcuts-group">
              <h3>{group}</h3>
              <dl>
                {hotkeys.map((h) => (
                  <div key={h.id}>
                    <dt>
                      <kbd>{mac ? h.display.mac : h.display.other}</kbd>
                    </dt>
                    <dd>{h.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
