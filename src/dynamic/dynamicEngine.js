// ═══════════════════════════════════════════════════════════════════════════
// SIEGER OHC — dynamic plant engine (built from the setup-page values)
// ---------------------------------------------------------------------------
// • The OHC chain has one position ("slot") per pitch. All baskets move
//   together, always in the same sequence. Every slotTime seconds each basket
//   moves one pitch and a new basket arrives in front of every station.
// • ON_THE_FLY: the chain never stops. A loader drops one cone into an empty
//   basket as it passes, then needs "loading time" before it can load again.
//   An unloader takes one cone out of a passing loaded basket, then needs
//   "unloading time" before the next.
// • CHAIN_STOP: the chain stops while any station works on the basket in
//   front of it (for loading or unloading time), then moves on.
// • Loaded baskets that pass every unloader without being unloaded go round
//   again ("returned after unloader").
// • Unloaders put cones into the accumulator of a pallet station (4 or 5
//   cones = one row of the pallet matrix), rows are stacked onto the pallet.
// • Lot change: new cones of that variety get a new lot number; the old lot's
//   remaining cones are cleared with high priority and kept on their own pallet.
// • Loading strategy: FIFO (customer spec) or BRAIN (dynamicBrain.js).
// 1 tick = 1 simulated second.
// ═══════════════════════════════════════════════════════════════════════════
import { varietyInfo } from './config';
import { DynamicBrain, DYN_WEIGHTS } from './dynamicBrain';

const emptyKpi = () => ({
  simSec: 0, loaded: 0, unloaded: 0, returned: 0, stopSec: 0, stopEvents: 0,
  waitTotal: 0, waitCount: 0, maxWait: 0, pallets: 0, partialPallets: 0, permits: 0,
});

export class DynamicEngine {
  constructor(derived, options = {}) {
    this.d = derived;
    this.cfg = derived.cfg;
    this.mode = options.mode || 'BRAIN';
    this.silent = !!options.silent;
    this.onEvent = options.onEvent || null;
    this.brain = new DynamicBrain(options.weights || DYN_WEIGHTS);
    this.brainOnline = true;
    this.build();
  }

  // ── Build the plant from the configuration ───────────────────────────────
  build() {
    const { cfg, d } = this;
    this.t = 0;
    this.chainIdx = 0;      // number of pitches the chain has moved
    this.chainFrac = 0;
    this.dwell = 0;         // CHAIN_STOP: seconds the chain stays stopped
    this.events = [];
    this.decisions = [];
    this.lastCycle = null;
    this.lastActiveCycle = null;
    this.pulse = -99;
    this.unloadDecisions = [];

    this.varieties = Array.from({ length: cfg.varieties }, (_, v) => ({
      idx: v, ...varietyInfo(v), lot: Math.max(1, Math.round(Number(cfg.varietyLot?.[v]) || 1)), highDemand: !!cfg.varietyDemand?.[v], lotChange: null,
      returned: 0, loaded: 0, unloaded: 0,
    }));

    // Baskets are fixed to chain positions. They are numbered in the order the origin reader R0
    // reads them (B001, B002, … — the order list recorded at commissioning): B001 is at R0 at the
    // start and B002 is one pitch behind it, so it reaches R0 next.
    this.baskets = Array.from({ length: cfg.basketCount }, (_, b) => ({
      id: `B${String(b + 1).padStart(3, '0')}`, idx: b, chainSlot: (d.slots - b) % d.slots, variety: -1, lot: 0, loadedAt: null, laps: 0, targetStation: null,
    }));
    // RFID tracking as the PLC does it: R0 reads, a pitch-pulse counter, and a reader at every station
    this.rfid = {
      pulses: 0,                                   // pitch pulses since start (PLC counter C)
      lastR0: { idx: 0, id: this.baskets[0]?.id, pulse: 0, t: 0 }, // B001 starts at R0
      loops: 0,
      homeChecks: 0,
      homeErrors: 0,
      lastHome: null,
      reads: 0,
      stationReads: {},                           // station id → { id, t }
    };
    this.slotBasket = Array.from({ length: d.slots }, () => -1);
    this.baskets.forEach((b, i) => { this.slotBasket[b.chainSlot] = i; });

    this.loaders = cfg.loaderVariety.map((v, i) => ({
      id: `L${String(i + 1).padStart(2, '0')}`, idx: i, slot: d.loaderSlots[i], variety: v, rate: d.loaderRate[i],
      // start with a spread of cones already waiting so the plant is busy from the start
      carry: 0, queue: [{ lot: this.varieties[v].lot, n: Math.floor(((i * 7) % 11) / 11 * cfg.loaderBufferCones * 0.6) }],
      permit: false, targets: {}, cooldown: 0, eligibleSince: null, stopped: false, stoppedSec: 0, loadedTotal: 0, permitSince: null,
      paceSlots: d.loadSlots, sinceLoad: 999, // pace = load into every Nth basket (PLC: LOAD_PACE)
    }));
    this.loaders.forEach((l) => { l.count = l.queue[0].n; });

    this.unloaders = d.unloaderSlots.map((slot, j) => ({
      id: `U${String(j + 1).padStart(2, '0')}`, idx: j, slot, cooldown: 0, unloaded: 0, lastStation: null, sinceUnload: 999,
      stations: d.stationUnloader.map((u, k) => (u === j ? k : -1)).filter((k) => k >= 0),
    }));
    this.lastUnloaderSlot = d.unloaderSlots.reduce((best, s) => (this.fwd(d.loaderSlots[0], s) > this.fwd(d.loaderSlots[0], best) ? s : best), d.unloaderSlots[0]);

    this.stations = d.stationUnloader.map((u, k) => ({
      id: `P${String(k + 1).padStart(2, '0')}`, idx: k, unloader: u, status: 'FREE', variety: -1, lot: 0,
      acc: 0, pallet: 0, pallets: 0,
    }));

    this.kpi = { FIFO: emptyKpi(), BRAIN: emptyKpi() };
    this.brain.reset();
    this.refresh();
  }

  log(level, message) {
    if (this.silent) return;
    const ev = { id: `E${this.t}-${Math.random().toString(36).slice(2, 7)}`, t: this.t, level, message };
    this.events.unshift(ev);
    if (this.events.length > 150) this.events.length = 150;
    if (this.onEvent) this.onEvent(ev);
  }

  // ── Geometry helpers ─────────────────────────────────────────────────────
  fwd(from, to) { const S = this.d.slots; return (((to - from) % S) + S) % S; } // forward distance in slots
  slotPos(chainSlot) { return (chainSlot + this.chainIdx + this.chainFrac) % this.d.slots; } // position in pitches
  basketAt(stationSlot) { const k = ((stationSlot - this.chainIdx) % this.d.slots + this.d.slots) % this.d.slots; const b = this.slotBasket[k]; return b >= 0 ? this.baskets[b] : null; }

  strategy() { return this.mode === 'BRAIN' && this.brainOnline ? 'BRAIN' : 'FIFO'; }
  // Variety limit in force: FIFO always uses the spec; the brain may decide it (AUTO)
  varietyLimit() { return this.strategy() === 'BRAIN' ? this.brain.limit(this) : this.cfg.maxVarietiesOnLoop; }
  k() { return this.kpi[this.strategy()]; }

  // Cones the loader needs before it asks to load
  triggerCount(l) {
    const { cfg } = this;
    if (this.strategy() === 'FIFO' || cfg.loadingCountMode === 'MANUAL') {
      return cfg.loadingCountMode === 'MANUAL' ? cfg.manualTriggerCount : cfg.conesPerAccumulator;
    }
    return this.brain.autoTrigger(this, l);
  }

  hasOldLot(l) {
    const lc = this.varieties[l.variety].lotChange;
    return !!lc && l.queue.some((q) => q.lot === lc.oldLot && q.n > 0);
  }

  // ── Operator actions ─────────────────────────────────────────────────────
  setMode(mode) { this.mode = mode; this.brain.drain = null; this.brain.reservation = null; this.log('INFO', mode === 'BRAIN' ? 'MASTER MIND in control of loading.' : 'Switched to FIFO (customer spec).'); }
  setBrainOnline(on) { this.brainOnline = on; this.log(on ? 'SUCCESS' : 'ERROR', on ? 'Brain heartbeat restored.' : 'BRAIN HEARTBEAT LOST — PLC fallback FIFO. Production continues.'); }
  setWeights(w) { this.brain.setWeights(w); }
  toggleDemand(v) { const x = this.varieties[v]; x.highDemand = !x.highDemand; this.log('INFO', `${x.name} marked ${x.highDemand ? 'HIGH DEMAND' : 'normal demand'}.`); }
  lotChange(v) {
    const x = this.varieties[v];
    if (x.lotChange) { this.log('WARNING', `${x.name}: a lot change is already in progress (lot ${x.lotChange.oldLot} still clearing).`); return; }
    const oldLot = x.lot;
    x.lot += 1;
    x.lotChange = { oldLot, newLot: x.lot, since: this.t };
    this.log('WARNING', `LOT CHANGE ${x.name}: lot ${oldLot} → ${x.lot}. Remaining cones of lot ${oldLot} get high priority and their own pallet.`);
  }

  lotRemaining(v) {
    const x = this.varieties[v];
    if (!x.lotChange) return null;
    const lot = x.lotChange.oldLot;
    let atLoaders = 0; let onLoop = 0; let inAcc = 0;
    this.loaders.forEach((l) => { if (l.variety === v) l.queue.forEach((q) => { if (q.lot === lot) atLoaders += q.n; }); });
    this.baskets.forEach((b) => { if (b.variety === v && b.lot === lot) onLoop += 1; });
    this.stations.forEach((s) => { if (s.variety === v && s.lot === lot) inAcc += s.acc; });
    return { lot, atLoaders, onLoop, inAcc, total: atLoaders + onLoop };
  }

  // ── Main tick ────────────────────────────────────────────────────────────
  tick() {
    this.t += 1;
    const k = this.k();
    this.produce(k);
    if (this.strategy() === 'BRAIN') this.brainCycle();
    else this.fifoCycle();
    this.ensureRoutes();
    this.moveChain(k);
    this.housekeeping();
    k.simSec += 1;
    this.refresh();
  }

  // Autoconers feed their loaders; a full loader buffer stops the autoconer
  produce(k) {
    const { cfg } = this;
    this.loaders.forEach((l) => {
      const full = l.count >= cfg.loaderBufferCones;
      if (!full) {
        l.carry += l.rate / 3600;
        while (l.carry >= 1 && l.count < cfg.loaderBufferCones) {
          l.carry -= 1;
          const lot = this.varieties[l.variety].lot;
          const last = l.queue[l.queue.length - 1];
          if (last && last.lot === lot) last.n += 1; else l.queue.push({ lot, n: 1 });
          l.count += 1;
        }
      }
      const nowFull = l.count >= cfg.loaderBufferCones;
      if (nowFull) {
        if (!l.stopped) { l.stopped = true; k.stopEvents += 1; this.log('ERROR', `${l.id} buffer full (${l.count} cones) — autoconer STOPPED.`); }
        l.stoppedSec += 1; k.stopSec += 1; l.carry = 0;
      } else if (l.stopped) {
        l.stopped = false;
      }
      const eligible = !l.permit && (l.count >= this.triggerCount(l) || this.hasOldLot(l) || nowFull);
      if (eligible && l.eligibleSince === null) l.eligibleSince = this.t;
      // Once a loader has asked to load it keeps its place in the queue, even if the automatic
      // trigger rises afterwards (the trigger depends on the forecast, which changes every second).
      if (!eligible && !l.permit && l.eligibleSince !== null && l.count <= 0) l.eligibleSince = null;
    });
  }

  // Varieties that occupy a "variety slot": cones on the loop or a loader permitted to load
  occupancy() {
    const occ = new Map();
    const touch = (v) => { if (!occ.has(v)) occ.set(v, { variety: v, onLoop: 0, loading: 0, waiting: 0 }); return occ.get(v); };
    this.baskets.forEach((b) => { if (b.variety >= 0) touch(b.variety).onLoop += 1; });
    this.loaders.forEach((l) => { if (l.permit) touch(l.variety).loading += 1; });
    this.loaders.forEach((l) => { if (!l.permit && l.eligibleSince !== null && occ.has(l.variety)) occ.get(l.variety).waiting += 1; });
    return occ;
  }

  // Seconds until a variety has no cones left on the loop (all unloaded)
  clearSeconds(v) {
    const { d } = this;
    let worst = 0;
    this.baskets.forEach((b) => {
      if (b.variety !== v) return;
      const pos = Math.floor(this.slotPos(b.chainSlot));
      worst = Math.max(worst, this.fwd(pos, this.lastUnloaderSlot) * d.slotTime);
    });
    this.loaders.forEach((l) => {
      if (l.variety !== v || !l.permit) return;
      worst = Math.max(worst, l.count * Math.max(l.paceSlots, d.loadSlots) * d.slotTime + this.fwd(l.slot, this.lastUnloaderSlot) * d.slotTime);
    });
    return Math.round(worst);
  }

  // ── Pallet stations ──────────────────────────────────────────────────────
  stationsFor(v, lot) { return this.stations.filter((s) => s.variety === v && s.lot === lot && s.status !== 'FREE'); }

  // Loading streams per unloader: each permitted loader sends one basket every loading
  // cycle to the station it is routed to. One stream per unloader never makes a basket
  // wait (unloading time < loading time); two streams on one unloader cause returns.
  streamLoad() {
    const load = Array.from({ length: this.unloaders.length }, () => 0);
    this.loaders.forEach((l) => {
      if (!l.permit) return;
      const lot = l.queue.find((q) => q.n > 0)?.lot;
      const st = this.stations[l.targets?.[lot]];
      if (st) load[st.unloader] += 1;
    });
    return load;
  }

  // Choose the pallet station (and so the unloader) that a loader's cones of one lot go to.
  // spread = look for a station on a quieter unloader; reserve = free stations to keep for other varieties.
  routeLot(v, lot, load, exclude = new Set(), opts = {}) {
    const U = (st) => this.unloaders[st.unloader].id;
    const have = this.stationsFor(v, lot).sort((a, b) => load[a.unloader] - load[b.unloader] || a.idx - b.idx);
    const best = have[0];
    if (best && (!opts.spread || load[best.unloader] < 1)) {
      return { ok: true, station: best, take: [], reason: `${best.id} on ${U(best)} (already collects this lot${load[best.unloader] ? `, ${load[best.unloader]} stream` : ', unloader free'})` };
    }
    const freeCount = this.stations.filter((st) => st.status === 'FREE' && !exclude.has(st.idx)).length;
    const cand = this.stations
      .filter((st) => (st.status === 'FREE' || st.status === 'HELD') && !exclude.has(st.idx) && !have.includes(st))
      .sort((a, b) => (a.status === 'FREE' ? 0 : 1) - (b.status === 'FREE' ? 0 : 1) || load[a.unloader] - load[b.unloader] || (a.pallet + a.acc) - (b.pallet + b.acc) || a.idx - b.idx);
    const describe = (st) => (st.status === 'HELD'
      ? `${st.id} on ${U(st)} (changed over from ${varietyInfo(st.variety).name}, ${st.pallet + st.acc} cones dispatched)`
      : `${st.id} on ${U(st)} (free station${load[st.unloader] ? '' : ', unloader free'})`);
    if (best) {
      // Already has a station but its unloader is busy: add one on a quieter unloader if we can spare it
      const extra = cand.find((st) => st.status === 'FREE' && load[st.unloader] < load[best.unloader] && freeCount - 1 >= (opts.reserve || 0));
      if (extra) return { ok: true, station: extra, take: [extra], reason: `${describe(extra)} — a second station so this stream has its own unloader` };
      return { ok: true, station: best, take: [], reason: `${best.id} on ${U(best)} (shared unloader — ${load[best.unloader]} stream)` };
    }
    const pick = cand[0];
    if (!pick) return { ok: false, reason: 'no free or held pallet station' };
    return { ok: true, station: pick, take: [pick], reason: describe(pick) };
  }

  applyRoute(v, lot, route) {
    const st = route.station;
    if (route.take.includes(st)) {
      if (st.status === 'HELD' && st.pallet + st.acc > 0) {
        this.k().partialPallets += 1;
        this.log('WARNING', `${st.id}: partial pallet of ${varietyInfo(st.variety).name} lot ${st.lot} dispatched (${st.pallet + st.acc} cones) — changed over.`);
      }
      Object.assign(st, { variety: v, lot, acc: 0, pallet: 0 });
      this.log('INFO', `${st.id} (${this.unloaders[st.unloader].id}) allocated to ${varietyInfo(v).name} lot ${lot}.`);
    }
    st.status = 'ACTIVE';
    return st;
  }

  // A lot that turns up at a permitted loader during its batch (e.g. after a lot change) needs a route
  ensureRoutes() {
    this.loaders.forEach((l) => {
      if (!l.permit) return;
      l.queue.forEach((q) => {
        const cur = this.stations[l.targets[q.lot]];
        if (q.n <= 0 || (cur && cur.variety === l.variety && cur.lot === q.lot && cur.status !== 'FREE')) return;
        const r = this.routeLot(l.variety, q.lot, this.streamLoad(), new Set(), { spread: this.strategy() === 'BRAIN' });
        if (r.ok) l.targets[q.lot] = this.applyRoute(l.variety, q.lot, r).idx;
      });
    });
  }

  // ── Timing forecast ──────────────────────────────────────────────────────
  // Everything is counted in basket arrivals ("pitches") from now: the chain moves one
  // pitch every slotTime seconds, so arrival n happens (n - chainFrac) × slotTime from now.
  secOf(n) { return Math.max(0, (n - this.chainFrac) * this.d.slotTime); }

  // When will the loader drop its k-th next cone (arrival index at the loader)?
  loaderFirstIdx(l, pace) {
    const need = Math.max(pace, this.d.loadSlots) - l.sinceLoad;
    const cd = this.cfg.stationMode === 'ON_THE_FLY' ? Math.ceil(l.cooldown / this.d.slotTime) : 0;
    return Math.max(1, need, cd);
  }

  // Cones already heading for each unloader: baskets on the loop routed there, plus the
  // remaining cones of every loader that is loading now. Result per unloader: sorted arrival indexes.
  forecastBase(skipLoader = -1) {
    const { d } = this;
    const lists = this.unloaders.map(() => []);
    const unloaderOfStation = (k) => (k === null || k === undefined || !this.stations[k] ? -1 : this.stations[k].unloader);
    this.baskets.forEach((b) => {
      if (b.variety < 0) return;
      const pos = (b.chainSlot + this.chainIdx) % d.slots;
      const toLast = this.fwd(pos, this.lastUnloaderSlot);
      let uIdx = -1;
      if (b.laps === 0 && this.stations[b.targetStation]?.variety === b.variety) uIdx = unloaderOfStation(b.targetStation);
      else {
        // returned basket: the first unloader downstream with an active station for its lot
        let best = Infinity;
        this.stations.forEach((s) => {
          if (s.status !== 'ACTIVE' || s.variety !== b.variety || s.lot !== b.lot) return;
          const f = this.fwd(pos, this.unloaders[s.unloader].slot) || d.slots;
          if (f < best) { best = f; uIdx = s.unloader; }
        });
      }
      if (uIdx < 0) return;
      const f = this.fwd(pos, this.unloaders[uIdx].slot);
      if (f === 0 || (b.laps === 0 && f > toLast)) return; // already passed it
      lists[uIdx].push(f);
    });
    this.loaders.forEach((l) => {
      if (!l.permit || l.idx === skipLoader) return;
      const pace = Math.max(l.paceSlots, d.loadSlots);
      let j = this.loaderFirstIdx(l, pace);
      l.queue.forEach((q) => {
        const st = this.stations[l.targets?.[q.lot]];
        for (let c = 0; c < q.n; c++, j += pace) {
          if (!st) continue;
          lists[st.unloader].push(j + this.fwd(l.slot, this.unloaders[st.unloader].slot));
        }
      });
    });
    return this.unloaders.map((u, i) => {
      const arr = lists[i].sort((a, b) => a - b);
      return { u: i, arr, taken: new Set(arr), last: -u.sinceUnload, misses: this.simUnloader(arr, -u.sinceUnload).misses };
    });
  }

  // Unloader takes a cone only if unloadSlots pitches have passed since its last one; others pass by (return).
  simUnloader(arr, last) {
    const need = this.d.unloadSlots;
    let misses = 0;
    let lastTake = last;
    let lastIdx = 0;
    const missIdx = [];
    for (const i of arr) {
      if (i - lastTake >= need) { lastTake = i; lastIdx = Math.max(lastIdx, i); } else { misses += 1; missIdx.push(i); }
    }
    return { misses, lastIdx, missIdx };
  }

  // Forecast of one new loading stream: n cones from loader l to unloader u, one every `pace` baskets
  planStream(l, uIdx, n, pace, base) {
    const b = base[uIdx];
    const travel = this.fwd(l.slot, this.unloaders[uIdx].slot);
    const mine = [];
    let j = this.loaderFirstIdx(l, pace);
    for (let c = 0; c < n; c++, j += pace) {
      let a = j + travel;
      while (b.taken.has(a) || mine.includes(a)) a += 1; // that basket is already full → next one
      mine.push(a);
    }
    const all = [...b.arr, ...mine].sort((x, y) => x - y);
    const sim = this.simUnloader(all, b.last);
    const lastNew = mine.length ? mine[mine.length - 1] : 0;
    return {
      u: uIdx, pace, n, arr: mine,
      incMisses: Math.max(0, sim.misses - b.misses),
      firstSec: this.secOf(mine[0] || 0),
      lastSec: this.secOf(lastNew),
      travelSec: travel * this.d.slotTime,
      busyUntilSec: this.secOf(b.arr.length ? b.arr[b.arr.length - 1] : 0),
    };
  }

  commitStream(base, plan) {
    const b = base[plan.u];
    plan.arr.forEach((a) => b.taken.add(a));
    b.arr = [...b.arr, ...plan.arr].sort((x, y) => x - y);
    b.misses = this.simUnloader(b.arr, b.last).misses;
  }

  // Station options for a lot: the best station on each unloader
  routeOptions(v, lot, exclude = new Set(), reserve = 0) {
    const have = this.stationsFor(v, lot);
    const freeCount = this.stations.filter((st) => st.status === 'FREE' && !exclude.has(st.idx)).length;
    const opts = [];
    this.unloaders.forEach((u, j) => {
      const own = have.filter((st) => st.unloader === j).sort((a, b) => a.idx - b.idx)[0];
      if (own) { opts.push({ u: j, station: own, take: [], kind: 'OWN', reason: `${own.id} on ${u.id} (already collects this lot)` }); return; }
      const free = this.stations.find((st) => st.unloader === j && st.status === 'FREE' && !exclude.has(st.idx));
      if (free && (!have.length || freeCount - 1 >= reserve)) { opts.push({ u: j, station: free, take: [free], kind: 'FREE', reason: `${free.id} on ${u.id} (free station)` }); return; }
      if (have.length) return; // the lot already has a station elsewhere — do not change over a pallet for a second one
      const held = this.stations.filter((st) => st.unloader === j && st.status === 'HELD' && !exclude.has(st.idx)).sort((a, b) => (a.pallet + a.acc) - (b.pallet + b.acc))[0];
      if (held) opts.push({ u: j, station: held, take: [held], kind: 'HELD', reason: `${held.id} on ${u.id} (changed over from ${varietyInfo(held.variety).name}, ${held.pallet + held.acc} cones dispatched)` });
    });
    return opts;
  }

  // ── Permits ──────────────────────────────────────────────────────────────
  grantPermit(l, meta = {}) {
    const k = this.k();
    const wait = l.eligibleSince !== null ? this.t - l.eligibleSince : 0;
    k.permits += 1; k.waitTotal += wait; k.waitCount += 1; k.maxWait = Math.max(k.maxWait, wait);
    l.permit = true;
    l.permitSince = this.t;
    l.eligibleSince = null;
    l.batch = l.count;
    l.decidedBy = meta.by || 'FIFO';
    l.paceSlots = Math.max(this.d.loadSlots, meta.pace || this.d.loadSlots);
    l.targets = {};
    (meta.routes || []).forEach(({ lot, route }) => { l.targets[lot] = this.applyRoute(l.variety, lot, route).idx; });
  }

  revokePermit(l, why) {
    l.permit = false;
    l.paceSlots = this.d.loadSlots;
    l.permitSince = null;
    if (l.count > 0) l.eligibleSince = this.t;
    this.log('WARNING', `${l.id} permit withdrawn: ${why}.`);
  }

  // FIFO — customer specification: strict order of reaching the count
  fifoCycle() {
    const { cfg } = this;
    const queue = this.loaders.filter((l) => !l.permit && l.eligibleSince !== null).sort((a, b) => a.eligibleSince - b.eligibleSince || a.idx - b.idx);
    let loading = this.loaders.filter((l) => l.permit).length;
    for (const l of queue) {
      if (loading >= cfg.maxLoadsAtOnce) break;
      const occ = this.occupancy();
      if (!occ.has(l.variety) && occ.size >= cfg.maxVarietiesOnLoop) break; // head of line blocks everyone behind
      const lots = [...new Set(l.queue.filter((q) => q.n > 0).map((q) => q.lot))];
      const load = this.streamLoad();
      const routes = lots.map((lot) => ({ lot, route: this.routeLot(l.variety, lot, load, new Set(), { spread: false }) }));
      if (routes.some((r) => !r.route.ok)) break;
      this.grantPermit(l, { by: 'FIFO', routes });
      loading += 1;
      this.log('INFO', `FIFO permit: ${l.id} (${this.varieties[l.variety].name}) loads ${l.count} cones.`);
    }
  }

  brainCycle() {
    const snap = this.brain.decide(this);
    snap.actions.forEach((a) => {
      const l = this.loaders[a.loaderIdx];
      if (a.type === 'PERMIT') {
        this.grantPermit(l, { by: 'BRAIN', routes: a.routes, pace: a.pace });
        this.log('SUCCESS', `🧠 BRAIN: ${a.explanation}`);
      } else if (a.type === 'REVOKE') {
        this.revokePermit(l, a.explanation);
      }
    });
    snap.notes.forEach((n) => this.log('WARNING', `🧠 BRAIN: ${n}`));
    this.lastCycle = snap;
    if (snap.candidates.length) this.lastActiveCycle = snap;
    if (snap.actions.length || snap.notes.length) {
      this.pulse = this.t;
      this.decisions.unshift({ id: `D${snap.cycleId}`, t: this.t, snapshot: snap });
      if (this.decisions.length > 80) this.decisions.length = 80;
    }
  }

  // ── Chain movement and station work ──────────────────────────────────────
  moveChain(k) {
    const { cfg, d } = this;
    if (cfg.stationMode === 'ON_THE_FLY') {
      this.loaders.forEach((l) => { if (l.cooldown > 0) l.cooldown -= 1; });
      this.unloaders.forEach((u) => { if (u.cooldown > 0) u.cooldown -= 1; });
    }
    if (cfg.stationMode === 'CHAIN_STOP' && this.dwell > 0) {
      this.dwell -= 1;
      return;
    }
    this.chainFrac += 1 / d.slotTime;
    while (this.chainFrac >= 1) {
      this.chainFrac -= 1;
      this.chainIdx = (this.chainIdx + 1) % d.slots;
      this.rfidReads();
      const work = this.arrive(k);
      if (cfg.stationMode === 'CHAIN_STOP' && work > 0) {
        this.dwell = work;
        this.chainFrac = 0;
        break;
      }
    }
  }

  // One pitch moved: count the pulse and read the tags in front of every reader
  rfidReads() {
    const r = this.rfid;
    r.pulses += 1;
    const b0 = this.basketAt(0);
    if (b0) {
      r.lastR0 = { idx: b0.idx, id: b0.id, pulse: r.pulses, t: this.t };
      r.reads += 1;
      if (b0.idx === 0) {
        // Home check: B001 must come back after exactly one loop of pulses
        r.loops += 1;
        r.homeChecks += 1;
        const ok = r.pulses % this.d.slots === 0;
        if (!ok) r.homeErrors += 1;
        r.lastHome = { t: this.t, ok, pulses: r.pulses };
        this.log(ok ? 'INFO' : 'ERROR', ok
          ? `R0 home check: B001 read after ${this.d.slots} pulses — loop ${r.loops} OK, tracking in sync.`
          : `R0 home check FAILED: B001 read at pulse ${r.pulses} (not a multiple of ${this.d.slots}) — pulse missed, resync.`);
      }
    }
    const readAt = (id, slot) => { const b = this.basketAt(slot); if (b) r.stationReads[id] = { id: b.id, t: this.t }; };
    this.loaders.forEach((l) => readAt(l.id, l.slot));
    this.unloaders.forEach((u) => readAt(u.id, u.slot));
  }

  // Position of a basket rebuilt the PLC way: last tag read at R0 + order list + pulses since then
  trackedPitches(b) {
    const r = this.rfid;
    const S = this.d.slots;
    const ahead = ((r.lastR0.idx - b.idx) % S + S) % S;      // places ahead of the basket last read at R0
    return (ahead + (r.pulses - r.lastR0.pulse) + this.chainFrac) % S;
  }

  // A new basket is now in front of every station
  arrive(k) {
    const { cfg } = this;
    const onFly = cfg.stationMode === 'ON_THE_FLY';
    let work = 0;

    // Unloaders — old-lot baskets get priority at each unloader to clear them faster
    this.unloaders.forEach((u) => {
      u.sinceUnload += 1;
      if (onFly && (u.cooldown > 0 || u.sinceUnload < this.d.unloadSlots)) return;
      const b = this.basketAt(u.slot);
      if (!b || b.variety < 0) return;
      // Priority: if this basket is an old lot (after a lot change) and another new-lot basket
      // could wait, serve the old lot first to clear it faster
      const isOldLot = this.varieties[b.variety]?.lotChange && b.lot === this.varieties[b.variety].lotChange.oldLot;
      // A basket on its first pass goes to the station it was routed to; a returned basket to any matching one
      const st = this.stations.filter((s) => u.stations.includes(s.idx) && s.status === 'ACTIVE' && s.variety === b.variety && s.lot === b.lot
        && (b.laps > 0 || b.targetStation === null || b.targetStation === s.idx || this.stations[b.targetStation]?.variety !== b.variety))
        // Prefer the station that already has old-lot cones to keep the old-lot pallet together
        .sort((a, c) => (isOldLot ? (c.lot === b.lot ? 1 : 0) - (a.lot === b.lot ? 1 : 0) : 0) || (c.idx === b.targetStation) - (a.idx === b.targetStation) || c.acc - a.acc)[0];
      if (!st) return;
      const v = this.varieties[b.variety];
      v.unloaded += 1;
      k.unloaded += 1;
      u.unloaded += 1;
      u.lastStation = st.id;
      st.acc += 1;
      if (st.acc >= cfg.conesPerAccumulator) {
        st.pallet += st.acc;
        st.acc = 0;
        if (st.pallet >= cfg.conesPerPallet) {
          st.pallets += 1; k.pallets += 1;
          this.log('SUCCESS', `${st.id}: pallet complete (${st.pallet} cones of ${v.name} lot ${st.lot}) — dispatched.`);
          st.pallet = 0;
        }
      }
      b.variety = -1; b.lot = 0; b.loadedAt = null; b.laps = 0; b.targetStation = null;
      u.sinceUnload = 0;
      if (onFly) u.cooldown = cfg.unloadingTimeSec;
      work = Math.max(work, cfg.unloadingTimeSec);
    });

    // A loaded basket leaving the last unloader goes round again
    const passing = this.basketAt(this.lastUnloaderSlot);
    if (passing && passing.variety >= 0) {
      passing.laps += 1;
      this.varieties[passing.variety].returned += 1;
      k.returned += 1;
      if (passing.laps === 1 || passing.laps % 3 === 0) this.log('WARNING', `${passing.id} (${this.varieties[passing.variety].name}) passed all unloaders loaded — returned (lap ${passing.laps}).`);
    }

    // Loaders
    this.loaders.forEach((l) => {
      l.sinceLoad += 1;
      if (!l.permit || l.count <= 0) return;
      if (onFly && (l.cooldown > 0 || l.sinceLoad < Math.max(l.paceSlots, this.d.loadSlots))) return;
      const b = this.basketAt(l.slot);
      if (!b || b.variety >= 0) return;
      // Prioritize old-lot cones: if a lot change is active with HIGH priority,
      // load old-lot cones first to clear them from the buffer faster
      let q;
      if (cfg.lotChangePriority === 'HIGH' && this.varieties[l.variety]?.lotChange) {
        const oldLot = this.varieties[l.variety].lotChange.oldLot;
        q = l.queue.find((x) => x.n > 0 && x.lot === oldLot) || l.queue.find((x) => x.n > 0);
      } else {
        q = l.queue.find((x) => x.n > 0);
      }
      if (!q) return;
      let st = this.stations[l.targets[q.lot]];
      if (!st || st.variety !== l.variety || st.lot !== q.lot || st.status === 'FREE') st = this.stationsFor(l.variety, q.lot)[0];
      if (!st) return; // no pallet station for this lot yet
      q.n -= 1;
      l.count -= 1;
      l.queue = l.queue.filter((x) => x.n > 0);
      b.variety = l.variety; b.lot = q.lot; b.loadedAt = this.t; b.laps = 0; b.targetStation = st.idx;
      l.loadedTotal += 1;
      this.varieties[l.variety].loaded += 1;
      k.loaded += 1;
      l.sinceLoad = 0;
      if (onFly) l.cooldown = cfg.loadingTimeSec;
      work = Math.max(work, cfg.loadingTimeSec);
    });
    return work;
  }

  housekeeping() {
    // Finished batches release their permit (one of the 4Q places)
    this.loaders.forEach((l) => {
      if (l.permit && l.count <= 0) {
        l.permit = false;
        l.permitSince = null;
        l.paceSlots = this.d.loadSlots;
        this.log('INFO', `${l.id} finished its batch — loading place released.`);
      }
    });
    // Stations of varieties that left the loop keep their partial pallet (HELD)
    const occ = this.occupancy();
    this.stations.forEach((s) => {
      if (s.status === 'ACTIVE' && !occ.has(s.variety)) s.status = 'HELD';
      if (s.status === 'HELD' && occ.has(s.variety) && this.loaders.some((l) => l.permit && l.variety === s.variety)) s.status = 'ACTIVE';
    });
    // Lot change finished: old lot cleared from loaders and loop → close its pallet
    this.varieties.forEach((v) => {
      if (!v.lotChange) return;
      const r = this.lotRemaining(v.idx);
      if (r.total === 0) {
        this.stations.filter((s) => s.variety === v.idx && s.lot === r.lot).forEach((s) => {
          const cones = s.pallet + s.acc;
          if (cones > 0) { this.k().pallets += 1; }
          this.log('SUCCESS', `${s.id}: lot ${r.lot} of ${v.name} complete — last pallet (${cones} cones) dispatched, station free.`);
          Object.assign(s, { status: 'FREE', variety: -1, lot: 0, acc: 0, pallet: 0 });
        });
        this.log('SUCCESS', `LOT CHANGE ${v.name} complete — no cones of lot ${r.lot} left.`);
        v.lotChange = null;
      }
    });
  }

  refresh() {
    const occ = this.occupancy();
    this.activeVarieties = [...occ.keys()];
    const byVariety = Array.from({ length: this.cfg.varieties }, () => 0);
    let loadedOnLoop = 0;
    this.baskets.forEach((b) => { if (b.variety >= 0) { byVariety[b.variety] += 1; loadedOnLoop += 1; } });
    this.onLoopByVariety = byVariety;
    this.stats = {
      loadedOnLoop,
      emptyOnLoop: this.baskets.length - loadedOnLoop,
      returningNow: this.baskets.filter((b) => b.variety >= 0 && b.laps > 0).length,
      loading: this.loaders.filter((l) => l.permit).length,
      waiting: this.loaders.filter((l) => !l.permit && l.eligibleSince !== null).length,
      stopped: this.loaders.filter((l) => l.stopped).length,
      chainStopped: this.cfg.stationMode === 'CHAIN_STOP' && this.dwell > 0,
    };
  }

  // Snapshot for React (new object identity each call)
  view() {
    return {
      t: this.t,
      mode: this.mode,
      brainOnline: this.brainOnline,
      chainIdx: this.chainIdx,
      chainFrac: this.chainFrac,
      dwell: this.dwell,
      baskets: this.baskets,
      loaders: this.loaders,
      unloaders: this.unloaders,
      stations: this.stations,
      varieties: this.varieties.map((v) => ({ ...v, remaining: this.lotRemaining(v.idx) })),
      activeVarieties: this.activeVarieties,
      onLoopByVariety: this.onLoopByVariety,
      stats: this.stats,
      kpi: this.kpi,
      events: this.events,
      decisions: this.decisions,
      lastCycle: this.lastCycle,
      lastActiveCycle: this.lastActiveCycle,
      pulse: this.pulse,
      weights: this.brain.weights,
      rfid: { ...this.rfid, stationReads: { ...this.rfid.stationReads } },
      varietyLimit: this.varietyLimit(),
      varietyLimitAuto: this.strategy() === 'BRAIN' && this.cfg.varietyLimitMode === 'AUTO',
    };
  }
}

export function summarize(k, nLoaders = 16) {
  const h = Math.max(k.simSec, 1) / 3600;
  return {
    simSec: k.simSec,
    loadedPerHour: +(k.loaded / h).toFixed(1),
    unloadedPerHour: +(k.unloaded / h).toFixed(1),
    returnedPerHour: +(k.returned / h).toFixed(1),
    avgWait: k.waitCount ? +(k.waitTotal / k.waitCount / 60).toFixed(1) : 0,
    maxWait: +(k.maxWait / 60).toFixed(1),
    stopPct: +((k.stopSec / (Math.max(k.simSec, 1) * nLoaders)) * 100).toFixed(2),
    stopEvents: k.stopEvents,
    pallets: k.pallets,
    partialPallets: k.partialPallets,
  };
}

// Head-less head-to-head from the same starting plant
export function compareStrategies(derived, seconds = 4 * 3600, weights = DYN_WEIGHTS) {
  const run = (mode) => {
    const e = new DynamicEngine(derived, { mode, silent: true, weights });
    for (let i = 0; i < seconds; i++) e.tick();
    return summarize(e.kpi[mode], e.loaders.length);
  };
  return { seconds, FIFO: run('FIFO'), BRAIN: run('BRAIN') };
}
