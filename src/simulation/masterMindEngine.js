// ═══════════════════════════════════════════════════════════════════════════
// SIEGER MASTER MIND ENGINE — continuous OHC chain with 280 baskets
// ---------------------------------------------------------------------------
// Plant (customer numbers):
//   16 autoconers + 16 loaders · 4 dynamic unloaders · 8 pallet stations
//   8 variants (materials) · 280 cone baskets hanging on ONE closed OHC loop
//
// Conveyor model:
//   • All 280 baskets hang on the loop at a fixed pitch and move together.
//     They always stay in the same sequence — no basket can pass another.
//   • Loaders: when a machine gets a load permit, its loader fills its magazine
//     from the autoconer (≈25 s), then drops the cones into the EMPTY basket
//     that was reserved for it as that basket passes the loader.
//   • Unloaders: a loaded basket gets a dynamic unloader at the approach point
//     (just before U01). As it passes through that bay the unloader takes the
//     cones out onto one of its two pallets, then needs a few seconds to stack.
//     If no unloader is free, the basket recirculates round the loop and tries again.
//
// Loading strategies (same limits for both: 4Q = max 4 loads in progress,
// max 4 variants in the system):
//   • FIFO  — customer specification, strict first-come-first-served
//   • BRAIN — the Master Mind decides who loads next (masterMindBrain.js)
//
// 1 tick = 1 simulated second. The speed buttons only change how fast ticks run.
// ═══════════════════════════════════════════════════════════════════════════
import { SimulationEngine } from './simulationEngine';
import { MasterMindBrain, DEFAULT_WEIGHTS, computeVariantOccupancy } from './masterMindBrain';
import { VARIANTS, CONES_PER_BASKET, MAX_ACTIVE_VARIANTS, MAX_FIFO_QUEUE_SIZE, TOTAL_BASKET_COUNT } from '../constants/simulationConstants';
import {
  loaderProgress,
  unloaderProgress,
  UNLOADER_PROGRESS,
  UNLOAD_APPROACH,
  TRACK_LENGTH,
} from './trackGeometry';

// 16 autoconers running 8 variants (2 machines per material), each with its own cone buffer (s).
export const MM_MACHINE_SETUP = {
  M01: { variantId: 'V1', bufferSec: 70 },
  M02: { variantId: 'V2', bufferSec: 90 },
  M03: { variantId: 'V3', bufferSec: 60 },
  M04: { variantId: 'V4', bufferSec: 80 },
  M05: { variantId: 'V5', bufferSec: 45 },
  M06: { variantId: 'V6', bufferSec: 100 },
  M07: { variantId: 'V7', bufferSec: 75 },
  M08: { variantId: 'V8', bufferSec: 40 },
  M09: { variantId: 'V1', bufferSec: 55 },
  M10: { variantId: 'V2', bufferSec: 90 },
  M11: { variantId: 'V3', bufferSec: 50 },
  M12: { variantId: 'V4', bufferSec: 65 },
  M13: { variantId: 'V5', bufferSec: 85 },
  M14: { variantId: 'V6', bufferSec: 70 },
  M15: { variantId: 'V7', bufferSec: 45 },
  M16: { variantId: 'V8', bufferSec: 110 },
};

export const PITCH = 1 / TOTAL_BASKET_COUNT;            // spacing of the 280 baskets on the loop
export const CHAIN_PITCHES_PER_SEC = 3;                  // chain speed: 3 basket pitches per second
const CHAIN_STEP = PITCH * CHAIN_PITCHES_PER_SEC;       // loop progress per tick
export const CHAIN_SPEED_PX = +(CHAIN_STEP * TRACK_LENGTH).toFixed(1); // ≈36 px/s on the drawing
export const LOOP_SECONDS = Math.round(1 / CHAIN_STEP);  // one full revolution

const DOFF_RATE = 0.95;   // doff % per tick per unit of machine speed
const LOAD_RATE = 4;      // loader magazine fill % per tick (≈25 s)
const FILL_SECONDS = Math.ceil(100 / LOAD_RATE);
const BAY_HALF = 40 / TRACK_LENGTH; // an unloader works on a basket over ±40 px of rail
const STACK_SECONDS = 4;  // unloader needs this long after a basket to stack cones on the pallet
const PALLET_CAPACITY = 480;
const DECISION_LOG_MAX = 80;
const SEEDED_LOADED = [
  { at: 0.36, v: 'V1' }, { at: 0.39, v: 'V2' }, { at: 0.42, v: 'V1' }, { at: 0.45, v: 'V3' },
];

const vName = (id) => VARIANTS.find((v) => v.id === id)?.name || id;
const wrap = (p) => ((p % 1) + 1) % 1;
// Did a point moving forward from `from` to `to` (on the loop) cross `mark`?
const crossed = (from, to, mark) => (from <= to ? from < mark && mark <= to : from < mark || mark <= to);
const aheadDist = (from, mark) => wrap(mark - from); // loop distance from `from` forward to `mark`

const emptyKpi = () => ({ simSec: 0, loads: 0, totalWait: 0, maxWait: 0, stopSec: 0, stopEvents: 0, cones: 0, recirc: 0 });

export class MasterMindEngine extends SimulationEngine {
  constructor(initialState, onUpdate, onEvent, options = {}) {
    super(initialState, onUpdate, onEvent);
    this.initialSnapshot = JSON.stringify(initialState);
    this.mode = options.mode || 'BRAIN';
    this.brainOnline = true;
    this.brain = new MasterMindBrain(options.weights || DEFAULT_WEIGHTS);
    this.silent = !!options.silent;
    this.prepareState();
  }

  // ── State preparation ────────────────────────────────────────────────────
  prepareState() {
    const s = this.state;
    s.machines.forEach((m) => {
      const setup = MM_MACHINE_SETUP[m.id];
      if (setup) {
        m.variantId = setup.variantId;
        m.bufferSec = setup.bufferSec;
      } else {
        m.bufferSec = m.bufferSec || 60;
      }
      m.status = 'RUNNING';
      m.doneAt = null;
      m.urgent = !!m.urgent;
      m.stoppedSec = 0;
    });
    s.loaders.forEach((l) => Object.assign(l, { status: 'AVAILABLE', assignedMachineId: null, assignedBasketId: null, variantId: null, progress: 0, conesLoaded: 0 }));
    s.unloaders.forEach((u) => Object.assign(u, { status: 'AVAILABLE', assignedBasketId: null, variantId: null, progress: 0, conesRemaining: 0, targetPalletId: null, stackLeft: 0 }));
    s.palletStations.forEach((pl) => { pl.capacity = PALLET_CAPACITY; });

    // All 280 baskets hang on the loop at a fixed pitch, B001 … B280 in sequence.
    // Everything starts empty except a few loaded baskets already on the way to the unloaders.
    s.baskets.forEach((b, i) => {
      Object.assign(b, {
        status: 'EMPTY',
        variantId: null,
        coneQuantity: 0,
        progressOnTrack: wrap(-i * PITCH),
        location: 'OHC loop',
        assignedLoader: null,
        assignedUnloader: null,
        reservedFor: null,
        recirculations: 0,
      });
    });
    SEEDED_LOADED.forEach(({ at, v }) => {
      const b = s.baskets.reduce((best, x) => (Math.abs(x.progressOnTrack - at) < Math.abs(best.progressOnTrack - at) ? x : best));
      Object.assign(b, { status: 'IN_TRANSIT', variantId: v, coneQuantity: CONES_PER_BASKET, location: 'OHC loop (loaded)' });
    });

    s.unloadDecisions = [];
    s.fifoQueue = [];       // the 4Q: loads in progress (magazine filling / waiting for its basket)
    s.waitList = [];        // arrival order of machines that reached their doff count
    s.systemWarning = null;
    s.activeVariantIds = [];
    s.mode = this.mode;
    s.brainOnline = this.brainOnline;
    s.chain = { pitchesPerSec: CHAIN_PITCHES_PER_SEC, speedPx: CHAIN_SPEED_PX, loopSeconds: LOOP_SECONDS, offset: 0 };
    s.kpi = { FIFO: emptyKpi(), BRAIN: emptyKpi() };
    s.brain = {
      weights: { ...this.brain.weights },
      lastCycle: null,
      lastActiveCycle: null,
      decisions: [],
      pulse: 0,
    };
    this.brain.reset();
    this.refreshActiveVariants();
    this.updateStats();
  }

  reset(initialState) {
    this.pause();
    this.stopStoryMode();
    this.initialSnapshot = JSON.stringify(initialState);
    this.state = JSON.parse(this.initialSnapshot);
    this.tickCount = 0;
    this.simulatedTimeSeconds = 0;
    this.prepareState();
    if (this.onUpdate) this.onUpdate({ ...this.state, simulatedTimeSeconds: 0 });
    this.logEvent('INFO', `System reset — 280 baskets on the OHC loop. Loading strategy: ${this.mode === 'BRAIN' ? 'MASTER MIND' : 'FIFO (customer spec)'}.`);
  }

  logEvent(level, message, metadata) {
    if (this.silent) return;
    super.logEvent(level, message, metadata);
  }

  // ── Operator controls ────────────────────────────────────────────────────
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.state.mode = mode;
    this.brain.drain = null;
    this.brain.reservation = null;
    this.logEvent('INFO', mode === 'BRAIN'
      ? 'MASTER MIND engaged — the brain now decides the loading sequence.'
      : 'Switched to FIFO (customer spec) — strict first-come-first-served.');
    this.emit();
  }

  setBrainOnline(online) {
    this.brainOnline = online;
    this.state.brainOnline = online;
    this.logEvent(online ? 'SUCCESS' : 'ERROR', online
      ? 'Brain heartbeat restored — Master Mind back in control.'
      : 'BRAIN HEARTBEAT LOST — PLC switched to fallback FIFO with 4-variant limit. Production continues.');
    this.emit();
  }

  setWeights(w) {
    this.brain.setWeights(w);
    this.state.brain.weights = { ...this.brain.weights };
    this.emit();
  }

  toggleUrgent(machineId) {
    const m = this.state.machines.find((x) => x.id === machineId);
    if (!m) return;
    m.urgent = !m.urgent;
    this.logEvent('INFO', `${machineId} marked ${m.urgent ? 'URGENT (order priority)' : 'normal priority'}.`);
    this.emit();
  }

  swapActiveVariant() {
    this.logEvent('INFO', 'Variant slots are managed automatically (FIFO arrival order or Master Mind).');
  }

  triggerManualDoff(machineId) {
    const m = this.state.machines.find((x) => x.id === machineId);
    if (m && m.status === 'RUNNING') {
      m.doffCount = m.targetDoff;
      this.logEvent('INFO', `Manual doff triggered for ${machineId}.`);
      this.tick();
    }
  }

  emit() {
    this.updateStats();
    if (this.onUpdate) this.onUpdate({ ...this.state, simulatedTimeSeconds: this.simulatedTimeSeconds });
  }

  // ── Main tick ────────────────────────────────────────────────────────────
  tick() {
    this.tickCount += 1;
    this.simulatedTimeSeconds += 1;
    const t = this.simulatedTimeSeconds;

    this.processProduction(t);
    if (this.mode === 'BRAIN' && this.brainOnline) this.brainCycle(t);
    else this.fifoCycle(t);
    this.processLoaderMagazines();
    this.moveChain(t);
    this.processUnloaderStacking();

    this.refreshActiveVariants();
    this.state.kpi[this.activeStrategy()].simSec += 1;
    this.emit();
  }

  activeStrategy() {
    return this.mode === 'BRAIN' && this.brainOnline ? 'BRAIN' : 'FIFO';
  }

  // Autoconers: wind → doff reached → wait (buffer fills) → stop when buffer full
  processProduction(t) {
    const kpi = this.state.kpi[this.activeStrategy()];
    this.state.machines.forEach((m) => {
      if (m.status === 'RUNNING') {
        m.doffCount = Math.min(m.targetDoff, m.doffCount + m.speed * DOFF_RATE);
        if (m.doffCount >= m.targetDoff) {
          m.status = 'WAITING';
          m.doneAt = t;
          this.state.waitList.push(m.id);
          this.logEvent('INFO', `DOFF COMPLETE — ${m.id} (${vName(m.variantId)}) requests loading. Buffer: ${m.bufferSec}s.`);
        }
      } else if (m.status === 'WAITING' && t - m.doneAt >= m.bufferSec) {
        m.status = 'BUFFER_FULL';
        kpi.stopEvents += 1;
        this.logEvent('ERROR', `${m.id} STOPPED — cone buffer full after waiting ${t - m.doneAt}s.`);
      }
      if (m.status === 'BUFFER_FULL') {
        m.stoppedSec += 1;
        kpi.stopSec += 1;
      }
    });
  }

  // Basket allocation: the first free EMPTY basket that reaches this loader
  // after its magazine is full (so it never passes before the cones are ready).
  pickBasketFor(loaderId, taken = new Set()) {
    const dock = loaderProgress(loaderId);
    let best = null;
    this.state.baskets.forEach((b) => {
      if (b.status !== 'EMPTY' || b.reservedFor || taken.has(b.id)) return;
      const eta = aheadDist(b.progressOnTrack, dock) / CHAIN_STEP;
      if (eta < FILL_SECONDS + 1) return;
      if (!best || eta < best.eta) best = { basket: b, eta };
    });
    if (!best) return { basket: null, reason: 'No free empty basket on the loop' };
    return {
      basket: best.basket,
      eta: Math.round(best.eta),
      reason: `${best.basket.id} is the first free empty basket to reach ${loaderId} after its magazine is full (arrives in ${Math.round(best.eta)}s, magazine full in ${FILL_SECONDS}s)`,
    };
  }

  // Grant a load permit: the loader fills its magazine and an empty basket is reserved
  admit(t, machine, basket, meta = {}) {
    const s = this.state;
    const loader = s.loaders.find((l) => l.id === `L${machine.id.slice(1)}`);
    const wait = t - machine.doneAt;
    const kpi = s.kpi[this.activeStrategy()];
    kpi.loads += 1;
    kpi.totalWait += wait;
    kpi.maxWait = Math.max(kpi.maxWait, wait);

    Object.assign(loader, { status: 'LOADING', assignedMachineId: machine.id, assignedBasketId: basket.id, variantId: machine.variantId, progress: 0, conesLoaded: 0 });
    basket.reservedFor = loader.id;
    basket.location = `OHC loop — reserved for ${loader.id}`;

    s.fifoQueue.push({
      queueId: `Q-${t}-${machine.id}`,
      machineId: machine.id,
      variantId: machine.variantId,
      cones: CONES_PER_BASKET,
      loaderId: loader.id,
      basketId: basket.id,
      waitSec: wait,
      decidedBy: meta.decidedBy || 'FIFO',
      score: meta.score,
      timestamp: `T+${t}s`,
    });
    s.waitList = s.waitList.filter((id) => id !== machine.id);
    machine.doffCount = 0;
    machine.status = 'RUNNING';
    machine.doneAt = null;
  }

  // ── FIFO: the customer specification ─────────────────────────────────────
  fifoCycle(t) {
    const s = this.state;
    s.systemWarning = this.mode === 'BRAIN' && !this.brainOnline ? 'BRAIN OFFLINE — PLC FALLBACK FIFO' : null;
    const taken = new Set();
    while (s.fifoQueue.length < MAX_FIFO_QUEUE_SIZE && s.waitList.length) {
      const head = s.machines.find((m) => m.id === s.waitList[0]);
      const { occupied } = computeVariantOccupancy(s);
      if (!occupied.includes(head.variantId) && occupied.length >= MAX_ACTIVE_VARIANTS) {
        s.systemWarning = s.systemWarning || `FIFO HEAD ${head.id} BLOCKED — 4/4 VARIANTS`;
        break; // strict FIFO: nobody behind the head may overtake
      }
      const { basket } = this.pickBasketFor(`L${head.id.slice(1)}`, taken);
      if (!basket) { s.systemWarning = 'NO FREE EMPTY BASKET'; break; }
      taken.add(basket.id);
      this.admit(t, head, basket, { decidedBy: 'FIFO' });
      this.logEvent('INFO', `FIFO dispatch: ${head.id} (${vName(head.variantId)}) → L${head.id.slice(1)}, basket ${basket.id} reserved.`);
    }
  }

  // ── MASTER MIND ──────────────────────────────────────────────────────────
  brainCycle(t) {
    const s = this.state;
    s.systemWarning = null;
    const snap = this.brain.decide({
      t,
      state: s,
      maxQ: MAX_FIFO_QUEUE_SIZE,
      maxVariants: MAX_ACTIVE_VARIANTS,
      variantName: vName,
      model: {
        railStep: CHAIN_STEP,
        unloadZone: UNLOAD_APPROACH,
        loadRate: LOAD_RATE,
        loaderProgress,
        pickBasketFor: (loaderId, taken) => this.pickBasketFor(loaderId, taken),
      },
    });

    snap.actions.forEach((a) => {
      const machine = s.machines.find((m) => m.id === a.machineId);
      const basket = s.baskets.find((b) => b.id === a.basketId);
      if (machine && basket) {
        this.admit(t, machine, basket, { decidedBy: 'BRAIN', score: a.score });
        this.logEvent('SUCCESS', `🧠 BRAIN: ${a.explanation}`);
      }
    });
    snap.notes.forEach((n) => this.logEvent('WARNING', `🧠 BRAIN: ${n}`));

    s.brain.lastCycle = snap;
    if (snap.candidates.length) s.brain.lastActiveCycle = snap;
    if (snap.actions.length || snap.notes.length) {
      s.brain.pulse = t;
      s.brain.decisions = [
        { id: `D-${snap.cycleId}`, t, actions: snap.actions, notes: snap.notes, drain: snap.drain, summary: snap.summary, snapshot: snap },
        ...s.brain.decisions,
      ].slice(0, DECISION_LOG_MAX);
    }
    const blocked = snap.candidates.find((c) => !c.selected && c.stopped);
    if (blocked) {
      const why = { BLOCKED: 'VARIANT SLOTS FULL', WAIT: 'WAITING FOR 4Q / BASKET', HOLD: 'SLOT DRAINING' }[blocked.verdict.split(' ')[0]] || 'WAITING';
      s.systemWarning = `${blocked.machineId} STOPPED — ${why}`;
    }
  }

  // ── Loaders: fill the magazine from the autoconer ────────────────────────
  processLoaderMagazines() {
    this.state.loaders.forEach((l) => {
      if (l.status !== 'LOADING') return;
      l.progress = Math.min(100, l.progress + LOAD_RATE);
      l.conesLoaded = Math.floor((l.progress / 100) * CONES_PER_BASKET);
      if (l.progress >= 100) l.status = 'READY'; // magazine full, waiting for its basket
    });
  }

  // ── The chain: all 280 baskets advance together, in sequence ─────────────
  moveChain(t) {
    const s = this.state;
    const kpi = s.kpi[this.activeStrategy()];
    s.chain.offset = wrap(s.chain.offset + CHAIN_STEP);
    const lastBay = UNLOADER_PROGRESS[UNLOADER_PROGRESS.length - 1];

    s.baskets.forEach((b) => {
      const from = b.progressOnTrack;
      const to = wrap(from + CHAIN_STEP);
      b.progressOnTrack = to;

      // Loading: the reserved basket passes its loader
      if (b.status === 'EMPTY' && b.reservedFor) {
        const loader = s.loaders.find((l) => l.id === b.reservedFor);
        const dock = loaderProgress(loader.id);
        if (crossed(from, to, dock)) {
          if (loader.status === 'READY') {
            Object.assign(b, { status: 'IN_TRANSIT', variantId: loader.variantId, coneQuantity: CONES_PER_BASKET, reservedFor: null, recirculations: 0, location: `OHC loop — loaded at ${loader.id}` });
            s.fifoQueue = s.fifoQueue.filter((q) => q.loaderId !== loader.id);
            kpi.cones += CONES_PER_BASKET;
            this.logEvent('SUCCESS', `${loader.id} dropped 32 cones (${vName(loader.variantId)}) into ${b.id} as it passed. 4Q slot released.`);
            Object.assign(loader, { status: 'AVAILABLE', assignedMachineId: null, assignedBasketId: null, variantId: null, progress: 0, conesLoaded: 0 });
          } else {
            // Magazine not ready in time: give up this basket and reserve the next one
            b.reservedFor = null;
            b.location = 'OHC loop';
            const { basket: next } = this.pickBasketFor(loader.id);
            if (next) {
              next.reservedFor = loader.id;
              loader.assignedBasketId = next.id;
              const q = s.fifoQueue.find((x) => x.loaderId === loader.id);
              if (q) q.basketId = next.id;
            }
          }
        }
        return;
      }

      if (b.coneQuantity > 0 && (b.status === 'IN_TRANSIT' || b.status === 'UNLOADING')) {
        // Dynamic unloader assignment from the approach point onwards
        if (!b.assignedUnloader && aheadDist(UNLOAD_APPROACH, to) < lastBay - UNLOAD_APPROACH) {
          const choice = this.chooseUnloader(b);
          if (choice) this.routeToUnloader(t, b, choice);
        }

        if (b.assignedUnloader) {
          const u = s.unloaders.find((x) => x.id === b.assignedUnloader);
          const bay = unloaderProgress(u.id);
          const into = to - (bay - BAY_HALF); // how far into the bay window
          if (into >= 0 && into <= 2 * BAY_HALF) {
            // Inside the bay: cones come out as the basket passes through
            const frac = into / (2 * BAY_HALF);
            b.status = 'UNLOADING';
            b.coneQuantity = Math.max(0, Math.round(CONES_PER_BASKET * (1 - frac)));
            b.location = `Unloader Bay ${u.id}`;
            u.status = 'UNLOADING';
            u.progress = Math.round(frac * 100);
            u.conesRemaining = b.coneQuantity;
          } else if (into > 2 * BAY_HALF && into < 0.5) {
            this.finishUnload(b, u);
          } else {
            b.location = `OHC loop → ${u.id}`;
          }
        } else if (crossed(from, to, lastBay + BAY_HALF)) {
          // Passed every bay without an unloader: goes round again
          b.recirculations += 1;
          kpi.recirc += 1;
          b.location = 'OHC loop — recirculating (no unloader was free)';
          this.logEvent('WARNING', `${b.id} (${vName(b.variantId)}) passed all 4 unloaders — none free. Recirculating (lap ${b.recirculations}).`);
        }
      } else if (b.status === 'EMPTY' && !b.reservedFor) {
        b.location = 'OHC loop';
      }
    });

    const recirculating = s.baskets.filter((b) => b.coneQuantity > 0 && b.recirculations > 0).length;
    if (recirculating >= 3 && !s.systemWarning) s.systemWarning = `${recirculating} LOADED BASKETS RECIRCULATING — UNLOADERS BUSY`;
  }

  finishUnload(b, u) {
    const s = this.state;
    const pallet = s.palletStations.find((pl) => pl.id === u.targetPalletId);
    if (pallet) {
      pallet.coneCount += CONES_PER_BASKET;
      if (pallet.coneCount >= pallet.capacity) {
        this.logEvent('SUCCESS', `Pallet ${pallet.id} full (${pallet.coneCount} cones of ${vName(pallet.variantId)}) — dispatched, new pallet placed.`);
        pallet.coneCount = 0;
      }
    }
    this.logEvent('SUCCESS', `${u.id} unloaded ${b.id} onto ${pallet?.id}. Basket continues empty on the loop.`);
    Object.assign(b, { status: 'EMPTY', variantId: null, coneQuantity: 0, assignedUnloader: null, recirculations: 0, location: 'OHC loop' });
    Object.assign(u, { status: 'STACKING', progress: 100, conesRemaining: 0, stackLeft: STACK_SECONDS });
    s.totalConesHandled += CONES_PER_BASKET;
    s.totalCyclesCompleted += 1;
  }

  processUnloaderStacking() {
    this.state.unloaders.forEach((u) => {
      if (u.status !== 'STACKING') return;
      u.stackLeft -= 1;
      if (u.stackLeft <= 0) {
        Object.assign(u, { status: 'AVAILABLE', assignedBasketId: null, variantId: null, progress: 0, conesRemaining: 0, targetPalletId: null, stackLeft: 0 });
      }
    });
  }

  // Dynamic unloader choice: a free bay still ahead of the basket. Prefers a
  // pallet that already collects this variant, then an empty pallet, else the
  // least-full pallet (changed over). The nearer bay wins a tie.
  // Unloader starvation fix: unloaders in STACKING that will finish within
  // 2 basket-pass times are counted as "available soon" to prevent recirculation
  // when all unloaders are momentarily busy after simultaneous unloads.
  chooseUnloader(basket) {
    const s = this.state;
    const options = [];
    const STACK_LOOK_AHEAD = 2; // consider stacking unloaders finishing within N basket passes
    s.unloaders.forEach((u, i) => {
      const isAvailable = u.status === 'AVAILABLE';
      const willBeAvailableSoon = u.status === 'STACKING' && u.stackLeft <= STACK_LOOK_AHEAD;
      if (!isAvailable && !willBeAvailableSoon) return;
      const bay = unloaderProgress(u.id);
      if (basket.progressOnTrack > bay - BAY_HALF) return; // already at / past this bay
      // A stacking unloader gets a small penalty so a genuinely free one is preferred
      const stackPenalty = willBeAvailableSoon && !isAvailable ? 50 : 0;
      [s.palletStations[i * 2], s.palletStations[i * 2 + 1]].filter(Boolean).forEach((pl) => {
        let score;
        let reason;
        if (pl.variantId === basket.variantId && pl.coneCount + CONES_PER_BASKET <= pl.capacity) {
          score = 300 + pl.coneCount / 10;
          reason = `pallet ${pl.id} already collects ${vName(basket.variantId)} (${pl.coneCount}/${pl.capacity} cones)`;
        } else if (pl.coneCount === 0) {
          score = 200;
          reason = `pallet ${pl.id} is empty — started for ${vName(basket.variantId)}`;
        } else {
          score = 100 - pl.coneCount / 10;
          reason = `pallet ${pl.id} (${vName(pl.variantId)}, ${pl.coneCount} cones) is the least full — changed over to ${vName(basket.variantId)}`;
        }
        if (willBeAvailableSoon && !isAvailable) reason += ` (${u.id} finishes stacking in ${u.stackLeft}s)`;
        options.push({ unloader: u, pallet: pl, score: score - i - stackPenalty, reason });
      });
    });
    options.sort((a, b) => b.score - a.score);
    return options[0] || null;
  }

  routeToUnloader(t, basket, { unloader, pallet, reason }) {
    const s = this.state;
    if (pallet.variantId !== basket.variantId) {
      if (pallet.coneCount > 0) {
        this.logEvent('WARNING', `Pallet ${pallet.id} changed over: dispatched with ${pallet.coneCount} cones of ${vName(pallet.variantId)}.`);
      }
      pallet.coneCount = 0;
      pallet.variantId = basket.variantId;
    }
    Object.assign(unloader, { status: 'ASSIGNED', assignedBasketId: basket.id, variantId: basket.variantId, progress: 0, targetPalletId: pallet.id, conesRemaining: basket.coneQuantity });
    basket.assignedUnloader = unloader.id;
    const lap = basket.recirculations ? ` (after ${basket.recirculations} extra lap${basket.recirculations > 1 ? 's' : ''})` : '';
    const text = `${basket.id} (${vName(basket.variantId)}) → ${unloader.id}${lap}: ${reason}.`;
    s.unloadDecisions = [{ t, basketId: basket.id, unloaderId: unloader.id, palletId: pallet.id, variantId: basket.variantId, text }, ...s.unloadDecisions].slice(0, 12);
    this.logEvent('INFO', `Unloader assignment: ${text}`);
  }

  // ── Guided story (scripted steps from the base engine) ───────────────────
  // The base script moves B152 to fixed rail positions; on a chain every basket
  // keeps its place in the sequence, so B152's position is kept and it is only highlighted.
  runStoryStep(step, onStoryStep) {
    const b = this.state.baskets.find((x) => x.id === 'B152');
    const keep = b ? b.progressOnTrack : 0;
    super.runStoryStep(step, onStoryStep);
    if (b) b.progressOnTrack = keep;
    if (this.onUpdate) this.onUpdate({ ...this.state });
  }

  stopStoryMode() {
    const wasStory = this.isStoryMode;
    super.stopStoryMode();
    if (wasStory && !this.resettingFromStory) {
      this.resettingFromStory = true;
      this.reset(JSON.parse(this.initialSnapshot));
      this.resettingFromStory = false;
      this.logEvent('INFO', 'Story finished — plant restarted from the initial state.');
    }
  }

  refreshActiveVariants() {
    const { occupied } = computeVariantOccupancy(this.state);
    this.state.activeVariantIds = occupied;
  }

  updateStats() {
    const s = this.state;
    const loaded = s.baskets.filter((b) => b.coneQuantity > 0 || b.status === 'UNLOADING').length;
    const reserved = s.baskets.filter((b) => b.status === 'EMPTY' && b.reservedFor).length;
    s.stats = {
      machinesCount: s.machines.length,
      loadersCount: s.loaders.length,
      basketsTotal: s.baskets.length,
      activeVariantsRatio: `${s.activeVariantIds.length}/${MAX_ACTIVE_VARIANTS}`,
      dynamicUnloadersCount: s.unloaders.length,
      palletStationsCount: s.palletStations.length,
      queueRatio: `${s.fifoQueue.length}/${MAX_FIFO_QUEUE_SIZE}`,
      emptyBaskets: s.baskets.length - loaded,
      reservedBaskets: reserved,
      loadedBaskets: loaded,
      inTransit: loaded,
      recirculating: s.baskets.filter((b) => b.coneQuantity > 0 && b.recirculations > 0).length,
      unloading: s.unloaders.filter((u) => u.status === 'UNLOADING').length,
      totalConesHandled: s.totalConesHandled,
      totalCycles: s.totalCyclesCompleted,
      waitingMachines: s.machines.filter((m) => m.status === 'WAITING' || m.status === 'BUFFER_FULL').length,
      stoppedMachines: s.machines.filter((m) => m.status === 'BUFFER_FULL').length,
    };
  }
}

// Run both strategies head-less from the same starting state and return their KPIs.
export function runComparison(initialState, seconds = 3600, weights = DEFAULT_WEIGHTS) {
  const run = (mode) => {
    const eng = new MasterMindEngine(initialState, null, null, { mode, weights, silent: true });
    for (let i = 0; i < seconds; i++) eng.tick();
    return summarizeKpi(eng.state.kpi[mode]);
  };
  return { seconds, FIFO: run('FIFO'), BRAIN: run('BRAIN') };
}

export function summarizeKpi(k) {
  const hours = Math.max(k.simSec, 1) / 3600;
  return {
    simSec: k.simSec,
    loads: k.loads,
    loadsPerHour: +(k.loads / hours).toFixed(1),
    avgWait: k.loads ? +(k.totalWait / k.loads).toFixed(1) : 0,
    maxWait: k.maxWait,
    stopMin: +(k.stopSec / 60).toFixed(1),
    stopPct: +((k.stopSec / (Math.max(k.simSec, 1) * 16)) * 100).toFixed(2),
    stopEvents: k.stopEvents,
    cones: k.cones,
    recirc: k.recirc || 0,
  };
}
