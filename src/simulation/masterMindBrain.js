// ═══════════════════════════════════════════════════════════════════════════
// SIEGER MASTER MIND — Central decision engine for dynamic cone loading
// ---------------------------------------------------------------------------
// The brain runs one "decision cycle" per tick. Each cycle it:
//   1. SENSES   the plant (waiting machines, 4Q usage, variant slots, baskets)
//   2. MANAGES  the 4 variant slots (open / hold / drain / reserve)
//   3. SCORES   every waiting machine with a transparent point breakdown
//   4. ALLOCATES an empty basket to each machine it admits
//   5. COMMANDS the PLC (permit to load + basket id)
// Every cycle returns a full "thinking snapshot" so the UI can show exactly
// why each machine was selected or made to wait.
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_WEIGHTS = {
  sameVariant: 40,      // variant already open → joins existing slot, no new variant on the rail
  newSlotPenalty: 10,   // opening a new variant slot costs a little (keeps unloading simple)
  bufferRisk: 50,       // points at 100% cone buffer (machine about to stop)
  stoppedBonus: 30,     // extra points when the machine has already stopped
  waitPerSec: 0.4,      // fairness: points per second waited
  waitCap: 30,          // max fairness points
  urgent: 25,           // urgent order / dispatch priority
  starvationSec: 90,    // anti-starvation: waiting longer than this → forced priority
  drainTriggerPct: 70,  // buffer % at which a blocked machine makes the brain drain a slot
};

export const WEIGHT_META = [
  { key: 'sameVariant', label: 'Same variant already open', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'newSlotPenalty', label: 'Penalty for opening a new variant slot', min: 0, max: 50, step: 1, unit: 'pts' },
  { key: 'bufferRisk', label: 'Cone buffer risk (at 100%)', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'stoppedBonus', label: 'Machine already stopped', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'waitPerSec', label: 'Fairness per second waited', min: 0, max: 2, step: 0.05, unit: 'pts/s' },
  { key: 'waitCap', label: 'Fairness cap', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'urgent', label: 'Urgent order', min: 0, max: 100, step: 1, unit: 'pts' },
  { key: 'starvationSec', label: 'Anti-starvation limit', min: 20, max: 300, step: 5, unit: 's' },
  { key: 'drainTriggerPct', label: 'Drain a slot when blocked buffer reaches', min: 30, max: 100, step: 5, unit: '%' },
];

const FORCED_POINTS = 500;
const MAX_DRAIN_FACTOR = 3;  // drain fails safe after 3× the estimated clear time

// Variants currently occupying one of the 4 variant slots:
// a variant holds a slot while any of its baskets is loading, on the rail or being unloaded.
export function computeVariantOccupancy(state) {
  const occ = {};
  const touch = (v) => {
    if (!occ[v]) occ[v] = { variantId: v, loading: 0, onRail: 0, unloading: 0, waiting: 0 };
    return occ[v];
  };
  state.fifoQueue.forEach((q) => { touch(q.variantId).loading += 1; });
  state.baskets.forEach((b) => {
    if (!b.variantId) return;
    if (b.status === 'IN_TRANSIT') touch(b.variantId).onRail += 1;
    else if (b.status === 'UNLOADING') touch(b.variantId).unloading += 1;
  });
  const occupied = Object.keys(occ);
  state.machines.forEach((m) => {
    if ((m.status === 'WAITING' || m.status === 'BUFFER_FULL') && occ[m.variantId]) occ[m.variantId].waiting += 1;
  });
  return { occ, occupied };
}

export function pickEmptyBasket(baskets, taken = new Set()) {
  const free = (b) => b.status === 'EMPTY' && !b.assignedLoader && !taken.has(b.id);
  let b = baskets.find((x) => free(x) && x.location === 'EMPTY_POOL_READY');
  if (b) return { basket: b, reason: `${b.id} is empty and waiting in the ready pool (closest to loaders)` };
  b = baskets.find((x) => free(x) && x.location === 'EMPTY_BUFFER');
  if (b) return { basket: b, reason: `${b.id} taken from the empty buffer (ready pool had none)` };
  b = baskets.find((x) => free(x) && x.location !== 'Empty Return Rail');
  if (b) return { basket: b, reason: `${b.id} is the only empty basket available` };
  return { basket: null, reason: 'No empty basket available' };
}

// Seconds until every basket of a variant has left the rail (its slot becomes free).
// ctx.model = { railStep, unloadZone, loadRate } from the engine.
export function estimateClearSec(state, variantId, model) {
  const { railStep, unloadZone, loadRate } = model;
  let worst = 0;
  state.fifoQueue.forEach((q) => {
    if (q.variantId !== variantId) return;
    const loader = state.loaders.find((l) => l.id === q.loaderId);
    const loadLeft = loader ? Math.max(0, (100 - loader.progress) / loadRate) : 100 / loadRate;
    const dock = model.loaderProgress ? model.loaderProgress(q.loaderId) : 0.06;
    worst = Math.max(worst, loadLeft + Math.max(0, unloadZone - dock) / railStep + 8);
  });
  state.baskets.forEach((b) => {
    if (b.variantId !== variantId) return;
    if (b.status === 'IN_TRANSIT') {
      const p = b.progressOnTrack || 0;
      const dist = p <= unloadZone + 0.2 ? Math.max(0, unloadZone - p) : 1 - p + unloadZone; // past the bays → one more loop
      worst = Math.max(worst, dist / railStep + 8);
    }
    else if (b.status === 'UNLOADING') worst = Math.max(worst, 8);
    if (b.assignedUnloader && b.status === 'IN_TRANSIT') worst = Math.max(worst, 20);
  });
  return Math.round(worst);
}

export class MasterMindBrain {
  constructor(weights = DEFAULT_WEIGHTS) {
    this.weights = { ...weights };
    this.cycleId = 0;
    this.drain = null;        // { variantId, since, forMachine, forVariant, reason }
    this.reservation = null;  // { variantId, since, forMachine }
  }

  setWeights(w) {
    this.weights = { ...this.weights, ...w };
  }

  reset() {
    this.cycleId = 0;
    this.drain = null;
    this.reservation = null;
  }

  // ctx = { t, state, maxQ, maxVariants, variantName(id) }
  decide(ctx) {
    const { t, state, maxQ, maxVariants, variantName } = ctx;
    const model = ctx.model || { railStep: 0.008, unloadZone: 0.478, loadRate: 4 };
    const W = this.weights;
    this.cycleId += 1;
    const notes = [];

    // ── 1. SENSE ───────────────────────────────────────────────────────────
    const waiting = state.machines.filter((m) => m.status === 'WAITING' || m.status === 'BUFFER_FULL');
    const { occ, occupied } = computeVariantOccupancy(state);
    const emptyBaskets = state.baskets.filter((b) => b.status === 'EMPTY' && !b.reservedFor).length;
    const inputs = {
      waiting: waiting.length,
      qUsed: state.fifoQueue.length,
      maxQ,
      slotsUsed: occupied.length,
      maxVariants,
      emptyBaskets,
      onRail: state.baskets.filter((b) => b.status === 'IN_TRANSIT').length,
    };

    // ── 2. SLOT MANAGER ────────────────────────────────────────────────────
    // End a drain once its variant has left the rail → the freed slot is reserved.
    if (this.drain && !occupied.includes(this.drain.variantId)) {
      notes.push(`Slot of ${variantName(this.drain.variantId)} is now free → reserved for ${variantName(this.drain.forVariant)} (${this.drain.forMachine}).`);
      this.reservation = { variantId: this.drain.forVariant, since: t, forMachine: this.drain.forMachine };
      this.drain = null;
    }
    // Cancel a drain / reservation whose beneficiary is no longer waiting.
    const stillWaiting = (id) => waiting.some((m) => m.id === id);
    if (this.drain && !stillWaiting(this.drain.forMachine)) {
      notes.push(`Drain of ${variantName(this.drain.variantId)} cancelled — ${this.drain.forMachine} no longer waiting.`);
      this.drain = null;
    }
    // Drain failsafe: cancel drains that have been running far longer than expected.
    // This prevents a deadlock when cones get stuck recirculating.
    if (this.drain && this.drain.estimatedClearSec > 0) {
      const maxSec = this.drain.estimatedClearSec * MAX_DRAIN_FACTOR;
      if (t - this.drain.since > maxSec) {
        notes.push(`DRAIN FAILSAFE: ${variantName(this.drain.variantId)} draining ${Math.round((t - this.drain.since))}s (expected ~${this.drain.estimatedClearSec}s). Cancelling — forcing slot for ${this.drain.forMachine}.`);
        this.reservation = { variantId: this.drain.forVariant, since: t, forMachine: this.drain.forMachine };
        this.drain = null;
      }
    }
    if (this.reservation && (occupied.includes(this.reservation.variantId) || !stillWaiting(this.reservation.forMachine) || t - this.reservation.since > 45)) {
      this.reservation = null;
    }

    let freeSlots = maxVariants - occupied.length;

    // Is some machine in trouble because every variant slot is taken by other variants?
    if (!this.drain && freeSlots <= 0) {
      const blocked = waiting
        .filter((m) => !occupied.includes(m.variantId))
        .map((m) => ({ m, pct: Math.min(100, ((t - m.doneAt) / m.bufferSec) * 100), wait: t - m.doneAt }))
        .filter((x) => x.pct >= W.drainTriggerPct || x.wait >= W.starvationSec)
        .sort((a, b) => b.pct - a.pct || b.wait - a.wait)[0];
      if (blocked) {
        // Drain the slot that frees up soonest: estimated clear time, plus 30 s for every machine of
        // that variant that would be left waiting while it drains.
        const victim = occupied
          .map((v) => ({ ...occ[v], clearSec: estimateClearSec(state, v, model) }))
          .map((o) => ({ ...o, cost: o.clearSec + o.waiting * 30 }))
          .sort((a, b) => a.cost - b.cost)[0];
        if (victim) {
          const clearSec = estimateClearSec(state, victim.variantId, model);
          this.drain = {
            variantId: victim.variantId,
            since: t,
            forMachine: blocked.m.id,
            forVariant: blocked.m.variantId,
            estimatedClearSec: clearSec,
            reason: `${blocked.m.id} (${variantName(blocked.m.variantId)}) is blocked with buffer at ${Math.round(blocked.pct)}% and all ${maxVariants} variant slots are busy. ` +
              `${variantName(victim.variantId)} is the cheapest slot to close: its baskets clear the rail in about ${victim.clearSec}s and ${victim.waiting} machine(s) of it are waiting. ` +
              `So no new ${variantName(victim.variantId)} loads are admitted until its baskets clear.`,
          };
          notes.push(`DRAIN started on ${variantName(victim.variantId)} to make room for ${blocked.m.id}.`);
        }
      }
    }

    const slots = occupied.map((v) => {
      const o = occ[v];
      let stateLabel = o.loading > 0 ? 'LOADING' : o.unloading > 0 ? 'UNLOADING' : 'ON RAIL';
      let note = `${o.loading} loading · ${o.onRail} on rail · ${o.unloading} unloading · ${o.waiting} waiting · frees in ~${estimateClearSec(state, v, model)}s`;
      if (this.drain && this.drain.variantId === v) {
        stateLabel = 'DRAINING';
        note = `No new loads — freeing slot for ${this.drain.forMachine}. ` + note;
      }
      return { variantId: v, state: stateLabel, note, ...o };
    });
    for (let i = slots.length; i < maxVariants; i++) {
      const reserved = this.reservation && i === slots.length;
      slots.push({
        variantId: reserved ? this.reservation.variantId : null,
        state: reserved ? 'RESERVED' : 'FREE',
        note: reserved ? `Held for ${this.reservation.forMachine} (drained for it)` : 'Available for any variant',
      });
    }

    // ── 3. SCORE every waiting machine ────────────────────────────────────
    const candidates = waiting.map((m) => {
      const waitSec = t - m.doneAt;
      const bufferPct = Math.min(100, (waitSec / m.bufferSec) * 100);
      const variantOpen = occupied.includes(m.variantId);
      const components = [];
      if (variantOpen) components.push({ key: 'variant', label: 'Variant already open', pts: W.sameVariant });
      else components.push({ key: 'variant', label: 'Needs a new variant slot', pts: -W.newSlotPenalty });
      components.push({ key: 'buffer', label: `Buffer ${Math.round(bufferPct)}%`, pts: +(bufferPct / 100 * W.bufferRisk).toFixed(1) });
      if (m.status === 'BUFFER_FULL') components.push({ key: 'stopped', label: 'Machine stopped', pts: W.stoppedBonus });
      components.push({ key: 'wait', label: `Waited ${waitSec}s`, pts: +Math.min(W.waitCap, waitSec * W.waitPerSec).toFixed(1) });
      if (m.urgent) components.push({ key: 'urgent', label: 'Urgent order', pts: W.urgent });
      // Anti-starvation: forced points are reduced when an urgent order is active,
      // so that urgent orders are not preempted by merely starving machines
      if (waitSec >= W.starvationSec) {
        const anyUrgent = waiting.some((x) => x.urgent && x.id !== m.id);
        const pts = anyUrgent && !m.urgent ? Math.min(FORCED_POINTS, W.urgent - 1) : FORCED_POINTS;
        components.push({ key: 'forced', label: `Waited > ${W.starvationSec}s (anti-starvation)${anyUrgent && !m.urgent ? ' (capped: urgent order active)' : ''}`, pts });
      }
      const total = +components.reduce((s, c) => s + c.pts, 0).toFixed(1);
      return {
        machineId: m.id,
        variantId: m.variantId,
        loaderId: `L${m.id.slice(1)}`,
        waitSec,
        bufferPct: Math.round(bufferPct),
        stopped: m.status === 'BUFFER_FULL',
        urgent: !!m.urgent,
        variantOpen,
        components,
        total,
        verdict: '',
        selected: false,
        rank: 0,
      };
    });
    candidates.sort((a, b) => b.total - a.total || b.waitSec - a.waitSec);
    candidates.forEach((c, i) => { c.rank = i + 1; });

    // ── 4. SELECT greedily + ALLOCATE baskets ─────────────────────────────
    let qUsed = state.fifoQueue.length;
    const openNow = new Set(occupied);
    const takenBaskets = new Set();
    const actions = [];

    for (const c of candidates) {
      const loader = state.loaders.find((l) => l.id === c.loaderId);
      if (qUsed >= maxQ) { c.verdict = `WAIT — 4Q full (${qUsed}/${maxQ} loads in progress)`; continue; }
      if (loader && loader.status !== 'AVAILABLE') { c.verdict = `WAIT — loader ${c.loaderId} busy`; continue; }
      if (this.drain && this.drain.variantId === c.variantId) {
        c.verdict = `HOLD — ${variantName(c.variantId)} slot is draining for ${this.drain.forMachine}`;
        continue;
      }
      if (!openNow.has(c.variantId)) {
        if (freeSlots <= 0) {
          c.verdict = `BLOCKED — all ${maxVariants} variant slots busy (${[...openNow].map(variantName).join(', ')})`;
          continue;
        }
        if (this.reservation && this.reservation.variantId !== c.variantId && freeSlots <= 1) {
          c.verdict = `BLOCKED — last free slot reserved for ${this.reservation.forMachine}`;
          continue;
        }
      }
      const { basket, reason: basketReason } = model.pickBasketFor
        ? model.pickBasketFor(c.loaderId, takenBaskets)
        : pickEmptyBasket(state.baskets, takenBaskets);
      if (!basket) { c.verdict = 'WAIT — no free empty basket on the loop'; continue; }

      // Admit
      takenBaskets.add(basket.id);
      qUsed += 1;
      if (!openNow.has(c.variantId)) {
        openNow.add(c.variantId);
        freeSlots -= 1;
        if (this.reservation && this.reservation.variantId === c.variantId) this.reservation = null;
      }
      c.selected = true;
      c.verdict = `SELECTED → ${c.loaderId} + ${basket.id}`;
      c.basketId = basket.id;
      c.basketReason = basketReason;
      actions.push({
        machineId: c.machineId,
        loaderId: c.loaderId,
        basketId: basket.id,
        variantId: c.variantId,
        score: c.total,
        basketReason,
      });
    }

    // Plain-language explanation of each admission
    actions.forEach((a) => {
      const c = candidates.find((x) => x.machineId === a.machineId);
      const top = [...c.components].filter((x) => x.pts !== 0).sort((x, y) => Math.abs(y.pts) - Math.abs(x.pts)).slice(0, 3);
      const beaten = candidates.filter((x) => !x.selected && x.total < c.total).slice(0, 2);
      const skipped = candidates.filter((x) => !x.selected && x.total >= c.total).slice(0, 1);
      let text = `${a.machineId} (${variantName(a.variantId)}) admitted with score ${c.total}: ` +
        top.map((x) => `${x.label} (${x.pts > 0 ? '+' : ''}${x.pts})`).join(', ') + '.';
      if (beaten.length) text += ` Ranked above ${beaten.map((x) => `${x.machineId} (${x.total})`).join(', ')}.`;
      if (skipped.length) text += ` ${skipped[0].machineId} scored higher but: ${skipped[0].verdict.toLowerCase()}.`;
      text += ` Basket: ${a.basketReason}. Command → PLC: PERMIT ${a.loaderId}, BASKET ${a.basketId}.`;
      a.explanation = text;
    });

    let summary;
    if (!candidates.length) summary = 'Idle — no machine is waiting. Watching doff counts.';
    else if (actions.length) summary = `Admitted ${actions.map((a) => a.machineId).join(', ')} · ${candidates.length - actions.length} still waiting.`;
    else summary = `${candidates.length} waiting — none can be admitted this cycle (${candidates[0].verdict.split(' — ')[1] || candidates[0].verdict}).`;

    return {
      cycleId: this.cycleId,
      t,
      inputs,
      slots,
      drain: this.drain ? { ...this.drain } : null,
      reservation: this.reservation ? { ...this.reservation } : null,
      candidates,
      actions,
      notes,
      summary,
    };
  }
}
