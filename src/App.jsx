import React, { useState } from 'react';
import SetupPage from './dynamic/SetupPage';
import PlcPage from './dynamic/PlcPage';
import DynamicSim from './dynamic/DynamicSim';
import ClassicApp from './ClassicApp';
import { DEFAULT_CONFIG, normaliseConfig } from './dynamic/config';

const STORE_KEY = 'sieger-ohc-config-v1';

function loadConfig() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) return normaliseConfig(JSON.parse(raw));
  } catch {
    /* storage unavailable — use the customer defaults */
  }
  return normaliseConfig(DEFAULT_CONFIG);
}

function saveConfig(cfg) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

// Setup page → dynamic simulation built from those values. The earlier fixed demo stays available.
export default function App() {
  const [view, setView] = useState('setup');
  const [config, setConfig] = useState(loadConfig);
  const [draft, setDraft] = useState(config); // setup being edited (shared by the setup tabs)

  const start = (cfg) => {
    const c = normaliseConfig(cfg);
    setConfig(c);
    setDraft(c);
    saveConfig(c);
    setView('sim');
  };

  if (view === 'sim') return <DynamicSim config={config} onEditSetup={() => setView('setup')} />;
  if (view === 'classic') return <ClassicApp onExit={() => setView('setup')} />;
  const onTab = (t) => setView(t === 'plc' ? 'plc' : 'setup');
  if (view === 'plc') return <PlcPage config={draft} onTab={onTab} onClassic={() => setView('classic')} />;
  return <SetupPage initial={draft} onStart={start} onClassic={() => setView('classic')} onDraft={setDraft} onTab={onTab} />;
}
