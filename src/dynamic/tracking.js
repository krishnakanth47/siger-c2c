// Basket position and distances, measured forward from the origin reader R0.
// This is the calculation the brain PC (or PLC) does from RFID reads:
//   position = (places ahead of the basket last read at R0 + pulses since that read) × pitch
//   distance to a station = (station position − basket position) mod loop length
import { fmtDuration } from './config';

const mod = (a, n) => ((a % n) + n) % n;

export function basketTrack(view, d, b) {
  const S = d.slots;
  const r = view.rfid;
  const ahead = mod(r.lastR0.idx - b.idx, S);
  const pulsesSince = r.pulses - r.lastR0.pulse;
  const pos = mod(ahead + pulsesSince + view.chainFrac, S); // pitches from R0
  const truePos = mod(b.chainSlot + view.chainIdx + view.chainFrac, S);
  const dist = (slot) => {
    const p = mod(slot - pos, S);
    return p < 0.02 ? 0 : p;
  };
  const leg = (slot) => {
    const p = dist(slot);
    return { pitches: p, m: p * d.pitch, sec: p * d.slotTime };
  };
  const stations = d.stationTable.filter((s) => s.kind === 'loader' || s.kind === 'unloader');
  const next = stations.map((s) => ({ ...s, ...leg(s.slot) })).sort((a, c) => a.pitches - c.pitches)[0];
  const lastU = Math.max(...d.unloaderSlots);
  const lastL = Math.max(...d.loaderSlots);
  const firstL = Math.min(...d.loaderSlots);
  const firstU = Math.min(...d.unloaderSlots);
  let zone;
  if (pos < firstL) zone = 'between R0 and L01';
  else if (pos <= lastL) zone = 'loading zone';
  else if (pos < firstU) zone = 'on the way to the unloaders';
  else if (pos <= lastU) zone = 'unloading zone';
  else zone = 'empty return (after the last unloader)';
  return {
    pos, posM: pos * d.pitch, truePos, error: Math.abs(pos - truePos) > 0.01 && Math.abs(pos - truePos) < S - 0.01,
    ahead, pulsesSince, lastR0: r.lastR0, zone, next,
    toR0: { pitches: S - pos, m: (S - pos) * d.pitch, sec: (S - pos) * d.slotTime },
    leg,
  };
}

export const fmtLeg = (x) => `${x.m.toFixed(1)} m · ${fmtDuration(x.sec)}`;
