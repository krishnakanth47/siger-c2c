import React, { useState } from 'react';
import { Layers, ArrowLeftRight, CheckCircle2, Lock } from 'lucide-react';
import { VARIANTS, MAX_ACTIVE_VARIANTS } from '../constants/simulationConstants';

export default function VariantManager({ activeVariantIds, onSwapVariant }) {
  const [selectedActive, setSelectedActive] = useState(null);
  const [selectedWaiting, setSelectedWaiting] = useState(null);

  const activeVariants = VARIANTS.filter((v) => activeVariantIds.includes(v.id));
  const waitingVariants = VARIANTS.filter((v) => !activeVariantIds.includes(v.id));

  const handleExecuteSwap = () => {
    if (selectedActive && selectedWaiting) {
      onSwapVariant(selectedActive, selectedWaiting);
      setSelectedActive(null);
      setSelectedWaiting(null);
    }
  };

  return (
    <div className="industrial-card">
      <div className="panel-header">
        <div className="panel-title">
          <Layers size={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>MATERIAL MANAGEMENT (4 ACTIVE VARIANTS RESTRICTION)</span>
        </div>
        <span className="panel-badge" style={{ color: 'var(--accent-cyan)' }}>
          {activeVariantIds.length} / {MAX_ACTIVE_VARIANTS} ACTIVE
        </span>
      </div>

      <div className="variant-manager-wrapper">
        <div className="variants-row">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-emerald)' }}>
              ● ACTIVE VARIANTS (PERMITTED FOR LOADING)
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Select 1 to swap</span>
          </div>

          <div className="variant-list-grid">
            {activeVariants.map((variant) => {
              const isSelected = selectedActive === variant.id;
              return (
                <div
                  key={variant.id}
                  className={`variant-chip active-chip`}
                  style={{
                    borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-dim)',
                    background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'var(--bg-base)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedActive(isSelected ? null : variant.id)}
                  title="Click to select for swap"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: variant.color,
                        boxShadow: `0 0 6px ${variant.color}`,
                      }}
                    />
                    <span style={{ fontWeight: 700, color: '#ffffff' }}>{variant.name}</span>
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{variant.code}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="variants-row">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)' }}>
              ○ WAITING VARIANTS (HOLD STATE)
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Select 1 to promote</span>
          </div>

          <div className="variant-list-grid">
            {waitingVariants.map((variant) => {
              const isSelected = selectedWaiting === variant.id;
              return (
                <div
                  key={variant.id}
                  className={`variant-chip waiting-chip`}
                  style={{
                    borderColor: isSelected ? 'var(--accent-purple)' : 'var(--border-dim)',
                    background: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'var(--bg-base)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedWaiting(isSelected ? null : variant.id)}
                  title="Click to select for promotion"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        border: `1px solid ${variant.color}`,
                        backgroundColor: 'transparent',
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>{variant.name}</span>
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{variant.code}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Swap Action Button */}
        {selectedActive && selectedWaiting && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn-industrial btn-primary-action"
              onClick={handleExecuteSwap}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <ArrowLeftRight size={14} />
              SWAP ACTIVE VARIANT ({VARIANTS.find((v) => v.id === selectedActive)?.code} ↔{' '}
              {VARIANTS.find((v) => v.id === selectedWaiting)?.code})
            </button>
          </div>
        )}

        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          * Enforced Rule: Any machine assigned to a waiting variant holds doff release until slot opens
        </div>
      </div>
    </div>
  );
}
