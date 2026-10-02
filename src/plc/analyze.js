// Checks a decoded PLC snapshot against the plant setup and works out the
// information outputs (category-wise packages in OHC, returned, lot change remaining).
export function analyzeSnapshot(d, snap, prev) {
  const cfg = d.cfg;
  const checks = [];
  const add = (level, msg) => checks.push({ level, msg });
  const s = snap.system;
  const vName = (code) => (code >= 1 && code <= cfg.varieties ? cfg.varietyName[code - 1] : code === 0 ? '—' : `code ${code}?`);

  // System
  if (prev && prev.snap && prev.snap.system.plcHeartbeat === s.plcHeartbeat && Date.now() - prev.at > 3000) add('error', 'PLC heartbeat has not changed for more than 3 s — PLC program stopped or communication frozen.');
  if (s.chainRunning && Math.abs(s.speed - cfg.speedMPerMin) > cfg.speedMPerMin * 0.1) add('warn', `Chain speed ${s.speed} m/min differs from the setup (${cfg.speedMPerMin} m/min) by more than 10%.`);
  if (s.r0Basket > cfg.basketCount) add('error', `R0 reports basket ${s.r0Basket}, but the setup has only ${cfg.basketCount} baskets.`);
  if (prev && prev.snap && s.pulses < prev.snap.system.pulses) {
    // 32-bit rollover: pulsesHi wraps at 65535, total wraps at 4,294,901,760
    const gap = prev.snap.system.pulses - s.pulses;
    if (gap < 60000) {
      // Small backward step → likely a genuine counter error, not rollover
      add('warn', 'Pulse counter went backwards.');
    }
    // else: large gap is a normal 32-bit rollover — no warning needed
  }
  if (s.homeCheck === 2) add('error', 'R0 home check error — a pitch pulse was missed; positions must be resynchronised.');
  if (s.faultWord) add('error', `PLC fault word = ${s.faultWord} (${['e-stop', 'chain', 'RFID R0', 'comms'].filter((_, i) => s.faultWord & (1 << i)).join(', ') || 'unknown bit'}).`);

  // Loaders
  snap.loaders.forEach((l, i) => {
    const id = `L${String(i + 1).padStart(2, '0')}`;
    const setupV = cfg.loaderVariety[i] + 1;
    if (l.variety !== setupV) add('warn', `${id}: PLC says variety ${vName(l.variety)}, setup says ${vName(setupV)}.`);
    if (l.cones > cfg.loaderBufferCones) add('warn', `${id}: ${l.cones} cones waiting — more than the buffer in the setup (${cfg.loaderBufferCones}).`);
    if (l.status === 3) add('warn', `${id}: loader fault.`);
    if (l.basketInFront > cfg.basketCount) add('error', `${id}: basket ID ${l.basketInFront} out of range.`);
  });
  snap.unloaders.forEach((u, j) => { if (u.status === 2) add('warn', `U${String(j + 1).padStart(2, '0')}: unloader fault.`); });
  snap.stations.forEach((p, k) => {
    const id = `P${String(k + 1).padStart(2, '0')}`;
    if (p.variety > cfg.varieties) add('error', `${id}: variety code ${p.variety} does not exist in the setup.`);
    if (p.acc >= cfg.conesPerAccumulator && p.acc > 0) add('warn', `${id}: accumulator shows ${p.acc} cones (row is ${cfg.conesPerAccumulator}).`);
    if (p.pallet > cfg.conesPerPallet) add('warn', `${id}: ${p.pallet} cones on pallet — more than ${cfg.conesPerPallet}.`);
  });
  let badTarget = 0;
  snap.baskets.forEach((b) => { if (b.state && (b.target < 1 || b.target > cfg.palletStations)) badTarget += 1; });
  if (badTarget) add('warn', `${badTarget} loaded basket(s) without a valid target station.`);

  // Information outputs
  const inOhc = Array.from({ length: cfg.varieties }, () => 0);
  const returned = Array.from({ length: cfg.varieties }, () => 0);
  const currentLot = Array.from({ length: cfg.varieties }, (_, v) => Math.max(0, ...snap.loaders.filter((l) => l.variety === v + 1).map((l) => l.lot)));
  const lotRemaining = Array.from({ length: cfg.varieties }, () => 0);
  snap.baskets.forEach((b) => {
    if (!b.state || b.variety < 1 || b.variety > cfg.varieties) return;
    inOhc[b.variety - 1] += 1;
    if (b.state === 2) returned[b.variety - 1] += 1;
    if (currentLot[b.variety - 1] && b.lot < currentLot[b.variety - 1]) lotRemaining[b.variety - 1] += 1;
  });
  snap.loaders.forEach((l) => { if (l.variety >= 1 && l.variety <= cfg.varieties) lotRemaining[l.variety - 1] += l.oldLotCones; });
  snap.stations.forEach((p) => { if (p.variety >= 1 && p.variety <= cfg.varieties && currentLot[p.variety - 1] && p.lot < currentLot[p.variety - 1]) lotRemaining[p.variety - 1] += p.acc; });

  const loaded = inOhc.reduce((a, b) => a + b, 0);
  return {
    checks,
    info: { inOhc, returned, lotRemaining, loaded, empty: snap.baskets.length - loaded, varietiesOnLoop: inOhc.filter((n) => n > 0).length },
    vName,
  };
}

// Position (m from R0) of a basket from the PLC data: same rule as the brain uses
export function basketPositionM(d, snap, basketIdx) {
  const S = d.slots;
  const r0 = snap.system.r0Basket - 1;
  if (r0 < 0) return null;
  const ahead = (((r0 - basketIdx) % S) + S) % S;
  return (ahead + snap.system.encoder) * d.pitch;
}
