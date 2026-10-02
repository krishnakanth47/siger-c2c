// ═══════════════════════════════════════════════════════════════════════════
// OHC TRACK GEOMETRY
// The same closed loop that PlantFloor.jsx draws (SVG path below), measured in
// JavaScript so the simulation knows exactly where each loader and each
// unloader sits on the rail. "Progress" is 0…1 along the loop, measured by true
// arc length — the same way the SVG getPointAtLength() positions baskets.
//
// Direction of travel: top leg left→right (loaders L01…L16), down the right
// side (in-transit rail), bottom leg right→left (unloaders U01…U04), then the
// empty return to the standby pool at the bottom-left.
// ═══════════════════════════════════════════════════════════════════════════

export const TRACK_PATH_D =
  'M 110 140 L 1320 140 C 1390 140, 1410 200, 1410 340 C 1410 480, 1390 540, 1320 540 L 110 540 C 40 540, 20 480, 20 340 C 20 200, 40 140, 110 140 Z';

const SEGMENTS = [
  { type: 'L', p: [[110, 140], [1320, 140]] },
  { type: 'C', p: [[1320, 140], [1390, 140], [1410, 200], [1410, 340]] },
  { type: 'C', p: [[1410, 340], [1410, 480], [1390, 540], [1320, 540]] },
  { type: 'L', p: [[1320, 540], [110, 540]] },
  { type: 'C', p: [[110, 540], [40, 540], [20, 480], [20, 340]] },
  { type: 'C', p: [[20, 340], [20, 200], [40, 140], [110, 140]] },
];

function evalSeg(seg, t) {
  if (seg.type === 'L') {
    const [[x0, y0], [x1, y1]] = seg.p;
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  }
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = seg.p;
  const u = 1 - t;
  return [
    u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
    u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
  ];
}

// Dense sample table: [{x, y, len}] with cumulative arc length
const SAMPLES_PER_SEG = 600;
const TABLE = [];
(() => {
  let len = 0;
  let prev = null;
  SEGMENTS.forEach((seg, si) => {
    for (let i = si === 0 ? 0 : 1; i <= SAMPLES_PER_SEG; i++) {
      const [x, y] = evalSeg(seg, i / SAMPLES_PER_SEG);
      if (prev) len += Math.hypot(x - prev[0], y - prev[1]);
      TABLE.push({ x, y, len, seg: si });
      prev = [x, y];
    }
  });
})();

export const TRACK_LENGTH = TABLE[TABLE.length - 1].len;

export function pointAtProgress(progress) {
  const target = (((progress % 1) + 1) % 1) * TRACK_LENGTH;
  let lo = 0;
  let hi = TABLE.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (TABLE[mid].len < target) lo = mid + 1;
    else hi = mid;
  }
  return { x: TABLE[lo].x, y: TABLE[lo].y };
}

// Progress of the point with the given x on the top leg (segment 0) or bottom leg (segment 3)
function progressAtX(x, segIndex) {
  let best = null;
  TABLE.forEach((s) => {
    if (s.seg !== segIndex) return;
    if (!best || Math.abs(s.x - x) < Math.abs(best.x - x)) best = s;
  });
  return best.len / TRACK_LENGTH;
}

// Loader Lxx docks sit above the top leg at x = 110 + i·78 (PlantFloor: machine x + 35)
export const LOADER_X = Array.from({ length: 16 }, (_, i) => 75 + i * 78 + 35);
export const LOADER_PROGRESS = LOADER_X.map((x) => progressAtX(x, 0));

// Unloader Uxx stations sit above the bottom leg at x = 1220 − i·150, bay centre +55
export const UNLOADER_X = Array.from({ length: 4 }, (_, i) => 1220 - i * 150 + 55);
export const UNLOADER_PROGRESS = UNLOADER_X.map((x) => progressAtX(x, 3));

// Loaded baskets are assigned a dynamic unloader when they reach this point
// (on the right-hand in-transit leg, just before U01); if all bays are busy they queue here.
export const UNLOAD_APPROACH = UNLOADER_PROGRESS[0] - 0.035;

// Empty baskets leave the rail into the standby pool at the bottom-left
export const RETURN_TO_POOL = progressAtX(130, 3);

export const loaderProgress = (loaderId) => LOADER_PROGRESS[parseInt(loaderId.slice(1), 10) - 1] ?? 0;
export const unloaderProgress = (unloaderId) => UNLOADER_PROGRESS[parseInt(unloaderId.slice(1), 10) - 1] ?? UNLOAD_APPROACH;
