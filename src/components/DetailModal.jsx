import React from 'react';
import { X, Activity, Info, Cpu, Zap, Box, Truck, CornerDownRight, Package } from 'lucide-react';

export default function DetailModal({ entity, onClose, onManualDoff }) {
  if (!entity) return null;

  const { type, data, variant } = entity;

  const getIcon = () => {
    switch (type) {
      case 'machine':
        return <Zap size={18} style={{ color: 'var(--accent-cyan)' }} />;
      case 'loader':
        return <Box size={18} style={{ color: 'var(--accent-amber)' }} />;
      case 'basket':
        return <Truck size={18} style={{ color: 'var(--accent-cyan)' }} />;
      case 'unloader':
        return <CornerDownRight size={18} style={{ color: 'var(--accent-purple)' }} />;
      case 'pallet':
        return <Package size={18} style={{ color: 'var(--accent-emerald)' }} />;
      default:
        return <Info size={18} />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'machine':
        return `MACHINE ${data.id} • ${data.name}`;
      case 'loader':
        return `LOADER ${data.id} • AUTOMATED LOADING BAY`;
      case 'basket':
        return `OHC BASKET ${data.id} • CARRIER UNIT`;
      case 'unloader':
        return `DYNAMIC UNLOADER ${data.id}`;
      case 'pallet':
        return `PALLET STATION ${data.id} • DISCHARGE BAY`;
      default:
        return 'EQUIPMENT TELEMETRY';
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window corner-brackets" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getIcon()}
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: '#ffffff' }}>
              {getTitle()}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* MACHINE DETAILS */}
          {type === 'machine' && (
            <>
              <div className="telemetry-row">
                <span className="telemetry-label">Status</span>
                <span className="telemetry-val" style={{ color: 'var(--accent-emerald)' }}>
                  {data.status}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Yarn Material / Variant</span>
                <span className="telemetry-val" style={{ color: variant?.color || '#fff' }}>
                  {variant?.name} ({variant?.code})
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Doff Counter</span>
                <span className="telemetry-val">
                  {Math.round(data.doffCount)} / {data.targetDoff} ({Math.round((data.doffCount / data.targetDoff) * 100)}%)
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Production Spindle Speed</span>
                <span className="telemetry-val">{data.speed * 18000} RPM</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Assigned Loader Channel</span>
                <span className="telemetry-val">L{data.id.replace('M', '')}</span>
              </div>

              <div style={{ marginTop: '10px' }}>
                <button
                  className="btn-industrial btn-primary-action"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    if (onManualDoff) onManualDoff(data.id);
                    onClose();
                  }}
                >
                  TRIGGER MANUAL DOFF FOR {data.id}
                </button>
              </div>
            </>
          )}

          {/* LOADER DETAILS */}
          {type === 'loader' && (
            <>
              <div className="telemetry-row">
                <span className="telemetry-label">Loader Status</span>
                <span className="telemetry-val" style={{ color: 'var(--accent-amber)' }}>
                  {data.status}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Assigned Source Machine</span>
                <span className="telemetry-val">{data.assignedMachineId || 'None (Idle)'}</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Docked Basket Carrier</span>
                <span className="telemetry-val" style={{ color: 'var(--accent-cyan)' }}>
                  {data.assignedBasketId || 'Waiting for Empty Carrier'}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Material Variant</span>
                <span className="telemetry-val" style={{ color: variant?.color || '#fff' }}>
                  {variant ? `${variant.name} (${variant.code})` : 'N/A'}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Loading Transfer Progress</span>
                <span className="telemetry-val">{data.progress}%</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Cones Infeed Count</span>
                <span className="telemetry-val">{data.conesLoaded} / 32 Cones</span>
              </div>
            </>
          )}

          {/* BASKET DETAILS */}
          {type === 'basket' && (
            <>
              <div className="telemetry-row">
                <span className="telemetry-label">Basket Fleet ID</span>
                <span className="telemetry-val" style={{ color: 'var(--accent-cyan)' }}>
                  {data.id} {data.id === 'B152' ? '(STORY LEADER)' : ''}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Current Operational Status</span>
                <span className="telemetry-val" style={{ color: data.status === 'EMPTY' ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>
                  {data.status}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Material Variant</span>
                <span className="telemetry-val" style={{ color: variant?.color || '#fff' }}>
                  {variant ? `${variant.name} (${variant.code})` : 'EMPTY (Ready for reuse)'}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Cone Quantity</span>
                <span className="telemetry-val">{data.coneQuantity} / 32 Cones</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Current Spatial Location</span>
                <span className="telemetry-val">{data.location}</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Conveyor Track Position</span>
                <span className="telemetry-val">{Math.round((data.progressOnTrack || 0) * 100)}%</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Assigned Loader</span>
                <span className="telemetry-val">{data.assignedLoader || 'None'}</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Assigned Unloader</span>
                <span className="telemetry-val">{data.assignedUnloader || 'None'}</span>
              </div>
            </>
          )}

          {/* UNLOADER DETAILS */}
          {type === 'unloader' && (
            <>
              <div className="telemetry-row">
                <span className="telemetry-label">Station Status</span>
                <span className="telemetry-val" style={{ color: 'var(--accent-purple)' }}>
                  {data.status}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Assigned Basket ID</span>
                <span className="telemetry-val" style={{ color: 'var(--accent-cyan)' }}>
                  {data.assignedBasketId || 'None (Awaiting Carrier)'}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Discharge Material</span>
                <span className="telemetry-val" style={{ color: variant?.color || '#fff' }}>
                  {variant ? `${variant.name} (${variant.code})` : 'N/A'}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Target Pallet Destination</span>
                <span className="telemetry-val" style={{ color: 'var(--accent-emerald)' }}>
                  {data.targetPalletId || 'Auto-Allocated'}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Unloading Progress</span>
                <span className="telemetry-val">{data.progress}%</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Cones Remaining in Basket</span>
                <span className="telemetry-val">{data.conesRemaining} Cones</span>
              </div>
            </>
          )}

          {/* PALLET DETAILS */}
          {type === 'pallet' && (
            <>
              <div className="telemetry-row">
                <span className="telemetry-label">Bay Status</span>
                <span className="telemetry-val" style={{ color: 'var(--accent-emerald)' }}>
                  {data.status}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Assigned Material</span>
                <span className="telemetry-val" style={{ color: variant?.color || '#fff' }}>
                  {variant ? `${variant.name} (${variant.code})` : 'Universal'}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Accumulated Cones</span>
                <span className="telemetry-val">
                  {data.coneCount} / {data.capacity} Cones ({Math.round((data.coneCount / data.capacity) * 100)}%)
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Pallet Bay Stacking Standard</span>
                <span className="telemetry-val">Euro-Pallet 1200×800mm (5-Tier Layer)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
