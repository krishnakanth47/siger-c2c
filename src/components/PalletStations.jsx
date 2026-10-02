import React from 'react';
import { Package, Check, Layers } from 'lucide-react';
import { VARIANTS } from '../constants/simulationConstants';

export default function PalletStations({ palletStations, onSelectEntity }) {
  return (
    <div className="industrial-card">
      <div className="panel-header">
        <div className="panel-title">
          <Package size={15} style={{ color: 'var(--accent-emerald)' }} />
          <span>PALLET STATIONS (8 DISCHARGE BAYS)</span>
        </div>
        <span className="panel-badge" style={{ color: 'var(--accent-emerald)' }}>
          8 BAYS
        </span>
      </div>

      <div className="pallets-grid">
        {palletStations.map((pallet) => {
          const variant = VARIANTS.find((v) => v.id === pallet.variantId);
          const percent = Math.min(100, Math.round((pallet.coneCount / pallet.capacity) * 100));

          return (
            <div
              key={pallet.id}
              className="pallet-card"
              onClick={() => onSelectEntity({ type: 'pallet', data: pallet, variant })}
              title={`Click to inspect Pallet Station ${pallet.id}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: '#ffffff' }}>
                  {pallet.id}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: variant?.color || '#94a3b8',
                  }}
                >
                  {variant?.code || 'GENERIC'}
                </span>
              </div>

              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {variant?.name || 'Available'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>{pallet.coneCount}</span>
                <span style={{ color: 'var(--text-muted)' }}>/ {pallet.capacity} cones</span>
              </div>

              <div className="pallet-cone-gauge">
                <div className="pallet-gauge-fill" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '0 12px 10px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        * Final staging area: All yarn cones deposit here. Zero return of cones to OHC.
      </div>
    </div>
  );
}
