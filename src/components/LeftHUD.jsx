import React, { useState } from 'react';
import { Layers, Activity, ArrowLeftRight, HelpCircle, AlertTriangle, ShieldCheck, Box, Truck } from 'lucide-react';
import { VARIANTS, MAX_FIFO_QUEUE_SIZE, MAX_ACTIVE_VARIANTS } from '../constants/simulationConstants';

export default function LeftHUD({
  stats,
  fifoQueue,
  activeVariantIds,
  onSwapVariant,
  systemWarning,
}) {
  const [selectedActive, setSelectedActive] = useState(null);
  const [selectedWaiting, setSelectedWaiting] = useState(null);

  const activeVariants = VARIANTS.filter((v) => activeVariantIds.includes(v.id));
  const waitingVariants = VARIANTS.filter((v) => !activeVariantIds.includes(v.id));
  const isQueueFull = fifoQueue.length >= MAX_FIFO_QUEUE_SIZE;

  const handleExecuteSwap = () => {
    if (selectedActive && selectedWaiting) {
      onSwapVariant(selectedActive, selectedWaiting);
      setSelectedActive(null);
      setSelectedWaiting(null);
    }
  };

  return (
    <aside className="left-hud-panel">
      {/* 1. System Telemetry KPIs */}
      <div className="hud-section">
        <div className="hud-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={12} style={{ color: 'var(--accent-cyan)' }} />
            PLANT TELEMETRY
          </span>
          <span style={{ fontSize: '9px', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
            LIVE SCADA
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '2px' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '4px 6px', borderRadius: '3px', border: '1px solid var(--border-dim)' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>LOADED ON LOOP</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              {stats?.inTransit || 0} <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>baskets</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '4px 6px', borderRadius: '3px', border: '1px solid var(--border-dim)' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>EMPTY ON LOOP</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
              {stats?.emptyBaskets || 0} <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>of {stats?.basketsTotal || 280}</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '4px 6px', borderRadius: '3px', border: '1px solid var(--border-dim)' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>TOTAL CONES</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {stats?.totalConesHandled || 0}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '4px 6px', borderRadius: '3px', border: '1px solid var(--border-dim)' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>UNLOADERS</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
              {stats?.unloading || 0} / 4 <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>bays</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FIFO Loading Queue (Max 4Q) */}
      <div className="hud-section">
        <div className="hud-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Layers size={12} style={{ color: 'var(--accent-amber)' }} />
            FIFO QUEUE
          </span>
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: isQueueFull ? 'var(--accent-amber)' : 'var(--accent-cyan)',
            }}
          >
            {fifoQueue.length} / {MAX_FIFO_QUEUE_SIZE} SLOTS
          </span>
        </div>

        {isQueueFull && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid var(--accent-amber)',
              borderRadius: '2px',
              padding: '2px 4px',
              color: 'var(--accent-amber)',
              fontSize: '9px',
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            QUEUE FULL — WAITING FOR EMPTY BASKET
          </div>
        )}

        {/* 4 FIFO Slots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[0, 1, 2, 3].map((idx) => {
            const item = fifoQueue[idx];
            const variant = item ? VARIANTS.find((v) => v.id === item.variantId) : null;
            const isHead = idx === 0 && item;

            return (
              <div
                key={`fifo-hud-${idx}`}
                className={`hud-fifo-slot ${item ? 'filled' : ''} ${isHead ? 'head-slot' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: isHead ? 'var(--accent-cyan)' : 'var(--text-muted)', fontSize: '10px' }}>
                    #{idx + 1}
                  </span>
                  {item ? (
                    <div>
                      <span style={{ fontWeight: 700, color: '#fff' }}>{item.machineId}</span>
                      <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: variant?.color || '#fff', fontSize: '9.5px', fontWeight: 600 }}>
                        {variant?.code}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '9.5px' }}>
                      Slot Open
                    </span>
                  )}
                </div>

                {isHead && (
                  <span
                    style={{
                      fontSize: '8px',
                      background: 'rgba(0, 240, 255, 0.15)',
                      border: '1px solid var(--accent-cyan)',
                      color: 'var(--accent-cyan)',
                      padding: '1px 4px',
                      borderRadius: '2px',
                      fontWeight: 700,
                    }}
                  >
                    NEXT
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 4 Active Variants Manager */}
      <div className="hud-section">
        <div className="hud-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Layers size={12} style={{ color: 'var(--accent-cyan)' }} />
            ACTIVE VARIANTS (MAX 4)
          </span>
          <span style={{ fontSize: '9px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
            {activeVariants.length} / {MAX_ACTIVE_VARIANTS}
          </span>
        </div>

        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Active for Loading:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
          {activeVariants.map((v) => {
            const isSel = selectedActive === v.id;
            return (
              <div
                key={v.id}
                onClick={() => setSelectedActive(isSel ? null : v.id)}
                style={{
                  padding: '3px 5px',
                  background: isSel ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-surface)',
                  border: `1px solid ${isSel ? 'var(--accent-cyan)' : 'var(--border-dim)'}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '9.5px',
                }}
                title="Click to select for swap"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: v.color }} />
                  <span style={{ color: '#fff', fontWeight: 600 }}>{v.code}</span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '8px' }}>Active</span>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>Waiting Pool:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
          {waitingVariants.map((v) => {
            const isSel = selectedWaiting === v.id;
            return (
              <div
                key={v.id}
                onClick={() => setSelectedWaiting(isSel ? null : v.id)}
                style={{
                  padding: '3px 5px',
                  background: isSel ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-surface)',
                  border: `1px solid ${isSel ? 'var(--accent-purple)' : 'var(--border-dim)'}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '9.5px',
                  opacity: 0.75,
                }}
                title="Click to promote"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', border: `1px solid ${v.color}` }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{v.code}</span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '8px' }}>Wait</span>
              </div>
            );
          })}
        </div>

        {selectedActive && selectedWaiting && (
          <button
            className="btn-industrial btn-primary-action"
            onClick={handleExecuteSwap}
            style={{ fontSize: '10px', padding: '3px 6px', justifyContent: 'center', marginTop: '2px' }}
          >
            <ArrowLeftRight size={11} />
            SWAP ({VARIANTS.find((v) => v.id === selectedActive)?.code} ↔ {VARIANTS.find((v) => v.id === selectedWaiting)?.code})
          </button>
        )}
      </div>

      {/* 4. Compact Legend */}
      <div className="hud-section" style={{ marginTop: 'auto' }}>
        <div className="hud-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HelpCircle size={11} style={{ color: 'var(--accent-cyan)' }} />
            STATUS CODES
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', fontSize: '9px', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="led-indicator led-running" /> Running
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="led-indicator led-loading" /> Loading
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="led-indicator led-transit" /> In Transit
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-purple)' }} /> Unloading
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="led-indicator led-empty" /> Empty Pool
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="led-indicator led-error" /> Wait Variant
          </div>
        </div>
      </div>
    </aside>
  );
}
