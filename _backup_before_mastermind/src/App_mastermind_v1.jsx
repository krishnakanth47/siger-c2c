import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import LeftHUD from './components/LeftHUD';
import PlantFloor from './components/PlantFloor';
import BottomControlDrawer from './components/BottomControlDrawer';
import BasketFleetModal from './components/BasketFleetModal';
import StoryOverlay from './components/StoryOverlay';
import DetailModal from './components/DetailModal';
import BrainButton from './components/BrainButton';
import BrainPanel from './components/BrainPanel';

import {
  INITIAL_MACHINES,
  INITIAL_LOADERS,
  INITIAL_UNLOADERS,
  INITIAL_PALLETS,
  generateInitialBaskets,
} from './constants/simulationConstants';
import { MasterMindEngine, runComparison } from './simulation/masterMindEngine';
import { STORY_STEPS } from './simulation/storySequence';

export default function App() {
  const buildInitialState = useCallback(() => {
    return {
      machines: INITIAL_MACHINES,
      loaders: INITIAL_LOADERS,
      unloaders: INITIAL_UNLOADERS,
      palletStations: INITIAL_PALLETS,
      baskets: generateInitialBaskets(),
      fifoQueue: [
        {
          queueId: 'Q-INIT-M03',
          machineId: 'M03',
          variantId: 'V1',
          cones: 32,
          timestamp: '10:30:00',
        },
      ],
      activeVariantIds: ['V1', 'V2', 'V3', 'V4'], // Exactly 4 active
      systemWarning: null,
      totalConesHandled: 928,
      totalCyclesCompleted: 29,
      stats: {
        machinesCount: 16,
        loadersCount: 16,
        basketsTotal: 280,
        activeVariantsRatio: '4/4',
        dynamicUnloadersCount: 4,
        palletStationsCount: 8,
        queueRatio: '1/4',
        emptyBaskets: 47,
        loadedBaskets: 220,
        inTransit: 4,
        unloading: 0,
        totalConesHandled: 928,
        totalCycles: 29,
      },
    };
  }, []);

  const [simState, setSimState] = useState(buildInitialState);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [simulatedTime, setSimulatedTime] = useState(0);
  const [events, setEvents] = useState([
    { id: 'E-INIT-1', time: '10:30:00', level: 'INFO', message: 'SIEGER OHC Digital Twin SCADA plant online.' },
    { id: 'E-INIT-2', time: '10:30:01', level: 'SUCCESS', message: '16 Ring Frames inline with 16 automated loaders synchronized.' },
    { id: 'E-INIT-3', time: '10:30:02', level: 'INFO', message: 'Closed-loop OHC overhead track energized (45 m/min).' },
    { id: 'E-INIT-4', time: '10:30:03', level: 'INFO', message: 'Machine M05 approaching doff completion (98/100).' },
  ]);

  // UI modal / drawer state
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isStoryMode, setIsStoryMode] = useState(false);
  const [storyStep, setStoryStep] = useState(1);
  const [showFleetModal, setShowFleetModal] = useState(false);

  // Master Mind state
  const [mode, setMode] = useState('BRAIN');
  const [brainOnline, setBrainOnline] = useState(true);
  const [showBrain, setShowBrain] = useState(false);

  // Engine ref
  const engineRef = useRef(null);

  useEffect(() => {
    const handleUpdate = (updatedState) => {
      setSimState({ ...updatedState });
      if (updatedState.simulatedTimeSeconds !== undefined) {
        setSimulatedTime(updatedState.simulatedTimeSeconds);
      }
    };

    const handleEvent = (event) => {
      setEvents((prev) => [event, ...prev.slice(0, 99)]);
    };

    const engine = new MasterMindEngine(buildInitialState(), handleUpdate, handleEvent, { mode: 'BRAIN' });
    engineRef.current = engine;
    handleUpdate({ ...engine.state, simulatedTimeSeconds: 0 });

    return () => {
      engine.pause();
    };
  }, [buildInitialState]);

  // Handlers
  const handleStart = () => {
    if (engineRef.current) {
      engineRef.current.start();
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pause();
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    if (engineRef.current) {
      const freshState = buildInitialState();
      engineRef.current.reset(freshState); // engine publishes the prepared state itself
      setIsRunning(false);
      setIsStoryMode(false);
      setStoryStep(1);
      setSimulatedTime(0);
    }
  };

  const handleSetSpeed = (newSpeed) => {
    setSpeed(newSpeed);
    if (engineRef.current) {
      engineRef.current.setSpeed(newSpeed);
    }
  };

  const handlePlayStory = () => {
    setIsStoryMode(true);
    setStoryStep(1);
    setIsRunning(false);
    if (engineRef.current) {
      engineRef.current.startStoryMode((step) => {
        setStoryStep(step);
      });
    }
  };

  const handleStoryStepChange = (newStep) => {
    setStoryStep(newStep);
    if (engineRef.current) {
      engineRef.current.runStoryStep(newStep, (step) => {
        setStoryStep(step);
      });
    }
  };

  const handleCloseStory = () => {
    setIsStoryMode(false);
    if (engineRef.current) {
      engineRef.current.stopStoryMode();
    }
  };

  const handleSwapVariant = (removeId, addId) => {
    if (engineRef.current) {
      engineRef.current.swapActiveVariant(removeId, addId);
    }
  };

  const handleTriggerManualDoff = (machineId) => {
    if (engineRef.current) {
      engineRef.current.triggerManualDoff(machineId);
    }
  };

  // Master Mind handlers
  const handleSetMode = (newMode) => {
    setMode(newMode);
    engineRef.current?.setMode(newMode);
  };
  const handleSetBrainOnline = (online) => {
    setBrainOnline(online);
    engineRef.current?.setBrainOnline(online);
  };
  const handleSetWeights = (w) => engineRef.current?.setWeights(w);
  const handleToggleUrgent = (machineId) => engineRef.current?.toggleUrgent(machineId);
  const handleRunComparison = (seconds) =>
    runComparison(buildInitialState(), seconds, engineRef.current?.brain.weights);

  const currentStoryTarget = isStoryMode ? STORY_STEPS[storyStep - 1]?.targetId : null;

  return (
    <div className="app-container">
      {/* 1. Industrial Top Header */}
      <Header
        simulatedTimeSeconds={simulatedTime}
        isRunning={isRunning}
        totalCycles={simState.totalCyclesCompleted}
        totalCones={simState.totalConesHandled}
      />

      {/* 2. Unified Spatial Workspace: Left HUD + Full Plant Floor */}
      <div className="spatial-workspace">
        {/* Compact Left HUD: KPIs, FIFO Queue (Max 4Q), 4 Active Variants, Legend */}
        <LeftHUD
          stats={simState.stats}
          fifoQueue={simState.fifoQueue}
          activeVariantIds={simState.activeVariantIds}
          onSwapVariant={handleSwapVariant}
          systemWarning={simState.systemWarning}
        />

        {/* Master Spatial Plant Floor: Continuous OHC Loop + Inline Machines & Loaders */}
        <PlantFloor
          machines={simState.machines}
          loaders={simState.loaders}
          baskets={simState.baskets}
          unloaders={simState.unloaders}
          palletStations={simState.palletStations}
          storyActiveTarget={currentStoryTarget}
          onSelectEntity={setSelectedEntity}
          onTriggerManualDoff={handleTriggerManualDoff}
        >
          {/* Master Mind brain: sits at the centre of the OHC loop — click it to see its decisions */}
          <BrainButton
            brain={simState.brain}
            mode={mode}
            brainOnline={brainOnline}
            simTime={simulatedTime}
            onOpen={() => setShowBrain(true)}
            onSetMode={handleSetMode}
          />
        </PlantFloor>
      </div>

      {/* 3. Bottom Control & Collapsible Live Event Terminal Drawer */}
      <BottomControlDrawer
        isRunning={isRunning}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
        onPlayStory={handlePlayStory}
        speed={speed}
        onSetSpeed={handleSetSpeed}
        systemWarning={simState.systemWarning}
        events={events}
        onClearEvents={() => setEvents([])}
        onOpenFleetModal={() => setShowFleetModal(true)}
      />

      {/* 4. 280-Basket Fleet Digital Twin Heatmap Modal */}
      <BasketFleetModal
        isOpen={showFleetModal}
        onClose={() => setShowFleetModal(false)}
        baskets={simState.baskets}
        storyActiveTarget={currentStoryTarget}
        onSelectBasket={setSelectedEntity}
      />

      {/* 5. Guided Story Overlay */}
      {isStoryMode && (
        <StoryOverlay
          currentStep={storyStep}
          onStepChange={handleStoryStepChange}
          onCloseStory={handleCloseStory}
        />
      )}

      {/* 6. Master Mind decision panel (opened from the brain at the centre of the plant floor) */}
      {simState.brain && (
        <BrainPanel
          isOpen={showBrain}
          onClose={() => setShowBrain(false)}
          state={simState}
          mode={mode}
          brainOnline={brainOnline}
          onSetWeights={handleSetWeights}
          onToggleUrgent={handleToggleUrgent}
          onSetBrainOnline={handleSetBrainOnline}
          onRunComparison={handleRunComparison}
        />
      )}

      {/* 7. Live Telemetry Detail Modal */}
      <DetailModal
        entity={selectedEntity}
        onClose={() => setSelectedEntity(null)}
        onManualDoff={handleTriggerManualDoff}
      />
    </div>
  );
}
