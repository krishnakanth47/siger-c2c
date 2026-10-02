// ═══════════════════════════════════════════════════════════════════════════
// SIEGER OHC — configurable plant model
// Defaults are the customer values from Requirements.xlsx. Every value can be
// changed on the setup page before the simulation is built.
// ═══════════════════════════════════════════════════════════════════════════

export const VARIETY_PALETTE = [
  { name: '34s SCHY', color: '#22d3ee' },
  { name: '40s Compact', color: '#a855f7' },
  { name: '30s Carded', color: '#3b82f6' },
  { name: '24s Slub', color: '#10b981' },
  { name: '60s Combed', color: '#ec4899' },
  { name: '20s OpenEnd', color: '#f59e0b' },
  { name: '50s Modal', color: '#14b8a6' },
  { name: '80s Micro', color: '#8b5cf6' },
  { name: '32s PC', color: '#ef4444' },
  { name: '40s CVC', color: '#84cc16' },
];

// Names typed on the setup page override the palette names everywhere
let NAME_OVERRIDE = [];
export const setVarietyNames = (names) => { NAME_OVERRIDE = Array.isArray(names) ? names : []; };
export const defaultVarietyName = (i) => VARIETY_PALETTE[i]?.name || `Variety ${i + 1}`;
export const varietyInfo = (i) => {
  const base = VARIETY_PALETTE[i] || { name: `Variety ${i + 1}`, color: `hsl(${(i * 47) % 360} 80% 60%)` };
  const nm = NAME_OVERRIDE[i];
  return nm && String(nm).trim() ? { ...base, name: String(nm).trim() } : base;
};

export const defaultLoaderVarieties = (loaders, varieties) =>
  Array.from({ length: loaders }, (_, i) => i % Math.max(1, varieties));

export const DEFAULT_CONFIG = {
  // Production
  packagesPerHour: 380,        // design throughput of the OHC system (packages/h)
  varieties: 10,
  conesPerHourPerVariety: 35,  // autoconer output per variety (cones/h)
  loaderBufferCones: 20,       // cones a loader can hold before its autoconer must stop
  loadingCountMode: 'AUTO',    // AUTO = brain decides the triggering count, MANUAL = fixed count
  manualTriggerCount: 5,
  // Conveyor
  basketCount: 380,
  pitchMm: 800,
  speedMPerMin: 10,
  loopLengthM: 0,              // 0 = automatic: pitch × baskets
  distanceToUnloaderM: 0,      // 0 = automatic: centre of the ring = pitch × baskets / 2 (measured from L01)
  originToL01M: 0.8,           // R0 = RFID reference reader (origin, 0 m). Distance from R0 forward to L01
  positionMode: 'SPACING',     // SPACING = from R0→L01, spacings and distance to unloader; LAYOUT = every station entered in m from R0
  loaderPosM: [],
  unloaderPosM: [],
  stationMode: 'ON_THE_FLY',   // ON_THE_FLY: chain never stops, times are station cycle times; CHAIN_STOP: chain stops for each load/unload
  // Stations
  loaderCount: 16,
  loaderSpacingM: 6.4,
  loadingTimeSec: 20,
  unloaderCount: 4,
  unloaderSpacingM: 8,
  unloadingTimeSec: 18,
  palletStations: 11,
  conesPerAccumulator: 5,      // 4 or 5, from the pallet matrix
  conesPerPallet: 100,
  // Decision rules
  loaderStartRule: 'BOTH',     // which loader starts: DEMAND (autoconer side), UNLOADER (unloader / pallet side) or BOTH
  lotChangePriority: 'HIGH',   // HIGH = old-lot cones after a lot change are loaded first
  // Limits
  maxLoadsAtOnce: 4,           // the old "4Q"
  maxVarietiesOnLoop: 4,        // customer spec ("4 variants at a time") — used by FIFO, and by the brain in FIXED mode
  varietyLimitMode: 'AUTO',    // AUTO = brain decides how many varieties from free pallet stations + unloader forecast
  // Per variety (index = variety). Empty → filled from the values above.
  varietyName: [],
  varietyRate: [],             // cones/h per variety
  varietyLot: [],              // current lot number per variety
  varietyDemand: [],           // high demand (priority) per variety
  // Loader → variety (index into varieties)
  loaderVariety: defaultLoaderVarieties(16, 10),
};

const F = {
  packagesPerHour: { key: 'packagesPerHour', label: 'Package / hour', unit: 'pkg/h', min: 1, max: 5000, step: 1 },
  varieties: { key: 'varieties', label: 'No of variants', unit: '', min: 1, max: 20, step: 1 },
  loadingTimeSec: { key: 'loadingTimeSec', label: 'Loading time / package', unit: 's', min: 1, max: 600, step: 1 },
  unloadingTimeSec: { key: 'unloadingTimeSec', label: 'Unloading time / package', unit: 's', min: 1, max: 600, step: 1 },
  loopLengthM: { key: 'loopLengthM', label: 'OHC loop length', unit: 'm', min: 0, max: 5000, step: 0.1, hint: '0 = automatic (pitch × baskets)' },
  speedMPerMin: { key: 'speedMPerMin', label: 'Loop linear speed', unit: 'm/min', min: 0.5, max: 120, step: 0.5 },
  distanceToUnloaderM: { key: 'distanceToUnloaderM', label: 'Distance to unloader', unit: 'm', min: 0, max: 5000, step: 0.1, hint: '0 = centre of the ring' },
  basketCount: { key: 'basketCount', label: 'No of baskets', unit: '', min: 10, max: 2000, step: 1 },
  pitchMm: { key: 'pitchMm', label: 'Pitch', unit: 'mm', min: 100, max: 5000, step: 10 },
  loaderCount: { key: 'loaderCount', label: 'No of loaders', unit: '', min: 1, max: 60, step: 1 },
  conesPerHourPerVariety: { key: 'conesPerHourPerVariety', label: 'Cones per hour per variant', unit: 'cones/h', min: 1, max: 1000, step: 1, hint: 'applies to all — change single variants in the variant table' },
  unloaderCount: { key: 'unloaderCount', label: 'No of unloaders', unit: '', min: 1, max: 20, step: 1 },
  lotChangePriority: { key: 'lotChangePriority', label: 'Lot change priority', type: 'select', options: [['HIGH', 'High priority — old-lot cones loaded first, own pallet'], ['NORMAL', 'Normal — own pallet, no extra priority']] },
  loadingCountMode: { key: 'loadingCountMode', label: 'Loading count', type: 'select', options: [['AUTO', 'Automatic — software decides the trigger'], ['MANUAL', 'Manual — fixed trigger count']] },
  manualTriggerCount: { key: 'manualTriggerCount', label: 'Manual trigger count', unit: 'cones', min: 1, max: 500, step: 1, showIf: (c) => c.loadingCountMode === 'MANUAL' },
  loaderStartRule: { key: 'loaderStartRule', label: 'Loader to start loading', type: 'select', options: [['BOTH', 'Demand + unloader requirement'], ['DEMAND', 'Based on demand (autoconer side)'], ['UNLOADER', 'Based on unloader requirement']] },
  conesPerAccumulator: { key: 'conesPerAccumulator', label: 'Cones per accumulator', type: 'select', options: [[4, '4 cones (matrix)'], [5, '5 cones (matrix)']] },
  palletStations: { key: 'palletStations', label: 'No of pallet stations', unit: '', min: 1, max: 60, step: 1 },
  // not in the sheet
  originToL01M: { key: 'originToL01M', label: 'Origin R0 (RFID reference reader) → L01', unit: 'm', min: 0, max: 200, step: 0.1, hint: 'R0 is 0 m and also the loop end; every position is measured forward from it' },
  positionMode: { key: 'positionMode', label: 'Station positions', type: 'select', options: [['SPACING', 'From R0 → L01, spacings and distance to unloader'], ['LAYOUT', 'From the layout — enter each station in m from R0']] },
  loaderBufferCones: { key: 'loaderBufferCones', label: 'Loader buffer (cones before the autoconer stops)', unit: 'cones', min: 1, max: 500, step: 1 },
  loaderSpacingM: { key: 'loaderSpacingM', label: 'Spacing between loaders', unit: 'm', min: 0.1, max: 100, step: 0.1 },
  unloaderSpacingM: { key: 'unloaderSpacingM', label: 'Spacing between unloaders', unit: 'm', min: 0.1, max: 100, step: 0.1 },
  conesPerPallet: { key: 'conesPerPallet', label: 'Cones per pallet', unit: 'cones', min: 4, max: 5000, step: 1 },
  stationMode: { key: 'stationMode', label: 'Loading / unloading', type: 'select', options: [['ON_THE_FLY', 'On the move — chain never stops'], ['CHAIN_STOP', 'Chain stops while a station works']] },
  maxLoadsAtOnce: { key: 'maxLoadsAtOnce', label: 'Max loaders loading at once (4Q)', unit: '', min: 1, max: 60, step: 1 },
  varietyLimitMode: { key: 'varietyLimitMode', label: 'Variants on the loop (brain)', type: 'select', options: [['AUTO', 'Automatic — brain decides from pallet stations + unloader time'], ['FIXED', 'Fixed limit (customer spec)']] },
  maxVarietiesOnLoop: { key: 'maxVarietiesOnLoop', label: 'Fixed variant limit (spec; FIFO always uses it)', unit: '', min: 1, max: 20, step: 1 },
};

// The rows of Requirements.xlsx, in the sheet's order. `sheet` = value written in the sheet.
export const REQUIREMENT_ROWS = [
  { no: 1, req: 'Package / hour', sheet: '380', fields: [F.packagesPerHour] },
  { no: 2, req: 'No of variant', sheet: '10', fields: [F.varieties], see: 'variants' },
  { no: 3, req: 'Loading time / package', sheet: '20 s', fields: [F.loadingTimeSec] },
  { no: 4, req: 'Unloading time / package', sheet: '18 s', fields: [F.unloadingTimeSec] },
  { no: 5, req: 'OHC loop length', sheet: '(blank)', fields: [F.loopLengthM] },
  { no: 6, req: 'Loop linear speed', sheet: '10 m/min', fields: [F.speedMPerMin] },
  { no: 7, req: 'Distance to unloader', sheet: 'Centre of the ring', fields: [F.distanceToUnloaderM] },
  { no: 8, req: 'No of baskets', sheet: '380', fields: [F.basketCount] },
  { no: 9, req: 'Pitch', sheet: '800 mm', fields: [F.pitchMm] },
  { no: 10, req: 'No of loaders', sheet: '16', fields: [F.loaderCount] },
  { no: 11, req: 'Cones per hour per variant', sheet: '35', fields: [F.conesPerHourPerVariety], see: 'variants' },
  { no: 12, req: 'Entry provision: loader vs variety (for all loaders)', sheet: 'Entry', special: 'loaders' },
  { no: 13, req: 'No of unloaders', sheet: '4', fields: [F.unloaderCount] },
  { no: 14, req: 'Lot change information for high priority assignment', sheet: 'Entry', fields: [F.lotChangePriority], see: 'variants' },
  { no: 15, req: 'Loading count', sheet: 'Automatic / Manual', fields: [F.loadingCountMode, F.manualTriggerCount] },
  { no: 16, req: 'Loader to start loading — variety selected based on demand or unloader requirement', sheet: 'Demand / Unloader', fields: [F.loaderStartRule], see: 'variants' },
  { no: 17, req: 'Cones per accumulator', sheet: '4 or 5 (matrix)', fields: [F.conesPerAccumulator] },
  { no: 18, req: 'No of pallet stations', sheet: '11', fields: [F.palletStations] },
  { no: 19, req: 'Information (dynamic)', sheet: 'Category-wise packages in OHC · packages returned after unloader · lot change remaining cones', special: 'info' },
];

export const EXTRA_FIELDS = [F.positionMode, F.originToL01M, F.loaderBufferCones, F.loaderSpacingM, F.unloaderSpacingM, F.conesPerPallet, F.stationMode, F.maxLoadsAtOnce, F.varietyLimitMode, F.maxVarietiesOnLoop];

export const ALL_FIELDS = [...REQUIREMENT_ROWS.flatMap((r) => r.fields || []), ...EXTRA_FIELDS];

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

// Keep the loader→variety table the right size when counts change
export function normaliseConfig(c) {
  const cfg = { ...DEFAULT_CONFIG, ...c };
  cfg.conesPerAccumulator = Number(cfg.conesPerAccumulator);
  const nLoaders = Math.max(0, Math.min(200, Math.round(Number(cfg.loaderCount) || 0)));
  const nVar = Math.max(1, Math.min(50, Math.round(Number(cfg.varieties) || 1)));
  const lv = Array.isArray(cfg.loaderVariety) ? cfg.loaderVariety.slice(0, nLoaders) : [];
  for (let i = lv.length; i < nLoaders; i++) lv.push(i % nVar);
  cfg.loaderVariety = lv.map((v) => clampInt(v, 0, nVar - 1));
  const fit = (arr, fill) => Array.from({ length: nVar }, (_, v) => (Array.isArray(arr) && arr[v] !== undefined && arr[v] !== null ? arr[v] : fill(v)));
  cfg.varietyName = fit(cfg.varietyName, defaultVarietyName).map((n, v) => (String(n).trim() ? String(n) : defaultVarietyName(v)));
  cfg.varietyRate = fit(cfg.varietyRate, () => cfg.conesPerHourPerVariety);
  cfg.varietyLot = fit(cfg.varietyLot, () => 1);
  cfg.varietyDemand = fit(cfg.varietyDemand, () => false).map(Boolean);
  // Layout positions (m from R0): keep one per station, default from the spacing rule
  const sp = spacingPositions(cfg);
  const fitPos = (arr, n, dflt) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && arr[i] !== undefined && arr[i] !== null ? arr[i] : dflt[i]));
  cfg.loaderPosM = fitPos(cfg.loaderPosM, nLoaders, sp.loaders);
  cfg.unloaderPosM = fitPos(cfg.unloaderPosM, Math.max(0, Math.round(Number(cfg.unloaderCount) || 0)), sp.unloaders);
  return cfg;
}

// Station positions in m from R0 using the spacing rule
export function spacingPositions(cfg) {
  const pitch = (Number(cfg.pitchMm) || 800) / 1000;
  const baskets = Number(cfg.basketCount) || 0;
  const origin = Math.max(0, Number(cfg.originToL01M) || 0);
  const dist = Number(cfg.distanceToUnloaderM) > 0 ? Number(cfg.distanceToUnloaderM) : (baskets * pitch) / 2;
  const r = (x) => Math.round(x * 10) / 10;
  return {
    loaders: Array.from({ length: Math.max(0, Math.round(Number(cfg.loaderCount) || 0)) }, (_, i) => r(origin + i * (Number(cfg.loaderSpacingM) || 0))),
    unloaders: Array.from({ length: Math.max(0, Math.round(Number(cfg.unloaderCount) || 0)) }, (_, j) => r(origin + dist + j * (Number(cfg.unloaderSpacingM) || 0))),
  };
}

// Everything the engine and the drawing need, derived from the inputs.
export function derive(cfgIn) {
  const cfg = normaliseConfig(cfgIn);
  setVarietyNames(cfg.varietyName);
  const rateOf = (v) => Math.max(0, Number(cfg.varietyRate[v]) || 0);
  const pitch = cfg.pitchMm / 1000;
  const speed = cfg.speedMPerMin / 60; // m/s
  const loopLength = cfg.loopLengthM > 0 ? cfg.loopLengthM : cfg.basketCount * pitch;
  const slots = Math.max(1, Math.round(loopLength / pitch));
  const slotTime = pitch / speed; // s for one basket pitch to pass a point
  const distToUnloader = cfg.distanceToUnloaderM > 0 ? cfg.distanceToUnloaderM : (cfg.basketCount * pitch) / 2;

  // Stations sit on basket positions (slots), counted forward from the origin R0 (slot 0).
  const origin = Math.max(0, Number(cfg.originToL01M) || 0);
  const layout = cfg.positionMode === 'LAYOUT';
  const loaderSlots = Array.from({ length: cfg.loaderCount }, (_, i) => Math.round((layout ? Number(cfg.loaderPosM[i]) || 0 : origin + i * cfg.loaderSpacingM) / pitch) % slots);
  const unloaderSlots = Array.from({ length: cfg.unloaderCount }, (_, j) => Math.round((layout ? Number(cfg.unloaderPosM[j]) || 0 : origin + distToUnloader + j * cfg.unloaderSpacingM) / pitch) % slots);
  // Position table measured from R0 — what the PLC stores after commissioning
  const stationTable = [
    { id: 'R0', kind: 'origin', slot: 0, m: 0, note: 'RFID reference reader — origin' },
    ...loaderSlots.map((sl, i) => ({ id: `L${String(i + 1).padStart(2, '0')}`, kind: 'loader', slot: sl, m: sl * pitch })),
    ...unloaderSlots.map((sl, j) => ({ id: `U${String(j + 1).padStart(2, '0')}`, kind: 'unloader', slot: sl, m: sl * pitch })),
    { id: 'END', kind: 'end', slot: slots, m: slots * pitch, note: 'back at R0 (one full loop)' },
  ];

  // Pallet stations are shared out among the unloaders in order (e.g. 11 over 4 → 3,3,3,2)
  const stationUnloader = Array.from({ length: cfg.palletStations }, (_, k) => Math.floor((k * cfg.unloaderCount) / cfg.palletStations));

  // Production per loader: a variety's output is split across its loaders
  const loadersPerVariety = Array.from({ length: cfg.varieties }, (_, v) => cfg.loaderVariety.filter((x) => x === v).length);
  const loaderRate = cfg.loaderVariety.map((v) => rateOf(v) / Math.max(1, loadersPerVariety[v]));
  const activeVarieties = loadersPerVariety.filter((n) => n > 0).length;
  const productionPerHour = Math.round(loadersPerVariety.reduce((s, n, v) => s + (n ? rateOf(v) : 0), 0));

  const loopSeconds = loopLength / speed;

  // ── Timing on the moving chain ─────────────────────────────────────────────
  // A station can only act when a basket is in front of it, i.e. every slotTime.
  // So its real cycle is its work time rounded UP to whole basket pitches.
  const onFly = cfg.stationMode === 'ON_THE_FLY';
  const eps = 1e-9;
  const loadSlots = onFly ? Math.max(1, Math.ceil(cfg.loadingTimeSec / slotTime - eps)) : 1;
  const unloadSlots = onFly ? Math.max(1, Math.ceil(cfg.unloadingTimeSec / slotTime - eps)) : 1;
  const loadCycleSec = onFly ? loadSlots * slotTime : cfg.loadingTimeSec + slotTime;
  const unloadCycleSec = onFly ? unloadSlots * slotTime : cfg.unloadingTimeSec + slotTime;
  // How many full-speed loading streams one unloader can absorb without missing a basket
  const streamCapacity = loadCycleSec / unloadCycleSec;
  const fwdM = (a, b) => ((((b - a) % slots) + slots) % slots) * pitch;
  const travel = loaderSlots.map((ls) => unloaderSlots.map((us) => fwdM(ls, us) / speed)); // s, loader i → unloader j
  const travelAll = travel.flat();
  const travelMinSec = travelAll.length ? Math.min(...travelAll) : 0;
  const travelMaxSec = travelAll.length ? Math.max(...travelAll) : 0;
  const lastUnloaderPos = unloaderSlots.length ? Math.max(...unloaderSlots) : 0;
  const returnSec = (slots - lastUnloaderPos) * slotTime; // last unloader → back to L01 (empty return)
  const lastLoaderM = Math.max(...loaderSlots) * pitch;
  const firstUnloaderM = Math.min(...unloaderSlots) * pitch;
  const travelToUnloaderSec = (distToUnloader - 0) / speed;
  const basketPassesPerHour = 3600 / slotTime;
  const loaderCapacity = cfg.loaderCount * (3600 / loadCycleSec);
  const unloaderCapacity = cfg.unloaderCount * (3600 / unloadCycleSec);

  // Variety-slot check: a variety holds a slot while it loads a batch and until its baskets
  // reach the unloaders. How many slots are needed to keep every autoconer running?
  const avgLoaderM = loaderSlots.reduce((a, b) => a + b, 0) / Math.max(1, loaderSlots.length) * pitch;
  const lastUnloaderM = Math.max(...unloaderSlots) * pitch;
  const transitSec = Math.max(0, lastUnloaderM - avgLoaderM) / speed;
  const effLoad = loadCycleSec;
  // Use newBatchPct for a more accurate batch size estimate (mirrors the brain's actual trigger)
  const batchFactor = Math.max(0.3, Math.min(1.0, (cfg.loadingCountMode === 'MANUAL' ? cfg.manualTriggerCount / cfg.loaderBufferCones : 0.5)));
  let slotHoursNeeded = 0;
  loadersPerVariety.forEach((n, v) => {
    if (!n) return;
    const batch = batchFactor * cfg.loaderBufferCones * n;
    const turnsPerHour = rateOf(v) / batch;
    const holdSec = (batch * effLoad) / n + transitSec + cfg.unloadingTimeSec;
    slotHoursNeeded += turnsPerHour * (holdSec / 3600);
  });
  const slotsNeeded = +slotHoursNeeded.toFixed(1);

  const warnings = [];
  const autoVar = cfg.varietyLimitMode === 'AUTO';
  if (autoVar && slotsNeeded > cfg.palletStations) warnings.push(`About ${slotsNeeded} varieties need to be on the loop at once to keep all autoconers running, but there are only ${cfg.palletStations} pallet stations (one per variety/lot). Expect autoconer stops.`);
  if (!autoVar && slotsNeeded > cfg.maxVarietiesOnLoop) warnings.push(`Variety slots: about ${slotsNeeded} are needed to keep all ${activeVarieties} varieties running (each holds a slot ~${Math.round(transitSec / 60)} min while its cones travel to the unloaders), but the limit is ${cfg.maxVarietiesOnLoop}. Expect autoconer stops — raise the limit or the loader buffer.`);
  const errors = [];
  if (cfg.basketCount > slots) errors.push(`${cfg.basketCount} baskets at ${cfg.pitchMm} mm need ${(cfg.basketCount * pitch).toFixed(1)} m of loop, but the loop is ${loopLength.toFixed(1)} m.`);
  // Explicit check: a manual loop length shorter than needed for the baskets
  if (cfg.loopLengthM > 0 && slots < cfg.basketCount) errors.push(`Manual loop length ${cfg.loopLengthM} m gives only ${slots} basket positions, but there are ${cfg.basketCount} baskets. Increase the loop length or reduce baskets.`);
  if (layout && [...cfg.loaderPosM, ...cfg.unloaderPosM].some((x) => x === '' || Number(x) < 0 || Number(x) >= loopLength)) errors.push(`Every layout position must be between 0 and ${loopLength.toFixed(1)} m (the loop length).`);
  if (!layout && origin + (cfg.loaderCount - 1) * cfg.loaderSpacingM >= loopLength) errors.push('R0 → L01 distance plus the loaders does not fit on the loop.');
  if (lastLoaderM >= firstUnloaderM) errors.push(`The loaders (up to ${lastLoaderM.toFixed(1)} m) overlap the unloaders (from ${firstUnloaderM.toFixed(1)} m). Reduce loader spacing or increase the distance to the unloader.`);
  if (Math.max(...unloaderSlots) * pitch >= loopLength) errors.push('The last unloader lies beyond the end of the loop.');
  if (new Set(loaderSlots).size < loaderSlots.length) errors.push('Two loaders share the same basket position — increase loader spacing.');
  if (new Set(unloaderSlots).size < unloaderSlots.length) errors.push('Two unloaders share the same basket position — increase unloader spacing.');
  if (productionPerHour > cfg.packagesPerHour) warnings.push(`Autoconer output (${productionPerHour}/h) is above the design ${cfg.packagesPerHour} packages/h.`);
  if (productionPerHour > unloaderCapacity) warnings.push(`Unloader capacity (${Math.round(unloaderCapacity)}/h) is below autoconer output (${productionPerHour}/h) — cones will pile up.`);
  if (productionPerHour > basketPassesPerHour) warnings.push(`Only ${Math.round(basketPassesPerHour)} baskets/h pass the loaders — below output (${productionPerHour}/h).`);
  if (streamCapacity < 1) warnings.push(`One unloader needs ${unloadCycleSec.toFixed(1)} s per cone but one loader sends a cone every ${loadCycleSec.toFixed(1)} s — a single loading stream is faster than an unloader. The brain will pace loaders (skip baskets) so no cone is missed.`);
  // Speed sanity: if the chain moves faster than one pitch per second, the 1-second simulation
  // tick can't resolve individual basket arrivals accurately
  if (slotTime < 1.0) warnings.push(`Chain speed ${cfg.speedMPerMin} m/min at ${cfg.pitchMm} mm pitch means a basket passes every ${slotTime.toFixed(2)} s — faster than the 1-second simulation tick. Results may be inaccurate. Reduce speed or increase pitch.`);
  // Buffer should hold at least 2 pallet rows for the brain to have meaningful trigger options
  if (cfg.loaderBufferCones < 2 * cfg.conesPerAccumulator) warnings.push(`Loader buffer (${cfg.loaderBufferCones} cones) can hold less than 2 pallet rows (${2 * cfg.conesPerAccumulator} cones). The brain has very little room to optimise trigger counts — increase the buffer.`);
  if (cfg.loaderCount - loadersPerVariety.reduce((a, b) => a + b, 0) !== 0) warnings.push('Some loaders have no variety.');
  const unusedVarieties = loadersPerVariety.map((n, v) => (n === 0 ? varietyInfo(v).name : null)).filter(Boolean);
  if (unusedVarieties.length) warnings.push(`No loader assigned to: ${unusedVarieties.join(', ')}.`);

  return {
    cfg,
    pitch,
    speed,
    loopLength,
    slots,
    slotTime,
    distToUnloader,
    loaderSlots,
    unloaderSlots,
    stationTable,
    stationUnloader,
    loaderRate,
    loadersPerVariety,
    productionPerHour,
    loopSeconds,
    travelToUnloaderSec,
    basketPassesPerHour,
    loaderCapacity,
    unloaderCapacity,
    loadSlots,
    unloadSlots,
    loadCycleSec,
    unloadCycleSec,
    streamCapacity,
    travel,
    travelMinSec,
    travelMaxSec,
    returnSec,
    slotsNeeded,
    transitSec,
    warnings,
    errors,
  };
}

export const fmtDuration = (sec) => {
  if (!isFinite(sec)) return '—';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
};
