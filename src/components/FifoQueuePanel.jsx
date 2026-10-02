import React from 'react';
import { Layers, AlertCircle, ArrowDown, Check } from 'lucide-react';
import { VARIANTS, MAX_FIFO_QUEUE_SIZE } from '../constants/simulationConstants';

export default function FifoQueuePanel({ fifoQueue, isStoryActive }) {
  const isQueueFull = fifoQueue.length >= MAX_FIFO_QUEUE_SIZE;

  // Render exactly 4 slots (1 to 4)
  const slots = [0, 1, 2, 3];

  return (
    <div className={`industrial-card ${isStoryActive ? 'corner-brackets' : ''}`}>
      <div className="panel-header">
        <div className="panel-title">
          <Layers size={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>FIFO LOADING QUEUE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            className="panel-badge"
            style={{
              borderColor: isQueueFull ? 'var(--accent-amber)' : 'var(--border-dim)',
              color: isQueueFull ? 'var(--accent-amber)' : 'var(--accent-cyan)',
            }}
          >
            {fifoQueue.length} / {MAX_FIFO_QUEUE_SIZE} SLOTS
          </span>
        </div>
      </div>

      <div className="fifo-queue-box">
        {isQueueFull && (
          <div
            style={{
              padding: '4px 8px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid var(--accent-amber)',
              borderRadius: '3px',
              color: 'var(--accent-amber)',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              textAlign: 'center',
            }}
          >
            QUEUE FULL — WAITING FOR LOADER
          </div>
        )}

        {slots.map((index) => {
          const item = fifoQueue[index];
          const variant = item ? VARIANTS.find((v) => v.id === item.variantId) : null;
          const isHead = index === 0 && item;

          return (
            <div
              key={`fifo-slot-${index}`}
              className={`fifo-slot ${item ? 'filled' : ''} ${isHead ? 'head-position' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="fifo-slot-pos">#{index + 1}</span>

                {item ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ffffff' }}>
                        {item.machineId}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: variant?.color || '#fff',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {variant?.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Registered: {item.timestamp} • 32 Cones
                    </span>
                  </div>
                ) : (
                  <span className="fifo-empty-placeholder">Slot Available (Empty)</span>
                )}
              </div>

              {isHead && (
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    background: 'rgba(0, 240, 255, 0.15)',
                    border: '1px solid var(--accent-cyan)',
                    color: 'var(--accent-cyan)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                  }}
                >
                  NEXT IN LINE
                </span>
              )}
            </div>
          );
        })}

        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', marginTop: '4px' }}>
          * Strictly First-In First-Out: #1 is dispatched as soon as loader & empty basket match
        </div>
      </div>
    </div>
  );
}
