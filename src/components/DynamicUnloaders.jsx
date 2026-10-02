import React from 'react';
import { CornerDownRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { VARIANTS } from '../constants/simulationConstants';

export default function DynamicUnloaders({ unloaders, storyActiveTarget, onSelectEntity }) {
  const getUnloaderColor = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return { text: 'AVAILABLE', color: 'var(--accent-emerald)', bg: 'rgba(16, 185, 129, 0.12)' };
      case 'ASSIGNED':
        return { text: 'ASSIGNED', color: 'var(--accent-cyan)', bg: 'rgba(0, 240, 255, 0.12)' };
      case 'UNLOADING':
        return { text: 'UNLOADING', color: 'var(--accent-purple)', bg: 'rgba(168, 85, 247, 0.12)' };
      case 'COMPLETE':
        return { text: 'UNLOADED', color: 'var(--accent-emerald)', bg: 'rgba(16, 185, 129, 0.12)' };
      default:
        return { text: status, color: 'var(--text-muted)', bg: 'transparent' };
    }
  };

  return (
    <div className="industrial-card">
      <div className="panel-header">
        <div className="panel-title">
          <CornerDownRight size={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>DYNAMIC UNLOADERS (4 STATIONS)</span>
        </div>
        <span className="panel-badge">4 STATIONS</span>
      </div>

      <div className="unloaders-grid">
        {unloaders.map((unloader) => {
          const isStory = storyActiveTarget === unloader.id;
          const statusStyle = getUnloaderColor(unloader.status);
          const variant = VARIANTS.find((v) => v.id === unloader.variantId);
          const isUnloading = unloader.status === 'UNLOADING' || unloader.status === 'ASSIGNED';

          return (
            <div
              key={unloader.id}
              className={`unloader-card ${isUnloading ? 'unloading-active' : ''} ${
                isStory ? 'story-active' : ''
              }`}
              onClick={() => onSelectEntity({ type: 'unloader', data: unloader, variant })}
              title={`Click to inspect Dynamic Unloader ${unloader.id}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>
                  {unloader.id}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: statusStyle.color,
                    background: statusStyle.bg,
                    padding: '2px 6px',
                    borderRadius: '3px',
                  }}
                >
                  {statusStyle.text}
                </span>
              </div>

              {unloader.assignedBasketId ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Carrier:</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      {unloader.assignedBasketId}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Material:</span>
                    <span style={{ color: variant?.color || '#fff', fontWeight: 600 }}>
                      {variant?.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Destination:</span>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                      Pallet {unloader.targetPalletId}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: '4px', background: '#0e172a', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${unloader.progress}%`,
                        background: 'linear-gradient(90deg, #a855f7, #c084fc)',
                        transition: 'width 0.2s linear',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    <span>UNLOADING {unloader.progress}%</span>
                    <span>{unloader.conesRemaining} cones left</span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '8px 0', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Waiting for incoming basket...
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '0 12px 10px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        * Fully dynamic routing: Any unloader accepts any material upon track arrival
      </div>
    </div>
  );
}
