import React from 'react';
import { Box, CheckCircle2, Loader2, ArrowUpRight } from 'lucide-react';
import { VARIANTS } from '../constants/simulationConstants';

export default function LoadersSection({ loaders, storyActiveTarget, onSelectEntity }) {
  const getLoaderColor = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return { text: 'AVAILABLE', color: 'var(--accent-emerald)', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'ASSIGNED':
        return { text: 'ASSIGNED', color: 'var(--accent-cyan)', bg: 'rgba(0, 240, 255, 0.1)' };
      case 'LOADING':
        return { text: 'LOADING', color: 'var(--accent-amber)', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'COMPLETE':
        return { text: 'DISPATCHED', color: 'var(--accent-blue)', bg: 'rgba(59, 130, 246, 0.1)' };
      default:
        return { text: status, color: 'var(--text-muted)', bg: 'transparent' };
    }
  };

  return (
    <div className="industrial-card">
      <div className="panel-header">
        <div className="panel-title">
          <Box size={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>OHC LOADERS (16 AUTOMATED LOADING BAYS)</span>
        </div>
        <span className="panel-badge">16 LOADERS</span>
      </div>

      <div className="loaders-strip">
        {loaders.map((loader) => {
          const isStory = storyActiveTarget === loader.id;
          const statusStyle = getLoaderColor(loader.status);
          const variant = VARIANTS.find((v) => v.id === loader.variantId);
          const isLoading = loader.status === 'LOADING';

          return (
            <div
              key={loader.id}
              className={`loader-item ${isLoading ? 'loading-active' : ''} ${isStory ? 'story-active' : ''}`}
              onClick={() => onSelectEntity({ type: 'loader', data: loader, variant })}
              title={`Click to inspect Loader ${loader.id}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ffffff' }}>
                  {loader.id}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: statusStyle.color,
                    background: statusStyle.bg,
                    padding: '1px 4px',
                    borderRadius: '2px',
                  }}
                >
                  {statusStyle.text}
                </span>
              </div>

              {loader.assignedMachineId ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Src: {loader.assignedMachineId}</span>
                    <span style={{ color: 'var(--accent-cyan)' }}>{loader.assignedBasketId}</span>
                  </div>

                  {/* Loading progress bar */}
                  <div style={{ height: '3px', background: '#0e172a', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${loader.progress}%`,
                        background: 'linear-gradient(90deg, #f59e0b, #eab308)',
                        transition: 'width 0.2s linear',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--text-muted)' }}>
                    <span>{loader.conesLoaded} / 32 cones</span>
                    <span>{loader.progress}%</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0' }}>
                  Ready for doff
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
