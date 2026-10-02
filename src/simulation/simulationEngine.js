// SIEGER OHC Material-Handling Simulation Engine
import {
  VARIANTS,
  MAX_ACTIVE_VARIANTS,
  MAX_FIFO_QUEUE_SIZE,
  CONES_PER_BASKET,
} from '../constants/simulationConstants';

export class SimulationEngine {
  constructor(initialState, onUpdate, onEvent) {
    this.state = JSON.parse(JSON.stringify(initialState));
    this.onUpdate = onUpdate;
    this.onEvent = onEvent;
    this.isRunning = false;
    this.speed = 1.0;
    this.timerId = null;
    this.tickCount = 0;
    this.simulatedTimeSeconds = 0;

    // Story mode state
    this.isStoryMode = false;
    this.storyStep = 0;
    this.storyTimer = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNextTick();
    this.logEvent('INFO', 'Simulation started. System operating normally.');
  }

  pause() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.logEvent('WARNING', 'Simulation paused by operator.');
  }

  setSpeed(newSpeed) {
    this.speed = newSpeed;
    this.logEvent('INFO', `Simulation speed set to ${newSpeed}x`);
  }

  scheduleNextTick() {
    if (!this.isRunning) return;
    // Base tick is 180ms divided by speed multiplier
    const delay = Math.max(25, Math.round(180 / this.speed));
    this.timerId = setTimeout(() => {
      this.tick();
      this.scheduleNextTick();
    }, delay);
  }

  logEvent(level, message, metadata = null) {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const event = {
      id: 'EVT-' + Math.random().toString(36).substr(2, 9),
      time,
      level, // INFO, SUCCESS, WARNING, ERROR
      message,
      metadata,
    };
    if (this.onEvent) {
      this.onEvent(event);
    }
  }

  tick() {
    this.tickCount++;
    this.simulatedTimeSeconds += Math.round(1 * this.speed);

    // 1. Process 16 Production Machines
    this.processMachines();

    // 2. Process FIFO Queue & Loader Assignment with Empty Basket Check
    this.processFifoAndLoaders();

    // 3. Process Active Loaders Filling Baskets
    this.processLoadersProgress();

    // 4. Process OHC Overhead Conveyor Movement
    this.processConveyorMovement();

    // 5. Process Dynamic Unloaders & Pallet Fill
    this.processUnloaders();

    // 6. Return Baskets to Empty Pool
    this.processReturnPool();

    // 7. Recompute Stats
    this.updateStats();

    // Notify React state
    if (this.onUpdate) {
      this.onUpdate({ ...this.state, simulatedTimeSeconds: this.simulatedTimeSeconds });
    }
  }

  processMachines() {
    const { machines, fifoQueue, activeVariantIds } = this.state;

    machines.forEach((machine) => {
      if (machine.status === 'RUNNING') {
        machine.doffCount = Math.min(machine.targetDoff, machine.doffCount + machine.speed * 0.85);

        if (machine.doffCount >= machine.targetDoff) {
          machine.status = 'DOFF_COMPLETE';

          // Check if variant is actively allowed for loading
          const isVariantActive = activeVariantIds.includes(machine.variantId);
          const variant = VARIANTS.find((v) => v.id === machine.variantId);

          if (!isVariantActive) {
            machine.status = 'WAITING_VARIANT';
            this.logEvent(
              'WARNING',
              `Machine ${machine.id} (${variant?.name}) DOFF COMPLETE — WAITING: ACTIVE VARIANT LIMIT`
            );
          } else {
            // Variant is active, try to enter FIFO queue
            if (fifoQueue.length < MAX_FIFO_QUEUE_SIZE) {
              fifoQueue.push({
                queueId: `Q-${Date.now().toString(36)}-${machine.id}`,
                machineId: machine.id,
                variantId: machine.variantId,
                cones: CONES_PER_BASKET,
                timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
              });
              machine.status = 'QUEUED';
              this.logEvent('SUCCESS', `DOFF COMPLETE — ${machine.id} (${variant?.name}) ADDED TO QUEUE`);
            } else {
              machine.status = 'WAITING_QUEUE';
              this.logEvent('WARNING', `QUEUE FULL (4/4) — ${machine.id} WAITING FOR FIFO SLOT`);
            }
          }
        }
      } else if (machine.status === 'WAITING_QUEUE') {
        // Try to enter FIFO if slot opened
        if (fifoQueue.length < MAX_FIFO_QUEUE_SIZE && activeVariantIds.includes(machine.variantId)) {
          const variant = VARIANTS.find((v) => v.id === machine.variantId);
          fifoQueue.push({
            queueId: `Q-${Date.now().toString(36)}-${machine.id}`,
            machineId: machine.id,
            variantId: machine.variantId,
            cones: CONES_PER_BASKET,
            timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
          });
          machine.status = 'QUEUED';
          this.logEvent('SUCCESS', `Queue slot opened: ${machine.id} (${variant?.name}) ADDED TO QUEUE`);
        }
      } else if (machine.status === 'WAITING_VARIANT') {
        // Check if variant became active
        if (activeVariantIds.includes(machine.variantId)) {
          if (fifoQueue.length < MAX_FIFO_QUEUE_SIZE) {
            fifoQueue.push({
              queueId: `Q-${Date.now().toString(36)}-${machine.id}`,
              machineId: machine.id,
              variantId: machine.variantId,
              cones: CONES_PER_BASKET,
              timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
            });
            machine.status = 'QUEUED';
            this.logEvent('INFO', `Variant now active: ${machine.id} moved from variant hold to FIFO queue`);
          } else {
            machine.status = 'WAITING_QUEUE';
          }
        }
      }
    });
  }

  processFifoAndLoaders() {
    const { fifoQueue, loaders, baskets, activeVariantIds, machines } = this.state;
    if (fifoQueue.length === 0) return;

    // Look at FIFO Head item (position 0)
    const headRequest = fifoQueue[0];

    // Check if variant is still in active variants
    if (!activeVariantIds.includes(headRequest.variantId)) {
      this.state.systemWarning = 'WAITING — ACTIVE VARIANT LIMIT';
      return;
    }

    // Step A: Check for Empty Basket
    // Look for empty basket (prioritize B152 if requested for M05 in demo, else first empty)
    let emptyBasket = null;
    if (headRequest.machineId === 'M05') {
      emptyBasket = baskets.find((b) => b.id === 'B152' && b.status === 'EMPTY' && !b.assignedLoader);
    }
    if (!emptyBasket) {
      emptyBasket = baskets.find((b) => b.status === 'EMPTY' && !b.assignedLoader);
    }

    if (!emptyBasket) {
      this.state.systemWarning = 'WAITING FOR EMPTY BASKET';
      if (this.tickCount % 20 === 0) {
        this.logEvent('WARNING', `FIFO stalled: WAITING FOR EMPTY BASKET for request ${headRequest.machineId}`);
      }
      return;
    } else {
      if (this.state.systemWarning === 'WAITING FOR EMPTY BASKET') {
        this.state.systemWarning = null;
      }
    }

    // Step B: Check for Available Loader
    // Try to match corresponding loader number or find any available loader
    const machineIndex = parseInt(headRequest.machineId.replace('M', ''), 10) - 1;
    let availableLoader = loaders[machineIndex]?.status === 'AVAILABLE' ? loaders[machineIndex] : null;
    if (!availableLoader) {
      availableLoader = loaders.find((l) => l.status === 'AVAILABLE');
    }

    if (!availableLoader) {
      // Loaders are currently busy, wait next tick
      return;
    }

    // All conditions verified! Pop the request from FIFO
    const request = fifoQueue.shift();
    const variant = VARIANTS.find((v) => v.id === request.variantId);

    // Assign Loader
    availableLoader.status = 'LOADING';
    availableLoader.assignedMachineId = request.machineId;
    availableLoader.assignedBasketId = emptyBasket.id;
    availableLoader.variantId = request.variantId;
    availableLoader.progress = 0;
    availableLoader.conesLoaded = 0;

    // Assign Basket
    emptyBasket.status = 'LOADING';
    emptyBasket.variantId = request.variantId;
    emptyBasket.assignedLoader = availableLoader.id;
    emptyBasket.coneQuantity = 0;
    emptyBasket.location = `Loader Bay ${availableLoader.id}`;
    emptyBasket.progressOnTrack = 0.02;

    // Reset machine to produce next doff
    const machine = machines.find((m) => m.id === request.machineId);
    if (machine) {
      machine.doffCount = 0;
      machine.status = 'RUNNING';
    }

    this.logEvent(
      'INFO',
      `FIFO dispatch: ${availableLoader.id} assigned to ${request.machineId} with empty basket ${emptyBasket.id}`
    );
  }

  processLoadersProgress() {
    const { loaders, baskets } = this.state;

    loaders.forEach((loader) => {
      if (loader.status === 'LOADING') {
        loader.progress += 12; // loading speed
        loader.conesLoaded = Math.min(
          CONES_PER_BASKET,
          Math.floor((loader.progress / 100) * CONES_PER_BASKET)
        );

        // Update basket cone count in real time
        const basket = baskets.find((b) => b.id === loader.assignedBasketId);
        if (basket) {
          basket.coneQuantity = loader.conesLoaded;
        }

        if (loader.progress >= 100) {
          loader.status = 'COMPLETE';
          loader.conesLoaded = CONES_PER_BASKET;

          if (basket) {
            basket.status = 'LOADED';
            basket.coneQuantity = CONES_PER_BASKET;
            basket.location = 'OHC Segment 1 (Entry Ramp)';
            basket.progressOnTrack = 0.06;
            basket.status = 'IN_TRANSIT'; // Sent to OHC conveyor!
          }

          const variant = VARIANTS.find((v) => v.id === loader.variantId);
          this.logEvent(
            'SUCCESS',
            `Loader ${loader.id} finished loading ${basket ? basket.id : ''} (${variant?.name}). Basket entering OHC conveyor.`
          );

          // Reset loader to AVAILABLE on next tick cycle
          setTimeout(() => {
            loader.status = 'AVAILABLE';
            loader.assignedMachineId = null;
            loader.assignedBasketId = null;
            loader.variantId = null;
            loader.progress = 0;
            loader.conesLoaded = 0;
          }, 400);
        }
      }
    });
  }

  processConveyorMovement() {
    const { baskets, unloaders } = this.state;

    // Move all baskets in transit along the OHC track
    baskets.forEach((basket) => {
      if (basket.status === 'IN_TRANSIT') {
        // Increment progress on track
        basket.progressOnTrack = (basket.progressOnTrack || 0) + 0.008 * this.speed;

        // Label location segment based on progress
        if (basket.progressOnTrack < 0.2) {
          basket.location = 'OHC Seg 1 (Ramp Incline)';
        } else if (basket.progressOnTrack < 0.45) {
          basket.location = 'OHC Seg 2 (Overhead High Rail)';
        } else if (basket.progressOnTrack < 0.65) {
          basket.location = 'OHC Seg 3 (East Overhead Traverse)';
        } else if (basket.progressOnTrack < 0.72) {
          basket.location = 'OHC Seg 4 (Unloader Approach)';
        }

        // Check unloader approach zone (0.68 to 0.75)
        if (basket.progressOnTrack >= 0.70 && basket.progressOnTrack < 0.78 && !basket.assignedUnloader) {
          // Dynamic unloader assignment!
          const availableUnloader = unloaders.find((u) => u.status === 'AVAILABLE');

          if (availableUnloader) {
            // Assign dynamic unloader
            availableUnloader.status = 'UNLOADING';
            availableUnloader.assignedBasketId = basket.id;
            availableUnloader.variantId = basket.variantId;
            availableUnloader.progress = 0;
            availableUnloader.conesRemaining = basket.coneQuantity || CONES_PER_BASKET;

            // Pick pallet station for this variant
            availableUnloader.targetPalletId = this.findTargetPallet(basket.variantId);

            basket.status = 'UNLOADING';
            basket.assignedUnloader = availableUnloader.id;
            basket.location = `Unloader Bay ${availableUnloader.id}`;

            const variant = VARIANTS.find((v) => v.id === basket.variantId);
            this.logEvent(
              'INFO',
              `Dynamic Unloader ${availableUnloader.id} assigned to ${basket.id} (${variant?.name})`
            );
          } else {
            // Buffer temporarily at approach zone
            basket.progressOnTrack = 0.70;
            basket.location = 'OHC Buffer (Waiting Unloader)';
          }
        }

        // If looped past return track without unloading (e.g. empty returning)
        if (basket.progressOnTrack >= 1.0) {
          basket.progressOnTrack = 0;
          if (basket.status === 'IN_TRANSIT' && basket.coneQuantity === 0) {
            basket.status = 'EMPTY';
            basket.location = 'EMPTY_BUFFER';
          }
        }
      }
    });
  }

  findTargetPallet(variantId) {
    const { palletStations } = this.state;
    // Prefer pallet matching this variant with remaining capacity
    let match = palletStations.find(
      (p) => p.variantId === variantId && p.coneCount < p.capacity
    );
    if (!match) {
      match = palletStations.find((p) => p.coneCount < p.capacity);
    }
    return match ? match.id : palletStations[0].id;
  }

  processUnloaders() {
    const { unloaders, baskets, palletStations } = this.state;

    unloaders.forEach((unloader) => {
      if (unloader.status === 'UNLOADING') {
        unloader.progress += 14; // unloading speed
        const basket = baskets.find((b) => b.id === unloader.assignedBasketId);

        if (basket) {
          unloader.conesRemaining = Math.max(
            0,
            Math.round(CONES_PER_BASKET * (1 - unloader.progress / 100))
          );
          basket.coneQuantity = unloader.conesRemaining;
        }

        if (unloader.progress >= 100) {
          unloader.status = 'COMPLETE';

          // Transfer cones to target pallet
          const pallet = palletStations.find((p) => p.id === unloader.targetPalletId);
          if (pallet) {
            pallet.coneCount = Math.min(pallet.capacity, pallet.coneCount + CONES_PER_BASKET);
            if (!pallet.variantId) pallet.variantId = unloader.variantId;
          }

          if (basket) {
            basket.coneQuantity = 0;
            basket.status = 'EMPTY'; // Basket becomes EMPTY!
            basket.variantId = null;
            basket.assignedUnloader = null;
            basket.location = 'Empty Return Rail';
            basket.progressOnTrack = 0.85; // Moves along return track to pool
          }

          this.state.totalConesHandled += CONES_PER_BASKET;
          this.state.totalCyclesCompleted += 1;

          this.logEvent(
            'SUCCESS',
            `Unloader ${unloader.id} finished: All cones unloaded from ${basket ? basket.id : ''}. Basket marked EMPTY and available for reuse.`
          );

          // Reset unloader to AVAILABLE
          setTimeout(() => {
            unloader.status = 'AVAILABLE';
            unloader.assignedBasketId = null;
            unloader.variantId = null;
            unloader.progress = 0;
            unloader.conesRemaining = 0;
            unloader.targetPalletId = null;
          }, 350);
        }
      }
    });
  }

  processReturnPool() {
    const { baskets } = this.state;

    baskets.forEach((basket) => {
      // If basket is empty and on return rail, let it traverse back to ready pool
      if (basket.status === 'EMPTY' && basket.location === 'Empty Return Rail') {
        basket.progressOnTrack = (basket.progressOnTrack || 0.85) + 0.015 * this.speed;
        if (basket.progressOnTrack >= 0.99) {
          basket.location = 'EMPTY_POOL_READY';
          basket.progressOnTrack = 0;
        }
      }
    });
  }

  updateStats() {
    const { baskets, fifoQueue } = this.state;

    let emptyCount = 0;
    let loadedCount = 0;
    let transitCount = 0;
    let unloadingCount = 0;

    baskets.forEach((b) => {
      if (b.status === 'EMPTY') emptyCount++;
      else if (b.status === 'LOADING' || b.status === 'LOADED') loadedCount++;
      else if (b.status === 'IN_TRANSIT') transitCount++;
      else if (b.status === 'UNLOADING') unloadingCount++;
    });

    this.state.stats = {
      machinesCount: 16,
      loadersCount: 16,
      basketsTotal: 280,
      activeVariantsRatio: `${this.state.activeVariantIds.length}/${MAX_ACTIVE_VARIANTS}`,
      dynamicUnloadersCount: 4,
      palletStationsCount: 8,
      queueRatio: `${fifoQueue.length}/${MAX_FIFO_QUEUE_SIZE}`,
      emptyBaskets: emptyCount,
      loadedBaskets: loadedCount,
      inTransit: transitCount,
      unloading: unloadingCount,
      totalConesHandled: this.state.totalConesHandled,
      totalCycles: this.state.totalCyclesCompleted,
    };
  }

  // Active Variant Swap
  swapActiveVariant(removeVariantId, addVariantId) {
    const idx = this.state.activeVariantIds.indexOf(removeVariantId);
    if (idx !== -1 && !this.state.activeVariantIds.includes(addVariantId)) {
      this.state.activeVariantIds[idx] = addVariantId;
      const rem = VARIANTS.find((v) => v.id === removeVariantId);
      const add = VARIANTS.find((v) => v.id === addVariantId);
      this.logEvent('INFO', `Variant management: Replaced active variant ${rem?.name} with ${add?.name}`);
      this.updateStats();
      if (this.onUpdate) this.onUpdate(this.state);
    }
  }

  // Manual Trigger Doff for Testing
  triggerManualDoff(machineId) {
    const machine = this.state.machines.find((m) => m.id === machineId);
    if (machine) {
      machine.doffCount = machine.targetDoff;
      this.logEvent('INFO', `Manual doff triggered for machine ${machineId}`);
      this.tick();
    }
  }

  // Story Mode execution
  startStoryMode(onStoryStep) {
    this.isStoryMode = true;
    this.storyStep = 1;
    this.pause(); // Pause auto-tick so story is controlled

    // Ensure M05 and B152 are ready for story
    const m05 = this.state.machines.find((m) => m.id === 'M05');
    if (m05) {
      m05.doffCount = 99.5;
      m05.status = 'RUNNING';
    }

    const b152 = this.state.baskets.find((b) => b.id === 'B152');
    if (b152) {
      b152.status = 'EMPTY';
      b152.variantId = null;
      b152.coneQuantity = 0;
      b152.location = 'EMPTY_POOL_READY';
      b152.progressOnTrack = 0;
      b152.assignedLoader = null;
      b152.assignedUnloader = null;
    }

    this.runStoryStep(1, onStoryStep);
  }

  runStoryStep(step, onStoryStep) {
    this.storyStep = step;
    if (onStoryStep) onStoryStep(step);

    const m05 = this.state.machines.find((m) => m.id === 'M05');
    const b152 = this.state.baskets.find((b) => b.id === 'B152');
    const l05 = this.state.loaders.find((l) => l.id === 'L05');
    const u03 = this.state.unloaders.find((u) => u.id === 'U03');

    switch (step) {
      case 1:
        // STEP 1: Machine M05 completes its doff count
        if (m05) {
          m05.doffCount = 100;
          m05.status = 'DOFF_COMPLETE';
        }
        this.logEvent('SUCCESS', 'STORY STEP 1: Machine M05 completes its doff count (100/100).');
        break;

      case 2:
        // STEP 2: Loading request added to FIFO queue
        if (m05) {
          m05.status = 'QUEUED';
          // Put M05 at front of queue
          this.state.fifoQueue = [
            {
              queueId: 'Q-STORY-M05',
              machineId: 'M05',
              variantId: 'V1',
              cones: 32,
              timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
            },
            ...this.state.fifoQueue.filter((q) => q.machineId !== 'M05').slice(0, 3),
          ];
        }
        this.logEvent('INFO', 'STORY STEP 2: Loading request for M05 (34s SCHY) added to FIFO queue position 1.');
        break;

      case 3:
        // STEP 3: Empty basket B152 detected
        if (b152) {
          b152.status = 'EMPTY';
          b152.location = 'DETECTED_AT_BUFFER';
        }
        this.logEvent('INFO', 'STORY STEP 3: Empty basket B152 detected in reserve buffer pool.');
        break;

      case 4:
        // STEP 4: Loader L05 assigned
        if (l05 && b152) {
          l05.status = 'ASSIGNED';
          l05.assignedMachineId = 'M05';
          l05.assignedBasketId = 'B152';
          l05.variantId = 'V1';
          l05.progress = 10;
          b152.assignedLoader = 'L05';
          b152.location = 'Loader Bay L05';
          b152.status = 'LOADING';
        }
        this.logEvent('INFO', 'STORY STEP 4: Loader L05 assigned to M05 with Empty Basket B152.');
        break;

      case 5:
        // STEP 5: B152 loaded with Variant B (34s SCHY)
        if (l05 && b152) {
          l05.status = 'LOADING';
          l05.progress = 100;
          l05.conesLoaded = 32;
          b152.coneQuantity = 32;
          b152.variantId = 'V1';
          b152.status = 'LOADED';
          if (m05) {
            m05.doffCount = 0;
            m05.status = 'RUNNING';
          }
          // Remove from FIFO queue
          this.state.fifoQueue = this.state.fifoQueue.filter((q) => q.machineId !== 'M05');
        }
        this.logEvent('SUCCESS', 'STORY STEP 5: B152 successfully loaded with 32 cones of 34s SCHY.');
        break;

      case 6:
        // STEP 6: B152 enters the OHC conveyor
        if (b152) {
          b152.status = 'IN_TRANSIT';
          b152.progressOnTrack = 0.15;
          b152.location = 'OHC Segment 1 (Overhead Transit)';
        }
        if (l05) {
          l05.status = 'AVAILABLE';
          l05.assignedMachineId = null;
          l05.assignedBasketId = null;
        }
        this.logEvent('INFO', 'STORY STEP 6: Basket B152 enters the OHC overhead conveyor rail.');
        break;

      case 7:
        // STEP 7: B152 reaches the unloading area
        if (b152) {
          b152.progressOnTrack = 0.70;
          b152.location = 'OHC Segment 4 (Unloading Approach Area)';
        }
        this.logEvent('INFO', 'STORY STEP 7: B152 reaches the dynamic unloading zone.');
        break;

      case 8:
        // STEP 8: Dynamic Unloader U03 assigned
        if (u03 && b152) {
          u03.status = 'ASSIGNED';
          u03.assignedBasketId = 'B152';
          u03.variantId = 'V1';
          u03.progress = 20;
          u03.targetPalletId = 'P03';
          u03.conesRemaining = 32;

          b152.status = 'UNLOADING';
          b152.assignedUnloader = 'U03';
          b152.location = 'Unloader Bay U03';
        }
        this.logEvent('INFO', 'STORY STEP 8: Dynamic Unloader U03 assigned dynamically to B152.');
        break;

      case 9:
        // STEP 9: All cones unloaded
        if (u03 && b152) {
          u03.status = 'COMPLETE';
          u03.progress = 100;
          u03.conesRemaining = 0;
          b152.coneQuantity = 0;
          // Deposit cones into Pallet P03
          const p03 = this.state.palletStations.find((p) => p.id === 'P03');
          if (p03) p03.coneCount += 32;
        }
        this.logEvent('SUCCESS', 'STORY STEP 9: All 32 cones unloaded into Pallet Bay P03.');
        break;

      case 10:
        // STEP 10: B152 is now EMPTY and available
        if (b152) {
          b152.status = 'EMPTY';
          b152.variantId = null;
          b152.coneQuantity = 0;
          b152.assignedUnloader = null;
          b152.location = 'EMPTY_POOL_READY';
          b152.progressOnTrack = 0;
        }
        if (u03) {
          u03.status = 'AVAILABLE';
          u03.assignedBasketId = null;
          u03.variantId = null;
          u03.progress = 0;
        }
        this.state.totalCyclesCompleted += 1;
        this.state.totalConesHandled += 32;
        this.logEvent(
          'SUCCESS',
          'STORY STEP 10: Basket B152 is now EMPTY and returned to active pool for reuse.'
        );
        break;

      default:
        break;
    }

    this.updateStats();
    if (this.onUpdate) this.onUpdate(this.state);
  }

  stopStoryMode() {
    this.isStoryMode = false;
    this.storyStep = 0;
    if (this.storyTimer) {
      clearInterval(this.storyTimer);
      this.storyTimer = null;
    }
  }

  reset(initialState) {
    this.pause();
    this.stopStoryMode();
    this.state = JSON.parse(JSON.stringify(initialState));
    this.tickCount = 0;
    this.simulatedTimeSeconds = 0;
    this.updateStats();
    if (this.onUpdate) this.onUpdate(this.state);
    this.logEvent('INFO', 'System reset to initial factory configuration.');
  }
}
