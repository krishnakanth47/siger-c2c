import React from 'react';
import { Settings2, Cable } from 'lucide-react';

export default function SetupTabs({ tab, onTab }) {
  return (
    <nav className="setup-tabs">
      <button className={tab === 'setup' ? 'on' : ''} onClick={() => onTab('setup')}><Settings2 size={14} /> 1 · Plant setup</button>
      <button className={tab === 'plc' ? 'on' : ''} onClick={() => onTab('plc')}><Cable size={14} /> 2 · PLC data source</button>
    </nav>
  );
}
