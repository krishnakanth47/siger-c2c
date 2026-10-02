import React from 'react';
import { HelpCircle } from 'lucide-react';

export default function Legend() {
  return (
    <div className="legend-strip">
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--text-primary)' }}>
        <HelpCircle size={13} style={{ color: 'var(--accent-cyan)' }} />
        <span>SYSTEM LEGEND:</span>
      </div>

      <div className="legend-item">
        <span className="led-indicator led-running" />
        <span>Running / Producing</span>
      </div>

      <div className="legend-item">
        <span className="led-indicator led-available" />
        <span>Available / Idle</span>
      </div>

      <div className="legend-item">
        <span className="led-indicator led-loading" />
        <span>Loading Cones</span>
      </div>

      <div className="legend-item">
        <span className="led-indicator led-transit" />
        <span>In Transit (Overhead Rail)</span>
      </div>

      <div className="legend-item">
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-purple)', boxShadow: '0 0 6px var(--accent-purple)' }} />
        <span>Unloading at Dock</span>
      </div>

      <div className="legend-item">
        <span className="led-indicator led-empty" />
        <span>Empty Basket (Reusable)</span>
      </div>

      <div className="legend-item">
        <span className="led-indicator led-error" />
        <span>Warning / Active Limit Hold</span>
      </div>

      <div style={{ marginLeft: 'auto', color: 'var(--accent-cyan)', fontStyle: 'italic' }}>
        * FIFO = First In, First Out (Earlier machine doff requests are dispatched first)
      </div>
    </div>
  );
}
