import React from 'react';
import { VARIANTS } from '../constants/simulationConstants';
import { Zap, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function ProductionGrid({
  machines,
  activeVariantIds,
  storyActiveTarget,
  onSelectEntity,
  onTriggerManualDoff,
}) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'RUNNING':
        return { label: 'RUNNING', className: 'led-running pulse-animation', text: 'RUNNING' };
      case 'DOFF_COMPLETE':
        return { label: 'DOFF COMPLETE', className: 'led-warning', text: 'DOFF READY' };
      case 'QUEUED':
        return { label: 'QUEUED', className: 'led-warning', text: 'IN FIFO' };
      case 'WAITING_VARIANT':
        return { label: 'WAITING VARIANT', className: 'led-error', text: 'VARIANT LIMIT' };
      case 'WAITING_QUEUE':
        return { label: 'WAITING QUEUE', className: 'led-warning', text: 'QUEUE FULL' };
      default:
        return { label: status, className: 'led-empty', text: status };
    }
  };

  return (
    <div className="industrial-card">
      <div className="panel-header">
        <div className="panel-title">
          <Zap size={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>PRODUCTION AREA (16 RING FRAMES)</span>
        </div>
        <span className="panel-badge">16 UNITS</span>
      </div>

      <div className="machines-grid-wrapper">
        {machines.map((machine) => {
          const variant = VARIANTS.find((v) => v.id === machine.variantId);
          const isVariantActive = activeVariantIds.includes(machine.variantId);
          const isStory = storyActiveTarget === machine.id;
          const statusInfo = getStatusBadge(machine.status);
          const isDoffFinished = machine.doffCount >= machine.targetDoff;

          return (
            <div
              key={machine.id}
              className={`machine-card ${isStory ? 'story-active' : ''} ${
                machine.status === 'QUEUED' ? 'queued-active' : ''
              }`}
              onClick={() => onSelectEntity({ type: 'machine', data: machine, variant })}
              title={`Click to inspect ${machine.id}`}
            >
              <div className="machine-top">
                <span className="machine-id">{machine.id}</span>
                <span
                  className="machine-variant-tag"
                  style={{
                    backgroundColor: variant?.glow || 'rgba(255,255,255,0.1)',
                    color: variant?.color || '#fff',
                    border: `1px solid ${variant?.color || '#666'}`,
                  }}
                >
                  {variant?.name || 'Unknown'}
                </span>
              </div>

              <div className="machine-doff-meter">
                <div className="meter-labels">
                  <span>Doff Progress</span>
                  <span style={{ fontWeight: 700, color: isDoffFinished ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                    {Math.round(machine.doffCount)} / {machine.targetDoff}
                  </span>
                </div>
                <div className="meter-track">
                  <div
                    className={`meter-fill ${isDoffFinished ? 'doff-complete' : ''}`}
                    style={{ width: `${Math.min(100, (machine.doffCount / machine.targetDoff) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="machine-status-line">
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span className={`led-indicator ${statusInfo.className}`} />
                  <span style={{ color: isDoffFinished ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
                    {statusInfo.text}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTriggerManualDoff(machine.id);
                  }}
                  title="Force complete doff for testing"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '2px',
                  }}
                  onMouseEnter={(e) => (e.target.style.color = 'var(--accent-cyan)')}
                  onMouseLeave={(e) => (e.target.style.color = 'var(--text-muted)')}
                >
                  [FORCE DOFF]
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
