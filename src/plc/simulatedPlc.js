// ═══════════════════════════════════════════════════════════════════════════
// Simulated PLC — random but consistent values built from the plant setup.
// It behaves like a simple plant running plain FIFO: autoconers fill the loaders
// at their cones/h (with random variation), the chain moves one pitch per
// slotTime, loaders load passing empty baskets, unloaders empty baskets routed to
// their stations, pallets fill and are dispatched. Its output is exactly what the
// real PLC is expected to put in the Modbus registers (see registerMap.js).
// Pure JavaScript — used by the web page (Simulation mode) and plc-simulator.js.
// ═══════════════════════════════════════════════════════════════════════════
import { derive, normaliseConfig } from '../dynamic/config.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSimPlc(cfgIn, { seed = 12345, variation = 0.25 } = {}) {
  const d = derive(normaliseConfig(cfgIn));
  const cfg = d.cfg;
  const R = rng(seed);
  const S = d.slots;
  const nB = cfg.basketCount;
  const between = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const usedVarieties = [...new Set(cfg.loaderVariety)];

  const st = {
    t: 0,
    heartbeat: 0,
    pulses: Math.floor(R() * S),
    frac: 0,
    running: true,
    stopLeft: 0,
    loops: 0,
    homeCheck: 0,
  };

  // Pallet stations: spread the varieties that have loaders over the stations
  const stations = Array.from({ length: cfg.palletStations }, (_, k) => {
    const v = k < usedVarieties.length ? usedVarieties[k] : -1;
    const active = v >= 0 && R() > 0.1;
    const acc = active ? Math.floor(R() * cfg.conesPerAccumulator) : 0;
    const rows = active ? Math.floor(R() * (cfg.conesPerPallet / cfg.conesPerAccumulator)) : 0;
    return {
      unloader: d.stationUnloader[k], status: v < 0 ? 0 : active ? 1 : 2, variety: v, lot: v >= 0 ? cfg.varietyLot[v] : 0,
      acc, pallet: rows * cfg.conesPerAccumulator, palletPresent: 1, palletsDone: Math.floor(R() * 5),
    };
  });
  const stationFor = (v) => {
    let s = stations.findIndex((x) => x.variety === v && x.status === 1);
    if (s < 0) s = stations.findIndex((x) => x.variety === v);
    if (s < 0) {
      s = stations.findIndex((x) => x.status === 0);
      if (s >= 0) Object.assign(stations[s], { variety: v, lot: cfg.varietyLot[v], status: 1, acc: 0, pallet: 0 });
    }
    if (s >= 0) stations[s].status = 1;
    return s;
  };

  // Baskets: about as many loaded as production needs, varieties of the loaders
  const loadedShare = Math.min(0.8, d.productionPerHour / Math.max(1, d.basketPassesPerHour) * between(0.8, 1.3));
  const baskets = Array.from({ length: nB }, () => {
    if (R() > loadedShare) return { state: 0, variety: -1, lot: 0, target: -1 };
    const v = pick(usedVarieties);
    const target = stations.findIndex((x) => x.variety === v);
    return { state: R() < 0.05 ? 2 : 1, variety: v, lot: cfg.varietyLot[v], target };
  });

  const loaders = cfg.loaderVariety.map((v, i) => ({
    variety: v, lot: cfg.varietyLot[v], slot: d.loaderSlots[i], rate: d.loaderRate[i] * between(1 - variation, 1 + variation),
    cones: Math.floor(R() * cfg.loaderBufferCones * 0.7), carry: 0, status: 0, stopped: 0, loadedCount: Math.floor(R() * 2000),
    since: 99, oldLotCones: 0,
  }));
  const unloaders = d.unloaderSlots.map((slot) => ({ slot, status: 0, busyLeft: 0, unloadedCount: Math.floor(R() * 5000), cycleX10: Math.round(cfg.unloadingTimeSec * 10), since: 99 }));
  const lastU = Math.max(...d.unloaderSlots);

  // basket index at a chain position: basket k sits at (pulses − k) mod S
  const basketAt = (pos) => {
    const k = (((Math.floor(st.pulses) - pos) % S) + S) % S;
    return k < nB ? k : -1;
  };

  function pitch() {
    st.pulses += 1;
    // origin reader R0 at position 0
    if (basketAt(0) === 0) { st.loops += 1; st.homeCheck = 1; }
    // unloaders
    unloaders.forEach((u, j) => {
      u.since += 1;
      if (u.busyLeft > 0 || u.since < d.unloadSlots) return;
      const k = basketAt(u.slot);
      if (k < 0) return;
      const b = baskets[k];
      if (b.state === 0 || b.target < 0 || stations[b.target]?.unloader !== j) return;
      const s = stations[b.target];
      s.acc += 1;
      if (s.acc >= cfg.conesPerAccumulator) { s.pallet += s.acc; s.acc = 0; }
      if (s.pallet >= cfg.conesPerPallet) { s.palletsDone += 1; s.pallet = 0; }
      Object.assign(b, { state: 0, variety: -1, lot: 0, target: -1 });
      u.unloadedCount = (u.unloadedCount + 1) % 65536;
      u.since = 0;
      u.busyLeft = cfg.unloadingTimeSec;
      u.cycleX10 = Math.round(cfg.unloadingTimeSec * between(9.5, 10.8));
    });
    // passing the last unloader loaded → returned
    const kr = basketAt(lastU);
    if (kr >= 0 && baskets[kr].state === 1) baskets[kr].state = 2;
    // loaders
    loaders.forEach((l) => {
      l.since += 1;
      if (l.status !== 2 || l.since < d.loadSlots) return;
      const k = basketAt(l.slot);
      if (k < 0 || baskets[k].state !== 0) return;
      const target = stationFor(l.variety);
      if (target < 0) return;
      Object.assign(baskets[k], { state: 1, variety: l.variety, lot: l.lot, target });
      l.cones -= 1;
      if (l.oldLotCones > 0) l.oldLotCones -= 1;
      l.loadedCount = (l.loadedCount + 1) % 65536;
      l.since = 0;
    });
  }

  function step(dt = 1) {
    st.t += dt;
    st.heartbeat = (st.heartbeat + 1) % 65536;
    // occasional short chain stop
    if (st.stopLeft > 0) { st.stopLeft -= dt; st.running = st.stopLeft <= 0; } else if (R() < 0.0015 * dt) { st.stopLeft = Math.round(between(5, 25)); st.running = false; }
    // autoconers fill the loaders
    loaders.forEach((l) => {
      if (l.cones >= cfg.loaderBufferCones) { l.stopped = 1; return; }
      l.stopped = 0;
      l.carry += (l.rate * dt) / 3600 * between(0.5, 1.5);
      while (l.carry >= 1 && l.cones < cfg.loaderBufferCones) { l.carry -= 1; l.cones += 1; }
    });
    // loading permits: first come first served within the limits (like the PLC's FIFO)
    let loading = loaders.filter((l) => l.status === 2).length;
    const onLoop = new Set(baskets.filter((b) => b.state !== 0).map((b) => b.variety));
    loaders.forEach((l) => { if (l.status === 2) onLoop.add(l.variety); });
    loaders.forEach((l) => {
      if (l.status === 2 && l.cones <= 0) { l.status = 0; loading -= 1; }
      if (l.status === 2) return;
      l.status = l.cones >= cfg.conesPerAccumulator ? 1 : 0;
      if (l.status === 1 && loading < cfg.maxLoadsAtOnce && (onLoop.has(l.variety) || onLoop.size < cfg.maxVarietiesOnLoop)) {
        l.status = 2; loading += 1; onLoop.add(l.variety);
      }
    });
    unloaders.forEach((u) => { if (u.busyLeft > 0) u.busyLeft -= dt; u.status = u.busyLeft > 0 ? 1 : 0; });
    // chain
    if (st.running) {
      st.frac += dt / d.slotTime * between(0.98, 1.02);
      while (st.frac >= 1) { st.frac -= 1; pitch(); }
      // Drift correction: snap near-zero fractions to prevent cumulative float error
      // that would cause false home-check failures on long runs
      if (st.frac < 1e-6) st.frac = 0;
    }
  }

  function snapshot() {
    const pulses = Math.floor(st.pulses);
    const r0 = basketAt(0);
    return {
      system: {
        plcHeartbeat: st.heartbeat, plcMode: 1, chainRunning: st.running ? 1 : 0,
        speedX10: st.running ? Math.round(cfg.speedMPerMin * 10 * between(0.98, 1.02)) : 0,
        pulsesHi: Math.floor(pulses / 65536) % 65536, pulsesLo: pulses % 65536,
        r0Basket: r0 >= 0 ? r0 + 1 : 0, encoderX1000: Math.round(st.frac * 1000) % 1000,
        faultWord: 0, homeCheck: st.homeCheck, loops: st.loops % 65536,
      },
      loaders: loaders.map((l) => {
        const k = basketAt(l.slot);
        return { cones: l.cones, oldLotCones: l.oldLotCones, status: l.status, stopped: l.stopped, variety: l.variety + 1, lot: l.lot, loadedCount: l.loadedCount, basketInFront: k >= 0 ? k + 1 : 0 };
      }),
      unloaders: unloaders.map((u) => {
        const k = basketAt(u.slot);
        return { status: u.status, basketInFront: k >= 0 ? k + 1 : 0, unloadedCount: u.unloadedCount, cycleX10: u.cycleX10 };
      }),
      stations: stations.map((s) => ({ status: s.status, variety: s.variety + 1, lot: s.lot, acc: s.acc, pallet: s.pallet, palletPresent: s.palletPresent, palletsDone: s.palletsDone })),
      baskets: baskets.map((b) => ({ state: b.state, variety: b.variety + 1, lot: b.lot, target: b.target + 1 })),
    };
  }

  // Warm up so the plant looks like it has been running
  for (let i = 0; i < 600; i++) step(1);

  return { step, snapshot, derived: d };
}
