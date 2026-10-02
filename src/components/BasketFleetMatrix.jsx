import React, { useState } from 'react';
import { Grid, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { VARIANTS } from '../constants/simulationConstants';

export default function BasketFleetMatrix({ baskets, storyActiveTarget, onSelectBasket, isOpen, onToggle }) {
  const [filter, setFilter] = useState('ALL');

  const filteredBaskets = baskets.filter((b) => {
    if (filter === 'ALL') return true;
    return b.status === filter;
  });

  return (
    <div className="industrial-card basket-matrix-drawer">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Grid size={15} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>
            OHC BASKET FLEET DIGITAL TWIN (280 CARRIERS)
          </span>
          <span className="panel-badge" style={{ color: 'var(--accent-cyan)' }}>
            TOTAL: 280
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {isOpen ? 'Collapse Matrix' : 'Expand Matrix (280 Cells)'}
          </span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: '12px' }}>
          {/* Quick Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {['ALL', 'EMPTY', 'IN_TRANSIT', 'LOADING', 'UNLOADING', 'LOADED'].map((statusKey) => (
              <button
                key={statusKey}
                className={`speed-btn ${filter === statusKey ? 'active' : ''}`}
                onClick={() => setFilter(statusKey)}
                style={{ fontSize: '10px' }}
              >
                {statusKey} ({baskets.filter((b) => statusKey === 'ALL' || b.status === statusKey).length})
              </button>
            ))}
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
                  onClick={() => onSelectBasket({ type: 'basket', data: basket, variant })}
                  title={`${basket.id} | ${basket.status} | ${variant?.name || 'Empty'} | ${basket.coneQuantity} cones | ${basket.location}`}
                />
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', background: '#334155', borderRadius: '1px' }} /> EMPTY
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', background: 'var(--accent-amber)', borderRadius: '1px' }} /> LOADING
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', background: 'var(--accent-cyan)', borderRadius: '1px' }} /> IN TRANSIT
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', background: 'var(--accent-purple)', borderRadius: '1px' }} /> UNLOADING
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '1px' }} /> LOADED STORAGE
              </span>
            </div>
            <span style={{ color: 'var(--accent-cyan)' }}>Click any basket cell to inspect live telemetry</span>
          </div>
        </div>
      )}
    </div>
  );
}
