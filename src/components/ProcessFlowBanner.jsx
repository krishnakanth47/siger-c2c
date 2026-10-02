import React from 'react';
import { ArrowRight, Box, RefreshCw, Truck, Factory, Layers, CornerDownRight } from 'lucide-react';

export default function ProcessFlowBanner() {
  const steps = [
    { title: 'PRODUCTION', sub: '16 Ring Frames', icon: Factory },
    { title: 'FIFO QUEUE', sub: 'Max 4Q Priority', icon: Layers },
    { title: 'LOADING', sub: '16 Loaders + Empty Basket', icon: Box },
    { title: 'OHC TRANSPORTATION', sub: 'Overhead Rail (280 Baskets)', icon: Truck },
    { title: 'DYNAMIC UNLOADING', sub: '4 Dynamic Unloaders', icon: CornerDownRight },
    { title: 'BASKET REUSE', sub: 'Pallets & Empty Loop', icon: RefreshCw },
  ];

  return (
    <div className="process-flow-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
          MATERIAL FLOW:
        </span>
      </div>

      {steps.map((step, idx) => {
        const Icon = step.icon;
        return (
          <React.Fragment key={step.title}>
            <div className="flow-step-item active">
              <Icon size={13} style={{ color: 'var(--accent-cyan)' }} />
              <div>
                <div>{step.title}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 400 }}>{step.sub}</div>
              </div>
            </div>
            {idx < steps.length - 1 && <span className="flow-arrow">→</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}
