// SIEGER OHC Material-Handling Simulation Constants & Initial State

export const VARIANTS = [
  { id: 'V1', name: '34s SCHY', code: 'SCHY', color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)', description: '34s Super Combed Hosiery Yarn' },
  { id: 'V2', name: '40s Compact', code: 'CMPT', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', description: '40s Compact Weaving Yarn' },
  { id: 'V3', name: '30s Carded', code: 'CARD', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', description: '30s High-Tenacity Carded Warp' },
  { id: 'V4', name: '24s Slub', code: 'SLUB', color: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', description: '24s Fancy Slub Ring Spun' },
  { id: 'V5', name: '60s Combed', code: 'COMB', color: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', description: '60s Ultra Fine Combed Yarn' },
  { id: 'V6', name: '20s OpenEnd', code: 'OPEN', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', description: '20s Rotor Open End Yarn' },
  { id: 'V7', name: '50s Modal', code: 'MODL', color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', description: '50s Modal Cellulosic Blend' },
  { id: 'V8', name: '80s Micro', code: 'MICR', color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)', description: '80s Micro-Denier Luxury Yarn' },
];

export const MAX_ACTIVE_VARIANTS = 4;
export const MAX_FIFO_QUEUE_SIZE = 4;
export const TOTAL_BASKET_COUNT = 280;
export const CONES_PER_BASKET = 32;

// Initial 16 Production Machines (M01 to M16)
// Controlled demo scenario specified in prompt:
// M05: Variant B (V1 or V2), Doff 98/100
// M03: Variant A, Doff 75/100
// M08: Variant C, Doff 91/100
// M12: Variant D, Doff 64/100
export const INITIAL_MACHINES = [
  { id: 'M01', name: 'Spin Frame 01', variantId: 'V1', doffCount: 42, targetDoff: 100, status: 'RUNNING', speed: 0.6 },
  { id: 'M02', name: 'Spin Frame 02', variantId: 'V2', doffCount: 58, targetDoff: 100, status: 'RUNNING', speed: 0.7 },
  { id: 'M03', name: 'Spin Frame 03', variantId: 'V1', doffCount: 75, targetDoff: 100, status: 'RUNNING', speed: 0.9 },
  { id: 'M04', name: 'Spin Frame 04', variantId: 'V3', doffCount: 33, targetDoff: 100, status: 'RUNNING', speed: 0.5 },
  { id: 'M05', name: 'Spin Frame 05', variantId: 'V1', doffCount: 98, targetDoff: 100, status: 'RUNNING', speed: 1.2 },
  { id: 'M06', name: 'Spin Frame 06', variantId: 'V4', doffCount: 20, targetDoff: 100, status: 'RUNNING', speed: 0.6 },
  { id: 'M07', name: 'Spin Frame 07', variantId: 'V2', doffCount: 48, targetDoff: 100, status: 'RUNNING', speed: 0.7 },
  { id: 'M08', name: 'Spin Frame 08', variantId: 'V3', doffCount: 91, targetDoff: 100, status: 'RUNNING', speed: 1.1 },
  { id: 'M09', name: 'Spin Frame 09', variantId: 'V4', doffCount: 15, targetDoff: 100, status: 'RUNNING', speed: 0.5 },
  { id: 'M10', name: 'Spin Frame 10', variantId: 'V1', doffCount: 37, targetDoff: 100, status: 'RUNNING', speed: 0.6 },
  { id: 'M11', name: 'Spin Frame 11', variantId: 'V2', doffCount: 82, targetDoff: 100, status: 'RUNNING', speed: 0.8 },
  { id: 'M12', name: 'Spin Frame 12', variantId: 'V4', doffCount: 64, targetDoff: 100, status: 'RUNNING', speed: 0.8 },
  { id: 'M13', name: 'Spin Frame 13', variantId: 'V3', doffCount: 50, targetDoff: 100, status: 'RUNNING', speed: 0.7 },
  { id: 'M14', name: 'Spin Frame 14', variantId: 'V1', doffCount: 28, targetDoff: 100, status: 'RUNNING', speed: 0.5 },
  { id: 'M15', name: 'Spin Frame 15', variantId: 'V2', doffCount: 89, targetDoff: 100, status: 'RUNNING', speed: 0.9 },
  { id: 'M16', name: 'Spin Frame 16', variantId: 'V4', doffCount: 10, targetDoff: 100, status: 'RUNNING', speed: 0.4 },
];

// Initial 16 Loaders (L01 to L16)
export const INITIAL_LOADERS = Array.from({ length: 16 }, (_, i) => {
  const num = String(i + 1).padStart(2, '0');
  return {
    id: `L${num}`,
    name: `Loader Unit ${num}`,
    status: 'AVAILABLE', // AVAILABLE, WAITING, LOADING, COMPLETE
    assignedMachineId: null,
    assignedBasketId: null,
    variantId: null,
    progress: 0,
    conesLoaded: 0,
    totalConesTarget: CONES_PER_BASKET,
  };
});

// Initial 4 Dynamic Unloaders (U01 to U04)
export const INITIAL_UNLOADERS = [
  { id: 'U01', name: 'Dynamic Unloader 01', status: 'AVAILABLE', assignedBasketId: null, variantId: null, progress: 0, targetPalletId: null, conesRemaining: 0 },
  { id: 'U02', name: 'Dynamic Unloader 02', status: 'AVAILABLE', assignedBasketId: null, variantId: null, progress: 0, targetPalletId: null, conesRemaining: 0 },
  { id: 'U03', name: 'Dynamic Unloader 03', status: 'AVAILABLE', assignedBasketId: null, variantId: null, progress: 0, targetPalletId: null, conesRemaining: 0 },
  { id: 'U04', name: 'Dynamic Unloader 04', status: 'AVAILABLE', assignedBasketId: null, variantId: null, progress: 0, targetPalletId: null, conesRemaining: 0 },
];

// Initial 8 Pallet Stations (P01 to P08)
export const INITIAL_PALLETS = [
  { id: 'P01', name: 'Pallet Bay 01', variantId: 'V1', coneCount: 160, capacity: 500, status: 'ACTIVE' },
  { id: 'P02', name: 'Pallet Bay 02', variantId: 'V2', coneCount: 224, capacity: 500, status: 'ACTIVE' },
  { id: 'P03', name: 'Pallet Bay 03', variantId: 'V1', coneCount: 96, capacity: 500, status: 'ACTIVE' },
  { id: 'P04', name: 'Pallet Bay 04', variantId: 'V3', coneCount: 192, capacity: 500, status: 'ACTIVE' },
  { id: 'P05', name: 'Pallet Bay 05', variantId: 'V4', coneCount: 128, capacity: 500, status: 'ACTIVE' },
  { id: 'P06', name: 'Pallet Bay 06', variantId: 'V2', coneCount: 64, capacity: 500, status: 'ACTIVE' },
  { id: 'P07', name: 'Pallet Bay 07', variantId: 'V3', coneCount: 256, capacity: 500, status: 'ACTIVE' },
  { id: 'P08', name: 'Pallet Bay 08', variantId: 'V4', coneCount: 32, capacity: 500, status: 'ACTIVE' },
];

// Create initial 280 baskets dataset
// Basket statuses: EMPTY, LOADING, LOADED, IN_TRANSIT, UNLOADING
export const generateInitialBaskets = () => {
  const baskets = [];
  
  // Create 280 baskets
  for (let i = 1; i <= TOTAL_BASKET_COUNT; i++) {
    const id = `B${String(i).padStart(3, '0')}`;
    let status = 'EMPTY';
    let variantId = null;
    let coneQuantity = 0;
    let location = 'BUFFER_POOL';
    let progressOnTrack = 0; // 0.0 to 1.0
    let assignedLoader = null;
    let assignedUnloader = null;

    // Seed circulating baskets for demo visual excitement
    if (i === 12) {
      status = 'IN_TRANSIT';
      variantId = 'V2';
      coneQuantity = 32;
      location = 'OHC_SEGMENT_3';
      progressOnTrack = 0.42;
    } else if (i === 45) {
      status = 'IN_TRANSIT';
      variantId = 'V3';
      coneQuantity = 32;
      location = 'OHC_SEGMENT_5';
      progressOnTrack = 0.65;
    } else if (i === 88) {
      status = 'IN_TRANSIT';
      variantId = 'V4';
      coneQuantity = 32;
      location = 'OHC_SEGMENT_2';
      progressOnTrack = 0.25;
    } else if (i === 110) {
      status = 'IN_TRANSIT';
      variantId = 'V1';
      coneQuantity = 32;
      location = 'OHC_SEGMENT_1';
      progressOnTrack = 0.12;
    } else if (i === 152) {
      // Star basket of the demo scenario / story mode!
      status = 'EMPTY';
      variantId = null;
      coneQuantity = 0;
      location = 'EMPTY_POOL_READY';
      progressOnTrack = 0;
    } else if (i <= 47) {
      status = 'EMPTY';
      location = 'EMPTY_BUFFER';
    } else if (i <= 250) {
      status = 'LOADED'; // stored in overhead circulation / buffers
      variantId = VARIANTS[(i % 4)].id;
      coneQuantity = 32;
      location = 'OVERHEAD_STORAGE';
    } else {
      status = 'EMPTY';
      location = 'EMPTY_BUFFER';
    }

    baskets.push({
      id,
      status,
      variantId,
      coneQuantity,
      location,
      progressOnTrack,
      assignedLoader,
      assignedUnloader,
      isStoryHighlight: (id === 'B152'),
    });
  }

  return baskets;
};
