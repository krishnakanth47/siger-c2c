import React, { useState } from 'react';
import { X, Grid, Info, Filter } from 'lucide-react';
import { VARIANTS } from '../constants/simulationConstants';

export default function BasketFleetModal({
  isOpen,
  onClose,
  baskets,
  storyActiveTarget,
  onSelectBasket,
}) {
  const [filter, setFilter] = useState('ALL');

  if (!isOpen) return null;

  const filteredBaskets = baskets.filter((b) => {
    if (filter === 'ALL') return true;
    return b.status === filter;
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window"
        style={{ width: 'min(720px, 95vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Grid size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: '#fff' }}>
              OHC BASKET FLEET DIGITAL TWIN (280 CARRIERS)
            </span>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['ALL', 'EMPTY', 'IN_TRANSIT', 'LOADING', 'UNLOADING', 'LOADED'].map((statusKey) => {
                const count = baskets.filter((b) => statusKey === 'ALL' || b.status === statusKey).length;
                return (
                  <button
                    key={statusKey}
                    className={`speed-btn ${filter === statusKey ? 'active' : ''}`}
                    onClick={() => setFilter(statusKey)}
                    style={{ fontSize: '9.5px', padding: '2px 7px' }}
                  >
                    {statusKey} ({count})
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: '9.5px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              Carrier B152: Story Leader
            </span>
          </div>

          {/* 280-Cell High-Performance Grid */}
          <div className="matrix-grid-280">
            {filteredBaskets.map((basket) => {
              const variant = VARIANTS.find((v) => v.id === basket.variantId);
              const isStory = storyActiveTarget === basket.id || basket.id === 'B152';

              return (
                <div
                  key={basket.id}
                  className={`matrix-cell status-${basket.status} ${isStory ? 'story-highlight' : ''}`}
                  onClick={() => {
                    onSelectBasket({ type: 'basket', data: basket, variant });
                    onClose();
                  }}
                  title={`${basket.id} | ${basket.status} | ${variant?.name || 'Empty'} | ${basket.coneQuantity} cones | ${basket.location}`}
                />
              );
            })}
          </div>

          {/* Legend row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', background: '#334155', borderRadius: '1px' }} /> EMPTY
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', background: 'var(--accent-amber)', borderRadius: '1px' }} /> LOADING
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', background: 'var(--accent-cyan)', borderRadius: '1px' }} /> IN TRANSIT
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', background: 'var(--accent-purple)', borderRadius: '1px' }} /> UNLOADING
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', background: '#3b82f6', borderRadius: '1px' }} /> STORED
              </span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>Click any carrier to inspect telemetry</span>
          </div>
        </div>
      </div>
    </div>
  );
}
