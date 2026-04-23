import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';

import { brokerClient } from '../lib/brokerClient';
import { useWorkspaceStore } from '../store/workspace';

import './ConnectAlpacaModal.css';

export function ConnectAlpacaModal() {
  const open = useWorkspaceStore((s) => s.connectModalOpen) === 'alpaca';
  const close = useWorkspaceStore((s) => s.openConnectModal);
  const queryClient = useQueryClient();

  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [paper, setPaper] = useState(true);

  const connect = useMutation({
    mutationFn: () => brokerClient.connect('alpaca', { key, secret, paper }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker-status', 'alpaca'] });
      close(null);
      setKey('');
      setSecret('');
    },
  });

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => close(null)}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Connect Alpaca</h2>
          <button
            type="button"
            className="modal-close"
            onClick={() => close(null)}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            connect.mutate();
          }}
        >
          <p className="modal-hint">
            Paste a paper-trading API key from your{' '}
            <span className="modal-link">Alpaca dashboard → Paper Trading → View API Keys</span>.
          </p>
          <label className="modal-field">
            <span>API key ID</span>
            <input
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="PK..."
              required
            />
          </label>
          <label className="modal-field">
            <span>API secret</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
            />
          </label>
          <label className="modal-checkbox">
            <input type="checkbox" checked={paper} onChange={(e) => setPaper(e.target.checked)} />
            <span>Paper trading</span>
          </label>
          {connect.isError && <p className="modal-error">{(connect.error as Error).message}</p>}
          <div className="modal-actions">
            <button type="button" className="modal-btn-ghost" onClick={() => close(null)}>
              Cancel
            </button>
            <button type="submit" className="modal-btn-primary" disabled={connect.isPending}>
              {connect.isPending ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
