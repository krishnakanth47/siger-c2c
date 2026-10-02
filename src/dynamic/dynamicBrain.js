// ═══════════════════════════════════════════════════════════════════════════
// SIEGER MASTER MIND — decision engine for the configurable plant
// Every second:
//   1. SENSE      loaders (cones waiting, buffer, lots), loop contents, stations
//   2. SLOTS      keep the number of varieties on the loop within the limit;
//                 drain a variety when a blocked loader is about to stop
//   3. TRIGGER    decide each loader's triggering count (automatic mode)
//   4. SCORE      rank every loader that is ready to load
//   5. CHECK      loading places (4Q), variety slot, pallet station for each lot
//   6. COMMAND    permit the loader, allocate pallet station(s)
// ═══════════════════════════════════════════════════════════════════════════
import { varietyInfo, fmtDuration } from './config';

export const DYN_WEIGHTS = {
  sameVariety: 40,      // variety already on the loop — no new variety slot needed
  newSlotPenalty: 10,   // opening a new variety slot
  bufferRisk: 50,       // points at a full loader buffer
  stoppedBonus: 30,     // autoconer already stopped
  waitPerMin: 3,        // fairness per minute waited
  waitCap: 30,
  demand: 25,           // variety marked high demand
  lotChange: 100,       // old lot must be cleared first
  palletNeed: 10,       // a pallet row / pallet of this variety is waiting for cones
  unloaderFree: 15,     // an unloader / pallet station is free and ready for this variety
  starvationMin: 20,    // waited longer than this → forced priority
  drainTriggerPct: 85,  // buffer % at which a blocked loader makes the brain drain a variety
  newBatchPct: 50,      // new variety while slots are scarce: wait for this % of the buffer
  drainLeadMin: 15,     // start draining this many minutes before a blocked loader would fill
  maxPaceFactor: 1,     // extra slowing the brain may command (× the matched pace); 1 = only match the unloader
  missCostPct: 100,     // a cone that passes its unloader costs this % of one loop in the timing plan
};

export const DYN_WEIGHT_META = [
  { key: 'sameVariety', label: 'Variety already on the loop', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'newSlotPenalty', label: 'Penalty for opening a new variety slot', min: 0, max: 50, step: 1, unit: 'pts' },
  { key: 'bufferRisk', label: 'Loader buffer risk (at 100%)', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'stoppedBonus', label: 'Autoconer stopped', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'waitPerMin', label: 'Fairness per minute waited', min: 0, max: 20, step: 0.5, unit: 'pts/min' },
  { key: 'waitCap', label: 'Fairness cap', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'demand', label: 'High-demand variety', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'lotChange', label: 'Old lot to clear (lot change)', min: 0, max: 300, step: 5, unit: 'pts' },
  { key: 'palletNeed', label: 'Pallet row waiting for this variety', min: 0, max: 50, step: 1, unit: 'pts' },
  { key: 'unloaderFree', label: 'Unloader free for this variety', min: 0, max: 50, step: 1, unit: 'pts' },
  { key: 'starvationMin', label: 'Anti-starvation limit', min: 2, max: 120, step: 1, unit: 'min' },
  { key: 'drainTriggerPct', label: 'Drain a variety when blocked buffer reaches', min: 30, max: 100, step: 5, unit: '%' },
  { key: 'newBatchPct', label: 'New variety batch (slots scarce)', min: 10, max: 100, step: 5, unit: '% buffer' },
  { key: 'drainLeadMin', label: 'Start drain before a loader fills', min: 0, max: 30, step: 1, unit: 'min' },
  { key: 'maxPaceFactor', label: 'Extra loader slowing to avoid returns', min: 1, max: 3, step: 0.25, unit: '×' },
  { key: 'missCostPct', label: 'Cost of a returned cone (% of one loop)', min: 0, max: 200, step: 10, unit: '%' },
];

const FORCED = 500;
const MAX_DRAIN_FACTOR = 3;   // drain fails safe after 3× the estimated clear time
const vn = (v) => varietyInfo(v).name;

export class DynamicBrain {
  constructor(weights = DYN_WEIGHTS) {
    this.weights = { ...DYN_WEIGHTS, ...weights };
    this.reset();
  }

  reset() { this.cycleId = 0; this.drain = null; this.reservation = null; }
  setWeights(w) { this.weights = { ...this.weights, ...w }; }

  // How many varieties may be on the loop right now.
  // FIXED: the customer spec (e.g. 4). AUTO: every variety/lot needs its own pallet station, so the
  // brain allows as many as there are stations for — varieties on the loop + stations free or held.
  // Unloader time is checked per permit by the arrival forecast.
  limit(e) {
    if (e.cfg.varietyLimitMode !== 'AUTO') return e.cfg.maxVarietiesOnLoop;
    if (this._lim && this._lim.t === e.t) return this._lim.n;
    const occ = e.occupancy().size;
    const spare = e.stations.filter((s) => s.status !== 'ACTIVE').length;
    const n = Math.max(1, Math.min(e.cfg.palletStations, occ + spare));
    this._lim = { t: e.t, n };
    return n;
  }

  // Is some variety waiting for a slot while all variety slots are taken?
  blockedDemand(e) {
    const occ = e.occupancy();
    if (occ.size < this.limit(e)) return false;
    const newTrig = this.newVarietyTrigger(e);
    return e.loaders.some((l) => !l.permit && !occ.has(l.variety) && (l.count >= newTrig || e.hasOldLot(l)));
  }

  slotsScarce(e) {
    return e.occupancy().size >= this.limit(e) - 1;
  }

  newVarietyTrigger(e) {
    // When variety slots are scarce a new variety should bring a worthwhile batch
    // (it holds a slot until its baskets are unloaded): half the loader buffer.
    // Otherwise one pallet row (4 or 5 cones) is enough.
    const row = e.cfg.conesPerAccumulator;
    return this.slotsScarce(e) ? Math.max(row, Math.ceil((e.cfg.loaderBufferCones * this.weights.newBatchPct) / 100)) : row;
  }

  onLoop(e, v) {
    return e.baskets.some((b) => b.variety === v) || e.loaders.some((x) => x.permit && x.variety === v);
  }

  // Seconds until the first variety slot frees up (0 if one is free now) — from the timing forecast
  slotWaitSec(e) {
    if (this._slotWait && this._slotWait.t === e.t) return this._slotWait.sec;
    const occ = e.occupancy();
    let sec = 0;
    if (occ.size >= this.limit(e)) {
      sec = Math.min(...[...occ.keys()].filter((v) => !e.varieties[v].lotChange).map((v) => e.clearSeconds(v)), Infinity);
      if (!isFinite(sec)) sec = 0;
    }
    this._slotWait = { t: e.t, sec };
    return sec;
  }

  // Timing cap: a loader that waits for a slot keeps receiving cones from its autoconer.
  // Ask early enough that the cones arriving during the wait still fit in the buffer.
  timingCap(e, l) {
    const wait = this.slotWaitSec(e);
    const extra = Math.ceil((l.rate * wait) / 3600);
    // Guard: cap must be at least one pallet row so we never get a zero or negative trigger
    const minCap = e.cfg.conesPerAccumulator;
    return { wait, extra, cap: Math.max(minCap, e.cfg.loaderBufferCones - extra) };
  }

  // Automatic triggering count (software decides when a loader asks to load)
  autoTrigger(e, l) {
    const row = e.cfg.conesPerAccumulator;
    if (this.onLoop(e, l.variety)) {
      // Joining a variety already on the loop costs no new slot — but if other varieties
      // are waiting for a slot, stop feeding it (unless this loader is about to stop) so it can rotate out.
      if (this.blockedDemand(e)) return Math.ceil((e.cfg.loaderBufferCones * this.weights.drainTriggerPct) / 100);
      return row; // a full pallet row, so loading places are not tied up for single cones
    }
    const want = this.newVarietyTrigger(e);
    if (!this.slotsScarce(e) || !(l.rate > 0)) return want;
    return Math.max(row, Math.min(want, this.timingCap(e, l).cap));
  }

  triggerReason(e, l) {
    const { cfg } = e;
    if (cfg.loadingCountMode === 'MANUAL') return `${cfg.manualTriggerCount} · manual`;
    if (this.onLoop(e, l.variety)) {
      return this.blockedDemand(e)
        ? `${this.autoTrigger(e, l)} · on loop, others need slots`
        : `${e.cfg.conesPerAccumulator} · on loop, one pallet row`;
    }
    if (!this.slotsScarce(e)) return `${this.autoTrigger(e, l)} · new variety, one pallet row`;
    const want = this.newVarietyTrigger(e);
    const tc = this.timingCap(e, l);
    if (tc.cap < want && tc.wait > 0) return `${this.autoTrigger(e, l)} · a slot frees in ~${fmtDuration(tc.wait)}; ${tc.extra} more cones arrive meanwhile, so ask ${want - Math.max(e.cfg.conesPerAccumulator, tc.cap)} early`;
    return `${this.autoTrigger(e, l)} · new variety, slots scarce: ${this.weights.newBatchPct}% buffer`;
  }

  // Try every station option and loading pace; pick the one that clears the batch soonest.
  // A cone that passes its unloader unloaded goes round again: that costs one full loop.
  bestPlan(e, l, opts, n, base) {
    const { d } = e;
    // A stream is never sent faster than one unloader can take it (matched pace).
    const minPace = Math.max(d.loadSlots, d.unloadSlots);
    const maxPace = Math.max(minPace, Math.floor(minPace * this.weights.maxPaceFactor));
    let best = null;
    const tried = [];
    for (const opt of opts) {
      let fullPace = null;
      for (let pace = minPace; pace <= maxPace; pace += 1) {
        const p = e.planStream(l, opt.u, n, pace, base);
        if (!fullPace) fullPace = p;
        const penalty = (opt.kind === 'HELD' ? 120 : 0) + (opt.kind === 'FREE' && e.stationsFor(l.variety, l.queue[0]?.lot).length ? 60 : 0);
        const cost = p.lastSec + p.incMisses * d.loopSeconds * (this.weights.missCostPct / 100) + penalty;
        if (!best || cost < best.cost) best = { opt, p, cost, fullPace };
        if (p.incMisses === 0) break; // slower pace only finishes later
      }
      tried.push({ u: opt.u, kind: opt.kind, station: opt.station.id, fullMisses: fullPace.incMisses, lastSec: Math.round(fullPace.lastSec) });
    }
    if (best) best.tried = tried;
    return best;
  }

  decide(e) {
    const W = this.weights;
    const { cfg, t } = e;
    this.cycleId += 1;
    const notes = [];
    const actions = [];

    const LIM = this.limit(e);
    const auto = cfg.varietyLimitMode === 'AUTO';
    // ── 1. SENSE ───────────────────────────────────────────────────────────
    const occ = e.occupancy();
    const occupied = [...occ.keys()];
    const eligible = e.loaders.filter((l) => !l.permit && l.eligibleSince !== null);
    const loadingNowStart = e.loaders.filter((l) => l.permit).length;
    const inputs = {
      waiting: eligible.length,
      loading: loadingNowStart,
      maxLoads: cfg.maxLoadsAtOnce,
      varietiesOnLoop: occupied.length,
      maxVarieties: LIM,
      autoLimit: auto,
      emptyBaskets: e.baskets.filter((b) => b.variety < 0).length,
      loadedBaskets: e.baskets.filter((b) => b.variety >= 0).length,
      freeStations: e.stations.filter((s) => s.status === 'FREE').length,
    };

    // ── 2. SLOT MANAGER ────────────────────────────────────────────────────
    if (this.drain && !occupied.includes(this.drain.variety)) {
      notes.push(`${vn(this.drain.variety)} has left the loop → its slot is reserved for ${this.drain.forLoader} (${vn(this.drain.forVariety)}).`);
      this.reservation = { variety: this.drain.forVariety, forLoader: this.drain.forLoader, since: t };
      this.drain = null;
    }
    // The loader a drain/reservation is for: still outside the loop with cones to load
    // (it may be filling up and not have asked yet — the drain is predictive).
    const stillWaiting = (id) => e.loaders.some((l) => l.id === id && !l.permit && l.count > 0);
    if (this.drain && !stillWaiting(this.drain.forLoader)) {
      notes.push(`Drain of ${vn(this.drain.variety)} cancelled — ${this.drain.forLoader} has been permitted or has no cones.`);
      this.drain = null;
    }
    // Drain failsafe: if a drain has been running much longer than the estimated clear
    // time, something unexpected is keeping cones on the loop. Cancel the drain and
    // force-admit the blocked loader on the next cycle to prevent a deadlock.
    if (this.drain && this.drain.estimatedClearSec > 0) {
      const maxDrainSec = this.drain.estimatedClearSec * MAX_DRAIN_FACTOR;
      if (t - this.drain.since > maxDrainSec) {
        notes.push(`DRAIN FAILSAFE: ${vn(this.drain.variety)} has been draining for ${fmtDuration(t - this.drain.since)} (expected ~${fmtDuration(this.drain.estimatedClearSec)}). Cancelling drain and forcing admission for ${this.drain.forLoader}.`);
        // Promote to reservation so the blocked loader gets the very next free slot
        this.reservation = { variety: this.drain.forVariety, forLoader: this.drain.forLoader, since: t };
        this.drain = null;
      }
    }
    if (this.reservation && (occupied.includes(this.reservation.variety) || !stillWaiting(this.reservation.forLoader) || t - this.reservation.since > 1800)) this.reservation = null;

    let freeSlots = LIM - occupied.length;
    if (!this.drain && freeSlots <= 0) {
      // Predictive rotation: a variety needs time to leave the loop (its baskets must reach the
      // unloaders). Start draining one early enough that the next loader waiting outside
      // never fills its buffer.
      const victims = occupied
        .filter((v) => !e.varieties[v].lotChange)
        .map((v) => ({ v, clear: e.clearSeconds(v), waiting: occ.get(v).waiting, loading: occ.get(v).loading,
          maxFill: Math.max(0, ...e.loaders.filter((l) => l.variety === v).map((l) => l.count / cfg.loaderBufferCones)) }))
        .map((x) => ({ ...x, cost: x.clear + x.maxFill * 1800 + x.loading * 60 }))
        .sort((a, b) => a.cost - b.cost);
      const victim = victims[0];
      const outside = e.loaders
        .filter((l) => !l.permit && !occupied.includes(l.variety) && l.count > 0)
        .map((l) => {
          const pct = (l.count / cfg.loaderBufferCones) * 100;
          const toFull = l.rate > 0 ? ((cfg.loaderBufferCones - l.count) / l.rate) * 3600 : Infinity;
          const wait = l.eligibleSince !== null ? t - l.eligibleSince : 0;
          // Rate-aware trigger: fast-filling loaders need earlier drain starts
          const maxRate = Math.max(1, ...e.loaders.map((x) => x.rate));
          const rateAdjustedPct = l.rate > 0
            ? Math.max(pct, W.drainTriggerPct * (l.rate / maxRate))
            : pct;
          return { l, pct, rateAdjustedPct, toFull, wait };
        })
        .sort((a, b) => a.toFull - b.toFull);
      const blocked = outside.find((x) => victim && (x.toFull <= victim.clear + this.weights.drainLeadMin * 60 || x.rateAdjustedPct >= W.drainTriggerPct || x.wait >= W.starvationMin * 60 || e.hasOldLot(x.l)));
      if (blocked && victim) {
        this.drain = {
          variety: victim.v, since: t, forLoader: blocked.l.id, forVariety: blocked.l.variety,
          reason: `${blocked.l.id} (${vn(blocked.l.variety)}) cannot load — all ${LIM} variety slots are busy${auto ? ' (every pallet station is in use)' : ''} — and its buffer ${blocked.toFull <= 0 ? 'is already full (autoconer stopped)' : `(${Math.round(blocked.pct)}%) will be full in about ${fmtDuration(blocked.toFull)}`}. ` +
            `${vn(victim.v)} frees its slot soonest (its cones leave the loop in about ${fmtDuration(victim.clear)}), ` +
            `so ${vn(victim.v)} stops loading now and its slot goes to ${blocked.l.id} as soon as its baskets are unloaded.`,
          estimatedClearSec: victim.clear,
        };
        notes.push(`DRAIN ${vn(victim.v)} now so ${blocked.l.id} (${vn(blocked.l.variety)}) gets a slot before its buffer is full.`);
        e.loaders.filter((l) => l.permit && l.variety === victim.v).forEach((l) => {
          actions.push({ type: 'REVOKE', loaderIdx: l.idx, explanation: `${vn(victim.v)} is being drained to free a variety slot for ${blocked.l.id}` });
        });
      }
    }

    const slots = occupied.map((v) => {
      const o = occ.get(v);
      const draining = this.drain && this.drain.variety === v;
      return {
        variety: v,
        state: draining ? 'DRAINING' : o.loading ? 'LOADING' : 'ON LOOP',
        note: `${o.onLoop} on loop · ${o.loading} loading · ${o.waiting} waiting · clears in ~${fmtDuration(e.clearSeconds(v))}`,
      };
    });
    for (let i = slots.length; i < LIM; i++) {
      const reserved = this.reservation && i === slots.length;
      slots.push({ variety: reserved ? this.reservation.variety : -1, state: reserved ? 'RESERVED' : 'FREE', note: reserved ? `Held for ${this.reservation.forLoader}` : 'Any variety can open it' });
    }

    // ── 3–4. TRIGGER + SCORE ───────────────────────────────────────────────
    const rule = cfg.loaderStartRule || 'BOTH';
    const loadNow = e.streamLoad();
    // Check if any active lot change is in progress across all varieties
    const anyLotChangeActive = e.varieties.some((v) => !!v.lotChange);
    const candidates = eligible.map((l) => {
      const v = l.variety;
      const waitSec = t - l.eligibleSince;
      const bufferPct = Math.min(100, (l.count / cfg.loaderBufferCones) * 100);
      const open = occupied.includes(v);
      const old = e.hasOldLot(l);
      const partial = e.stations.some((s) => s.variety === v && s.status !== 'FREE' && (s.acc > 0 || s.pallet > 0));
      const components = [];
      // Keeping to the varieties already on the loop only matters when variety slots are scarce
      const scarce = occupied.length >= LIM - 1;
      if (scarce) components.push(open ? { key: 'variant', label: 'Variety on the loop', pts: W.sameVariety } : { key: 'variant', label: 'Needs a new variety slot', pts: -W.newSlotPenalty });
      components.push({ key: 'buffer', label: `Buffer ${Math.round(bufferPct)}%`, pts: +((bufferPct / 100) * W.bufferRisk).toFixed(1) });
      if (l.stopped) components.push({ key: 'stopped', label: 'Autoconer stopped', pts: W.stoppedBonus });
      components.push({ key: 'wait', label: `Waited ${fmtDuration(waitSec)}`, pts: +Math.min(W.waitCap, (waitSec / 60) * W.waitPerMin).toFixed(1) });
      // Loader-start rule (setup): demand side, unloader side, or both
      const useDemand = rule !== 'UNLOADER';
      const useUnloader = rule !== 'DEMAND';
      if (useDemand && e.varieties[v].highDemand) components.push({ key: 'urgent', label: 'High demand', pts: W.demand });
      // Dynamic lot-change scoring: scale from 0.5× to 2× based on urgency
      if (old && cfg.lotChangePriority !== 'NORMAL') {
        const lc = e.varieties[v].lotChange;
        const remaining = e.lotRemaining(v);
        const elapsed = (t - lc.since) / 60; // minutes since lot change
        // Urgency increases as remaining count drops and time passes
        const urgencyByCount = remaining ? Math.max(0.5, 2.0 - (remaining.total / Math.max(1, cfg.loaderBufferCones))) : 1.0;
        const urgencyByTime = Math.min(2.0, 0.5 + elapsed / 30); // ramps up over 45 min
        const lotMultiplier = Math.max(urgencyByCount, urgencyByTime);
        const lotPts = Math.round(W.lotChange * lotMultiplier);
        components.push({ key: 'lot', label: `Old lot ${lc.oldLot} to clear (urgency ×${lotMultiplier.toFixed(1)})`, pts: lotPts });
        // Buffer boost for old lots: if the old-lot cones are sitting in the buffer, add extra urgency
        if (bufferPct > 60) {
          const boostPts = Math.round((bufferPct - 60) * 0.5);
          components.push({ key: 'lot_buffer', label: 'Old lot buffer pressure', pts: boostPts });
        }
      }
      if (useUnloader && partial) components.push({ key: 'pallet', label: 'Pallet waiting for it', pts: rule === 'UNLOADER' ? 2 * W.palletNeed : W.palletNeed });
      if (useUnloader && rule === 'UNLOADER') {
        const lot = l.queue.find((q) => q.n > 0)?.lot;
        const ready = e.stations.some((s) => loadNow[s.unloader] === 0 && ((s.variety === v && s.lot === lot && s.status !== 'FREE') || s.status === 'FREE'));
        if (ready) components.push({ key: 'unloader', label: 'Unloader free for it', pts: W.unloaderFree });
      }
      // Anti-starvation: cap forced points below lot-change when a lot change is active
      // so that clearing the old lot isn't preempted by a forced admission
      if (waitSec >= W.starvationMin * 60) {
        const forcedPts = anyLotChangeActive && !old ? Math.min(FORCED, W.lotChange - 1) : FORCED;
        components.push({ key: 'forced', label: `Waited > ${W.starvationMin} min${anyLotChangeActive && !old ? ' (capped: lot change active)' : ''}`, pts: forcedPts });
      }
      return {
        loaderIdx: l.idx, loaderId: l.id, variety: v, count: l.count, trigger: e.triggerCount(l), triggerReason: this.triggerReason(e, l),
        waitSec, bufferPct: Math.round(bufferPct), stopped: l.stopped, open, components,
        total: +components.reduce((s, c) => s + c.pts, 0).toFixed(1), verdict: '', selected: false, rank: 0,
      };
    });
    candidates.sort((a, b) => b.total - a.total || b.waitSec - a.waitSec);
    candidates.forEach((c, i) => { c.rank = i + 1; });

    // ── 5–6. CHECK + COMMAND ───────────────────────────────────────────────
    let loadingNow = loadingNowStart - actions.filter((a) => a.type === 'REVOKE').length;
    const openNow = new Set(occupied);
    const takenStations = new Set();
    const streamLoad = e.streamLoad();
    let base = null; // unloader arrival forecast, built when first needed
    for (const c of candidates) {
      const l = e.loaders[c.loaderIdx];
      if (loadingNow >= cfg.maxLoadsAtOnce) { c.verdict = `WAIT — all ${cfg.maxLoadsAtOnce} loading places in use`; continue; }
      if (this.drain && this.drain.variety === c.variety) { c.verdict = `HOLD — ${vn(c.variety)} is draining for ${this.drain.forLoader}`; continue; }
      if (!openNow.has(c.variety)) {
        if (freeSlots <= 0) { c.verdict = `BLOCKED — ${LIM}/${LIM} variety slots busy${auto ? ' (no pallet station free)' : ''}`; continue; }
        if (this.reservation && this.reservation.variety !== c.variety && freeSlots <= 1) { c.verdict = `BLOCKED — last slot reserved for ${this.reservation.forLoader}`; continue; }
      }
      const lots = [...new Set(l.queue.filter((q) => q.n > 0).map((q) => q.lot))];
      // Free stations to keep for other varieties: FIXED = unused slots; AUTO = varieties waiting outside the loop
      const reserve = auto
        ? new Set(eligible.filter((x) => !openNow.has(x.variety) && x.variety !== c.variety).map((x) => x.variety)).size
        : Math.max(0, LIM - openNow.size - (openNow.has(c.variety) ? 0 : 1));
      // ── Timing: where and how fast should this loader send its cones? ──
      const mainLot = lots[0];
      const nMain = l.queue.filter((q) => q.lot === mainLot).reduce((a, q) => a + q.n, 0);
      const opts = e.routeOptions(c.variety, mainLot, takenStations, reserve);
      if (!opts.length) { c.verdict = `WAIT — no pallet station for lot ${mainLot}`; continue; }
      if (!base) base = e.forecastBase();
      const plan = this.bestPlan(e, l, opts, nMain, base);
      const urgent = c.stopped || c.bufferPct >= W.drainTriggerPct || e.hasOldLot(l);
      const scarce = openNow.size >= LIM - 1;
      const U = e.unloaders[plan.opt.u].id;
      if (plan.p.incMisses > 0 && !urgent && scarce) {
        c.verdict = `WAIT — every unloader is booked: best is ${U}, but ${plan.p.incMisses} cone(s) would still pass unloaded`;
        continue;
      }
      const others = lots.slice(1).map((lot) => ({ lot, route: e.routeLot(c.variety, lot, streamLoad, new Set([...takenStations, ...plan.opt.take.map((x) => x.idx)]), { spread: true, reserve }) }));
      const bad = others.find((r) => !r.route.ok);
      if (bad) { c.verdict = `WAIT — no pallet station for lot ${bad.lot}`; continue; }
      const routes = [{ lot: mainLot, route: { ok: true, station: plan.opt.station, take: plan.opt.take, reason: plan.opt.reason } }, ...others];
      const main = plan.opt.station;
      e.commitStream(base, plan.p);
      const paceSec = plan.p.pace * e.d.slotTime;
      c.timing = {
        unloader: U, station: main.id, pace: plan.p.pace, paceSec: +paceSec.toFixed(1),
        firstSec: Math.round(plan.p.firstSec), lastSec: Math.round(plan.p.lastSec), travelSec: Math.round(plan.p.travelSec),
        busyUntilSec: Math.round(plan.p.busyUntilSec), misses: plan.p.incMisses, fullMisses: plan.fullPace.incMisses, tried: plan.tried,
      };
      routes.forEach(({ route }) => route.take.forEach((st) => takenStations.add(st.idx)));
      streamLoad[main.unloader] += 1;
      loadingNow += 1;
      if (!openNow.has(c.variety)) { openNow.add(c.variety); freeSlots -= 1; if (this.reservation && this.reservation.variety === c.variety) this.reservation = null; }
      c.selected = true;
      const stationText = routes.map(({ lot, route }) => `lot ${lot} → ${route.reason}`).join('; ');
      c.verdict = `SELECTED → ${main.id}/${U}, every ${plan.p.pace}th basket`;
      const tm = c.timing;
      const matchPace = Math.max(e.d.loadSlots, e.d.unloadSlots);
      const why = plan.p.pace > matchPace
        ? ` — slowed further because ${U} is busy with other cones until ~${fmtDuration(tm.busyUntilSec)}; at every ${matchPace}th basket ${tm.fullMisses} cone(s) would pass unloaded`
        : matchPace > e.d.loadSlots ? ` — slowed from every ${e.d.loadSlots}th basket to match the unloader (${e.d.unloadCycleSec.toFixed(1)} s per cone)` : '';
      const timingText = `Timing: ${nMain} cones, one every ${tm.pace}th basket (${tm.paceSec} s)${why}. ${tm.busyUntilSec > 0 ? `${U} already has cones booked until ~${fmtDuration(tm.busyUntilSec)}. ` : `${U} has no other cones booked. `}` +
        `Travel ${fmtDuration(tm.travelSec)} to ${U}: first cone there in ~${fmtDuration(tm.firstSec)}, last in ~${fmtDuration(tm.lastSec)}; ${tm.misses ? `${tm.misses} cone(s) expected to go round again (loader about to stop, accepted)` : 'no cone expected to pass unloaded'}.`;
      const top = [...c.components].filter((x) => x.pts !== 0).sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)).slice(0, 3);
      const beaten = candidates.filter((x) => !x.selected && x.total < c.total && x !== c).slice(0, 2);
      let text = `${c.loaderId} (${vn(c.variety)}) permitted to load ${l.count} cones, score ${c.total}: ` + top.map((x) => `${x.label} (${x.pts > 0 ? '+' : ''}${x.pts})`).join(', ') + '.';
      if (beaten.length) text += ` Ranked above ${beaten.map((x) => `${x.loaderId} (${x.total})`).join(', ')}.`;
      text += ` Trigger count ${c.triggerReason}. Pallet: ${stationText}. ${timingText} PLC: PERMIT_LOAD[${c.loaderId}] = 1, LOAD_PACE[${c.loaderId}] = ${tm.pace}, STATION[${c.loaderId}] = ${main.id}.`;
      actions.push({ type: 'PERMIT', loaderIdx: c.loaderIdx, routes, pace: plan.p.pace, explanation: text, score: c.total });
    }

    const permits = actions.filter((a) => a.type === 'PERMIT');
    let summary;
    if (!candidates.length) summary = 'No loader is waiting — watching doff counts.';
    else if (permits.length) summary = `Permitted ${permits.map((a) => e.loaders[a.loaderIdx].id).join(', ')} · ${candidates.length - permits.length} still waiting.`;
    else summary = `${candidates.length} waiting — none can load this cycle (${candidates[0].verdict.split(' — ')[1] || candidates[0].verdict}).`;

    let timing = null;
    if (!e.silent || base) {
      const b = base || e.forecastBase();
      timing = {
        slotTime: +e.d.slotTime.toFixed(2), loadSlots: e.d.loadSlots, unloadSlots: e.d.unloadSlots,
        loadCycleSec: +e.d.loadCycleSec.toFixed(1), unloadCycleSec: +e.d.unloadCycleSec.toFixed(1), streamCapacity: +e.d.streamCapacity.toFixed(2),
        slotWaitSec: Math.round(this.slotWaitSec(e)),
        unloaders: b.map((x) => ({
          id: e.unloaders[x.u].id, cones: x.arr.length,
          next: x.arr.length ? Math.round(e.secOf(x.arr[0])) : null,
          busyUntil: x.arr.length ? Math.round(e.secOf(x.arr[x.arr.length - 1])) : 0,
          load: x.arr.length ? +Math.min(9.99, (x.arr.length * e.d.unloadSlots) / Math.max(1, x.arr[x.arr.length - 1] - x.arr[0] + e.d.unloadSlots)).toFixed(2) : 0,
          misses: x.misses,
        })),
      };
    }
    return {
      cycleId: this.cycleId,
      t,
      timing,
      inputs,
      slots,
      drain: this.drain ? { ...this.drain } : null,
      reservation: this.reservation ? { ...this.reservation } : null,
      stations: e.stations.map((s) => ({ id: s.id, unloader: s.unloader, status: s.status, variety: s.variety, lot: s.lot, acc: s.acc, pallet: s.pallet })),
      candidates,
      actions,
      notes,
      summary,
    };
  }
}
