import { SEASONS } from '../data/buildings';
import { RACES } from '../data/races';
import { MAP_WIDTH } from './mapGenerator';
import { BiomeType, GameState, Point, Season } from '../types/game';

// Crisp 16-bit fantasy pixel-art terrain buffer (1 pixel = 2 world units -> 800x525 pixels)
export const PIXEL_W = 800;
export const PIXEL_H = 525;
export const WORLD_TO_PX = PIXEL_W / MAP_WIDTH; // 0.5

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function hash2D(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x: number, y: number, seed: number): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 3; i++) {
    val += amp * valueNoise2D(x * freq, y * freq, seed + i * 97);
    freq *= 2.03;
    amp *= 0.5;
  }
  return val;
}

interface BiomeShades {
  tones: [RGB, RGB, RGB, RGB];
  accent?: RGB;
}

const SEASON_BIOME_PALETTES: Record<Season, Record<Exclude<BiomeType, 'water'>, BiomeShades>> = {
  spring: {
    capital: {
      tones: [hexToRgb('#4f9e3a'), hexToRgb('#65b848'), hexToRgb('#7fd15a'), hexToRgb('#9ce36f')],
      accent: hexToRgb('#fde047'),
    },
    plains: {
      tones: [hexToRgb('#52a33b'), hexToRgb('#69bd4a'), hexToRgb('#84d45d'), hexToRgb('#a0e675')],
      accent: hexToRgb('#fb7185'),
    },
    pasture: {
      tones: [hexToRgb('#489c45'), hexToRgb('#5db554'), hexToRgb('#77cf69'), hexToRgb('#96e384')],
      accent: hexToRgb('#ffffff'), // Wild clover & sheep flecks
    },
    forest: {
      tones: [hexToRgb('#1e5c34'), hexToRgb('#287340'), hexToRgb('#368c4e'), hexToRgb('#4aa660')],
      accent: hexToRgb('#86efac'),
    },
    hills: {
      tones: [hexToRgb('#626f58'), hexToRgb('#7a876a'), hexToRgb('#93a17e'), hexToRgb('#acb995')],
      accent: hexToRgb('#e2e8f0'),
    },
    marsh: {
      tones: [hexToRgb('#2d6b5f'), hexToRgb('#3c8273'), hexToRgb('#4f9b88'), hexToRgb('#68b39e')],
      accent: hexToRgb('#67e8f9'),
    },
    ruins: {
      tones: [hexToRgb('#597560'), hexToRgb('#708f75'), hexToRgb('#89a88c'), hexToRgb('#a3bfa4')],
      accent: hexToRgb('#f1f5f9'),
    },
  },
  summer: {
    capital: {
      tones: [hexToRgb('#589c34'), hexToRgb('#72b540'), hexToRgb('#8dcd50'), hexToRgb('#a9e066')],
      accent: hexToRgb('#facc15'),
    },
    plains: {
      tones: [hexToRgb('#65a333'), hexToRgb('#80bd3f'), hexToRgb('#9cd450'), hexToRgb('#b8e667')],
      accent: hexToRgb('#fde047'),
    },
    pasture: {
      tones: [hexToRgb('#4c9436'), hexToRgb('#63ad43'), hexToRgb('#7cc754'), hexToRgb('#98de6c')],
      accent: hexToRgb('#fef9c3'),
    },
    forest: {
      tones: [hexToRgb('#184f2b'), hexToRgb('#226637'), hexToRgb('#2f7f45'), hexToRgb('#409856')],
    },
    hills: {
      tones: [hexToRgb('#6d7554'), hexToRgb('#858d67'), hexToRgb('#9ea67c'), hexToRgb('#b7bf94')],
    },
    marsh: {
      tones: [hexToRgb('#2a6156'), hexToRgb('#38786a'), hexToRgb('#4a8f7e'), hexToRgb('#61a895')],
    },
    ruins: {
      tones: [hexToRgb('#5e7558'), hexToRgb('#758f6b'), hexToRgb('#8ea881'), hexToRgb('#a8c299')],
    },
  },
  autumn: {
    capital: {
      tones: [hexToRgb('#8f7b32'), hexToRgb('#ab933e'), hexToRgb('#c7ad4f'), hexToRgb('#e2c666')],
      accent: hexToRgb('#f97316'),
    },
    plains: {
      tones: [hexToRgb('#997a33'), hexToRgb('#b59240'), hexToRgb('#d1aa50'), hexToRgb('#e8c167')],
      accent: hexToRgb('#ea580c'),
    },
    pasture: {
      tones: [hexToRgb('#7a8a3a'), hexToRgb('#94a448'), hexToRgb('#aec059'), hexToRgb('#c7d970')],
    },
    forest: {
      tones: [hexToRgb('#5e3a22'), hexToRgb('#7d4d2b'), hexToRgb('#9e6336'), hexToRgb('#bf7b43')],
      accent: hexToRgb('#ef4444'),
    },
    hills: {
      tones: [hexToRgb('#706453'), hexToRgb('#897b66'), hexToRgb('#a3937b'), hexToRgb('#bca991')],
    },
    marsh: {
      tones: [hexToRgb('#475e4d'), hexToRgb('#5b7561'), hexToRgb('#718f77'), hexToRgb('#8aa890')],
    },
    ruins: {
      tones: [hexToRgb('#6e6852'), hexToRgb('#878066'), hexToRgb('#a1997c'), hexToRgb('#bab293')],
    },
  },
  winter: {
    capital: {
      tones: [hexToRgb('#9eb8d4'), hexToRgb('#bad1e8'), hexToRgb('#d7e7f5'), hexToRgb('#f2f8fd')],
    },
    plains: {
      tones: [hexToRgb('#9cb6d1'), hexToRgb('#b8cfe6'), hexToRgb('#d5e5f4'), hexToRgb('#eff6fc')],
    },
    pasture: {
      tones: [hexToRgb('#95b2cf'), hexToRgb('#b2cce4'), hexToRgb('#cfe2f2'), hexToRgb('#eaf3fb')],
    },
    forest: {
      tones: [hexToRgb('#5c828c'), hexToRgb('#769da6'), hexToRgb('#93b7bf'), hexToRgb('#b3d1d8')],
    },
    hills: {
      tones: [hexToRgb('#7c8fa3'), hexToRgb('#96a8ba'), hexToRgb('#b3c3d1'), hexToRgb('#d2dee8')],
    },
    marsh: {
      tones: [hexToRgb('#6f919e'), hexToRgb('#89abb8'), hexToRgb('#a6c5d1'), hexToRgb('#c5dfe8')],
    },
    ruins: {
      tones: [hexToRgb('#859ab0'), hexToRgb('#9fb3c7'), hexToRgb('#bccdde'), hexToRgb('#dae6f2')],
    },
  },
};

export interface StaticMapCache {
  seed: number;
  zoneIds: string[];
  zoneIdxGrid: Uint16Array;
  isWaterGrid: Uint8Array;
  coastDistGrid: Uint8Array;
  elevGrid: Float32Array;
  cloudGrid: Float32Array;
  borderNeighborGrid: Int16Array; // -1 if interior pixel, else index of adjacent land zone within 2px!
  visualCentersPx: Point[];       // Exact pixel centroid of each warped organic cell
  visualCentersWorld: Record<string, Point>; // Exact world-space centroid (1600x1050) for sprites & UI!
  treeSpots: { px: number; py: number; zIdx: number; variant: number }[];
  peakSpots: { px: number; py: number; zIdx: number; size: number }[];
}

export function buildStaticMapCache(state: GameState): StaticMapCache {
  const zoneIds = state.zoneOrder;
  const zoneCount = zoneIds.length;
  const seedCenters = zoneIds.map((id) => ({
    x: state.zones[id].center.x * WORLD_TO_PX,
    y: state.zones[id].center.y * WORLD_TO_PX,
    isWater: state.zones[id].biome === 'water',
    biome: state.zones[id].biome,
  }));

  const total = PIXEL_W * PIXEL_H;
  const zoneIdxGrid = new Uint16Array(total);
  const isWaterGrid = new Uint8Array(total);
  const elevGrid = new Float32Array(total);
  const cloudGrid = new Float32Array(total);

  const sumX = new Float64Array(zoneCount);
  const sumY = new Float64Array(zoneCount);
  const countPx = new Uint32Array(zoneCount);

  // 1. Assign every pixel to its organic noise-warped province (strictly NO hexagons!)
  for (let py = 0; py < PIXEL_H; py++) {
    for (let px = 0; px < PIXEL_W; px++) {
      const idx = py * PIXEL_W + px;
      const wx = (fbm2D(px * 0.036, py * 0.036, state.seed + 11) - 0.43) * 28;
      const wy = (fbm2D(px * 0.036 + 31.7, py * 0.036 + 19.3, state.seed + 29) - 0.43) * 28;
      const qx = px + wx;
      const qy = py + wy;

      let bestI = 0;
      let bestD2 = Infinity;
      for (let i = 0; i < zoneCount; i++) {
        const dx = qx - seedCenters[i].x;
        const dy = qy - seedCenters[i].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestI = i;
        }
      }

      zoneIdxGrid[idx] = bestI;
      isWaterGrid[idx] = seedCenters[bestI].isWater ? 1 : 0;
      elevGrid[idx] = fbm2D(px * 0.075, py * 0.075, state.seed + 71);
      cloudGrid[idx] = fbm2D(px * 0.042, py * 0.042, state.seed + 137);

      sumX[bestI] += px;
      sumY[bestI] += py;
      countPx[bestI]++;
    }
  }

  const visualCentersPx: Point[] = [];
  const visualCentersWorld: Record<string, Point> = {};
  for (let i = 0; i < zoneCount; i++) {
    const cx = countPx[i] > 0 ? sumX[i] / countPx[i] : seedCenters[i].x;
    const cy = countPx[i] > 0 ? sumY[i] / countPx[i] : seedCenters[i].y;
    visualCentersPx.push({ x: cx, y: cy });
    visualCentersWorld[zoneIds[i]] = {
      x: cx / WORLD_TO_PX,
      y: cy / WORLD_TO_PX,
    };
  }

  // 2. Chamfer distance transform from shoreline (water <-> land) up to 36px
  const coastDistGrid = new Uint8Array(total);
  const INF = 250;
  const distTmp = new Uint8Array(total);
  distTmp.fill(INF);

  for (let py = 1; py < PIXEL_H - 1; py++) {
    for (let px = 1; px < PIXEL_W - 1; px++) {
      const idx = py * PIXEL_W + px;
      const w = isWaterGrid[idx];
      if (
        isWaterGrid[idx - 1] !== w ||
        isWaterGrid[idx + 1] !== w ||
        isWaterGrid[idx - PIXEL_W] !== w ||
        isWaterGrid[idx + PIXEL_W] !== w
      ) {
        distTmp[idx] = 0;
      }
    }
  }

  for (let py = 1; py < PIXEL_H - 1; py++) {
    for (let px = 1; px < PIXEL_W - 1; px++) {
      const idx = py * PIXEL_W + px;
      let d = distTmp[idx];
      if (d === 0) continue;
      d = Math.min(
        d,
        distTmp[idx - 1] + 3,
        distTmp[idx - PIXEL_W] + 3,
        distTmp[idx - PIXEL_W - 1] + 4,
        distTmp[idx - PIXEL_W + 1] + 4
      );
      distTmp[idx] = d;
    }
  }

  for (let py = PIXEL_H - 2; py >= 1; py--) {
    for (let px = PIXEL_W - 2; px >= 1; px--) {
      const idx = py * PIXEL_W + px;
      let d = distTmp[idx];
      d = Math.min(
        d,
        distTmp[idx + 1] + 3,
        distTmp[idx + PIXEL_W] + 3,
        distTmp[idx + PIXEL_W - 1] + 4,
        distTmp[idx + PIXEL_W + 1] + 4
      );
      distTmp[idx] = d;
      coastDistGrid[idx] = Math.min(36, Math.floor(d / 3));
    }
  }

  // 3. Detect crisp 2px land province borders for clean royal frontiers & selection glow
  const borderNeighborGrid = new Int16Array(total);
  borderNeighborGrid.fill(-1);
  for (let py = 2; py < PIXEL_H - 2; py++) {
    for (let px = 2; px < PIXEL_W - 2; px++) {
      const idx = py * PIXEL_W + px;
      if (isWaterGrid[idx]) continue;
      const z = zoneIdxGrid[idx];
      const candidates = [
        idx - 1,
        idx + 1,
        idx - PIXEL_W,
        idx + PIXEL_W,
        idx - 2,
        idx + 2,
        idx - PIXEL_W * 2,
        idx + PIXEL_W * 2,
      ];
      for (const nIdx of candidates) {
        if (!isWaterGrid[nIdx] && zoneIdxGrid[nIdx] !== z) {
          borderNeighborGrid[idx] = zoneIdxGrid[nIdx];
          break;
        }
      }
    }
  }

  // 4. Scatter pixel-art woodland trees & mountain peaks around the perimeter of provinces
  // (Leaving a generous sunlit clearing around visualCentersPx so buildings & sprites stand out cleanly!)
  const treeSpots: StaticMapCache['treeSpots'] = [];
  const peakSpots: StaticMapCache['peakSpots'] = [];

  for (let py = 16; py < PIXEL_H - 16; py += 6) {
    for (let px = 16; px < PIXEL_W - 16; px += 6) {
      const jx = px + Math.floor((hash2D(px, py, state.seed + 3) - 0.5) * 4);
      const jy = py + Math.floor((hash2D(px, py, state.seed + 9) - 0.5) * 4);
      const idx = jy * PIXEL_W + jx;
      if (isWaterGrid[idx] || coastDistGrid[idx] < 5) continue;

      const zIdx = zoneIdxGrid[idx];
      const biome = seedCenters[zIdx].biome;
      const vc = visualCentersPx[zIdx];
      const distToCenter = Math.hypot(jx - vc.x, jy - vc.y);

      // Keep center open for crisp isometric landmark sprites!
      const clearRadius = biome === 'capital' ? 40 : 28;
      if (distToCenter < clearRadius) continue;

      const h = hash2D(jx, jy, state.seed + 55);
      if (biome === 'hills' && h < 0.24) {
        peakSpots.push({ px: jx, py: jy, zIdx, size: h < 0.1 ? 2 : 1 });
      } else {
        const treeProb =
          biome === 'forest'
            ? 0.66
            : biome === 'marsh'
              ? 0.24
              : biome === 'pasture'
                ? 0.14
                : biome === 'hills'
                  ? 0.18
                  : biome === 'ruins'
                    ? 0.22
                    : 0.09;
        if (h < treeProb) {
          treeSpots.push({
            px: jx,
            py: jy,
            zIdx,
            variant: Math.floor(h * 100) % 4,
          });
        }
      }
    }
  }

  treeSpots.sort((a, b) => a.py - b.py);
  peakSpots.sort((a, b) => a.py - b.py);

  return {
    seed: state.seed,
    zoneIds,
    zoneIdxGrid,
    isWaterGrid,
    coastDistGrid,
    elevGrid,
    cloudGrid,
    borderNeighborGrid,
    visualCentersPx,
    visualCentersWorld,
    treeSpots,
    peakSpots,
  };
}

function setPx(data: Uint8ClampedArray, px: number, py: number, r: number, g: number, b: number, alpha = 1) {
  if (px < 0 || px >= PIXEL_W || py < 0 || py >= PIXEL_H) return;
  const off = (py * PIXEL_W + px) * 4;
  if (alpha >= 1) {
    data[off] = r;
    data[off + 1] = g;
    data[off + 2] = b;
    data[off + 3] = 255;
  } else {
    data[off] = data[off] + (r - data[off]) * alpha;
    data[off + 1] = data[off + 1] + (g - data[off + 1]) * alpha;
    data[off + 2] = data[off + 2] + (b - data[off + 2]) * alpha;
    data[off + 3] = 255;
  }
}

function stampPixelTree(
  data: Uint8ClampedArray,
  cx: number,
  cy: number,
  season: Season,
  variant: number,
  dimmed: boolean
) {
  let dark: RGB = [20, 68, 38];
  let mid: RGB = [34, 114, 54];
  let bright: RGB = [68, 162, 78];
  let crown: RGB = [116, 208, 102];

  if (season === 'spring' && (cx * 11 + cy * 17) % 19 === 0) {
    // Occasional soft apple-blossom tree in spring (~5%)
    dark = [136, 62, 88];
    mid = [194, 102, 134];
    bright = [238, 162, 188];
    crown = [253, 218, 230];
  } else if (season === 'spring' || season === 'summer') {
    if (variant === 0) {
      // Rich deep spruce
      dark = [16, 58, 34];
      mid = [26, 94, 48];
      bright = [48, 138, 66];
      crown = [86, 182, 92];
    } else if (variant === 1) {
      // Sunlit oak
      dark = [28, 76, 32];
      mid = [48, 122, 46];
      bright = [84, 172, 68];
      crown = [134, 216, 96];
    }
  } else if (season === 'autumn') {
    if (variant % 2 === 0) {
      dark = [115, 42, 18];
      mid = [176, 74, 24];
      bright = [224, 122, 34];
      crown = [250, 184, 62];
    } else {
      dark = [110, 24, 28];
      mid = [166, 38, 38];
      bright = [214, 68, 52];
      crown = [245, 130, 72];
    }
  } else if (season === 'winter') {
    dark = [36, 72, 78];
    mid = [58, 102, 108];
    bright = [196, 220, 236];
    crown = [248, 252, 255];
  }

  const alpha = dimmed ? 0.28 : 1;

  for (let dx = -4; dx <= 5; dx++) {
    setPx(data, cx + dx, cy + 2, 12, 24, 20, dimmed ? 0.08 : 0.3);
    setPx(data, cx + dx, cy + 1, 12, 24, 20, dimmed ? 0.06 : 0.22);
  }

  for (let dy = -1; dy <= 1; dy++) {
    setPx(data, cx, cy + dy, 92, 56, 32, alpha);
    setPx(data, cx + 1, cy + dy, 64, 38, 22, alpha);
  }

  const rows: { y: number; x1: number; x2: number }[] = [
    { y: -10, x1: -1, x2: 1 },
    { y: -9, x1: -2, x2: 2 },
    { y: -8, x1: -3, x2: 3 },
    { y: -7, x1: -4, x2: 4 },
    { y: -6, x1: -4, x2: 4 },
    { y: -5, x1: -5, x2: 5 },
    { y: -4, x1: -5, x2: 5 },
    { y: -3, x1: -5, x2: 5 },
    { y: -2, x1: -4, x2: 4 },
    { y: -1, x1: -2, x2: 2 },
  ];

  for (const r of rows) {
    for (let dx = r.x1; dx <= r.x2; dx++) {
      const isEdge = dx === r.x1 || dx === r.x2 || r.y === -10;
      let col: RGB;
      if (isEdge && (dx > 0 || r.y > -3)) {
        col = [18, 32, 24];
      } else if (r.y <= -8 && dx <= 0) {
        col = crown;
      } else if (dx <= -1 && r.y <= -4) {
        col = bright;
      } else if (dx >= 2 || r.y >= -2) {
        col = dark;
      } else {
        col = mid;
      }
      setPx(data, cx + dx, cy + r.y, col[0], col[1], col[2], alpha);
    }
  }
}

function stampPixelPeak(
  data: Uint8ClampedArray,
  cx: number,
  cy: number,
  season: Season,
  size: number,
  dimmed: boolean
) {
  const h = size === 2 ? 15 : 10;
  const halfW = size === 2 ? 14 : 9;
  const alpha = dimmed ? 0.28 : 1;
  const snowLine = season === 'winter' ? Math.floor(h * 0.72) : Math.floor(h * 0.38);

  for (let row = 0; row < h; row++) {
    const py = cy - h + 2 + row;
    const span = Math.max(1, Math.round(((row + 1) / h) * halfW));
    for (let dx = -span; dx <= span; dx++) {
      const px = cx + dx;
      const isOutline = dx === -span || dx === span || row === 0;
      let col: RGB;
      if (isOutline) {
        col = [34, 42, 54];
      } else if (row <= snowLine + ((dx * 7 + row) % 2)) {
        col = dx < 0 ? [248, 250, 252] : [203, 213, 225];
      } else if (dx < 0) {
        col = [138, 148, 162];
      } else if (dx === 0) {
        col = [104, 116, 132];
      } else {
        col = [70, 80, 96];
      }
      setPx(data, px, py, col[0], col[1], col[2], alpha);
    }
  }
}

function drawPixelCurve(
  data: Uint8ClampedArray,
  p0: Point,
  p1: Point,
  p2: Point,
  radius: number,
  innerCol: RGB,
  borderCol: RGB,
  dashed = false
) {
  const steps = 88;
  for (let s = 0; s <= steps; s++) {
    if (dashed && Math.floor(s / 3) % 2 === 1) continue;
    const t = s / steps;
    const mt = 1 - t;
    const x = Math.round(mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x);
    const y = Math.round(mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y);

    for (let dy = -radius - 1; dy <= radius + 1; dy++) {
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d <= radius) {
          const cobble = ((x + dx) * 13 + (y + dy) * 7) % 5 === 0 ? -16 : 0;
          setPx(
            data,
            x + dx,
            y + dy,
            Math.max(0, innerCol[0] + cobble),
            Math.max(0, innerCol[1] + cobble),
            Math.max(0, innerCol[2] + cobble)
          );
        } else if (d === radius + 1) {
          setPx(data, x + dx, y + dy, borderCol[0], borderCol[1], borderCol[2], 0.8);
        }
      }
    }
  }
}

export function renderPixelTerrainToImageData(
  imgData: ImageData,
  cache: StaticMapCache,
  state: GameState,
  selectedZoneId: string | null,
  hoveredZoneId: string | null,
  moveModeActive = false
): void {
  const data = imgData.data;
  const season = state.season;
  const seasonPal = SEASON_BIOME_PALETTES[season];
  const waterDeep = hexToRgb(SEASONS[season].palette.waterDeep);
  const raceBorderRgb = hexToRgb(RACES[state.race].primaryColor);
  const goldHighlight: RGB = [253, 224, 71];
  const secededRgb: RGB = [168, 85, 247];

  const zoneCount = cache.zoneIds.length;
  const statusCode = new Uint8Array(zoneCount); // 0=unexplored, 1=explored, 2=claimed, 3=seceded
  const biomeArr: BiomeType[] = new Array(zoneCount);
  let selectedIdx = -1;
  let hoveredIdx = -1;

  for (let i = 0; i < zoneCount; i++) {
    const id = cache.zoneIds[i];
    const z = state.zones[id];
    biomeArr[i] = z.biome;
    statusCode[i] =
      z.status === 'claimed' ? 2 : z.status === 'seceded' ? 3 : z.status === 'explored' ? 1 : 0;
    if (id === selectedZoneId) selectedIdx = i;
    if (id === hoveredZoneId) hoveredIdx = i;
  }

  // 1. Base Per-Pixel Terrain, Coral Lagoons, Surf, Golden Beaches & Bayer-Dithered Biomes
  for (let py = 0; py < PIXEL_H; py++) {
    const bayerRow = BAYER_4X4[py & 3];
    for (let px = 0; px < PIXEL_W; px++) {
      const idx = py * PIXEL_W + px;
      const bayer = bayerRow[px & 3] / 16;
      const zIdx = cache.zoneIdxGrid[idx];
      const coastD = cache.coastDistGrid[idx];
      const elev = cache.elevGrid[idx];

      let r = 0;
      let g = 0;
      let b = 0;

      if (cache.isWaterGrid[idx]) {
        const ditherShift = (bayer - 0.5) * 2.4;
        const dc = coastD + ditherShift;
        if (dc < 1.8) {
          r = 240;
          g = 253;
          b = 255;
        } else if (dc < 6.5) {
          r = 56;
          g = 198;
          b = 218;
        } else if (dc < 15.0) {
          r = 38;
          g = 138;
          b = 190;
        } else {
          const wave = (px + py * 3) % 31 === 0 && bayer > 0.72 ? 22 : 0;
          r = waterDeep[0] + wave;
          g = waterDeep[1] + wave;
          b = waterDeep[2] + wave;
        }
      } else {
        const biome = biomeArr[zIdx] as Exclude<BiomeType, 'water'>;
        if (coastD <= 2 && biome !== 'hills') {
          if (season === 'winter') {
            r = 218;
            g = 230;
            b = 242;
          } else {
            const sandShade = bayer > 0.5 ? 10 : -6;
            r = 238 + sandShade;
            g = 208 + sandShade;
            b = 138 + sandShade;
          }
        } else {
          const shades = seasonPal[biome] ?? seasonPal.plains;
          const level = Math.max(0, Math.min(3.99, elev * 3.4 + (bayer - 0.5) * 0.92));
          const toneIdx = Math.min(3, Math.floor(level));
          const col = shades.tones[toneIdx];
          r = col[0];
          g = col[1];
          b = col[2];

          if (shades.accent && (px * 31 + py * 17) % 103 === 0 && bayer > 0.68) {
            r = shades.accent[0];
            g = shades.accent[1];
            b = shades.accent[2];
          }
        }

        if (biome === 'hills' && py > 2) {
          const northIdx = (py - 2) * PIXEL_W + px;
          if (biomeArr[cache.zoneIdxGrid[northIdx]] !== 'hills') {
            r = Math.round(r * 0.74);
            g = Math.round(g * 0.76);
            b = Math.round(b * 0.82);
          }
        }

        const st = statusCode[zIdx];

        // Soft Sunlit Cloud Mist on Unexplored Lands (keeps lush green/blue world harmony, never gray/brown!)
        if (st === 0) {
          const cloud = cache.cloudGrid[idx];
          const mistStrength = Math.min(0.78, 0.44 + cloud * 0.34 + (bayer - 0.5) * 0.06);
          const mistR = season === 'winter' ? 222 : 236;
          const mistG = season === 'winter' ? 234 : 242;
          const mistB = season === 'winter' ? 248 : 244;
          r = Math.round(r * (1 - mistStrength) + mistR * mistStrength);
          g = Math.round(g * (1 - mistStrength) + mistG * mistStrength);
          b = Math.round(b * (1 - mistStrength) + mistB * mistStrength);
        }

        // Crisp 2px Province & Royal Kingdom Borders
        const otherZ = cache.borderNeighborGrid[idx];
        if (otherZ >= 0) {
          const otherSt = statusCode[otherZ];
          if (zIdx === selectedIdx) {
            r = goldHighlight[0];
            g = goldHighlight[1];
            b = goldHighlight[2];
          } else if (otherZ === selectedIdx) {
            r = 120;
            g = 53;
            b = 15;
          } else if (st === 2 && otherSt !== 2) {
            // Proud Royal Kingdom Frontier!
            r = raceBorderRgb[0];
            g = raceBorderRgb[1];
            b = raceBorderRgb[2];
          } else if (st !== 2 && otherSt === 2) {
            r = 254;
            g = 240;
            b = 138;
          } else if (st === 3 || otherSt === 3) {
            r = secededRgb[0];
            g = secededRgb[1];
            b = secededRgb[2];
          } else if (moveModeActive && st !== 0 && (px + py) % 2 === 0) {
            r = 74;
            g = 222;
            b = 128;
          } else if ((px + py) % 4 === 0 && (st !== 0 || otherSt !== 0)) {
            r = Math.round(r * 0.76);
            g = Math.round(g * 0.78);
            b = Math.round(b * 0.76);
          }
        }

        // Sunlit Hover Highlight
        if (zIdx === hoveredIdx && zIdx !== selectedIdx) {
          r = Math.min(255, r + 24);
          g = Math.min(255, g + 24);
          b = Math.min(255, b + 16);
        }
      }

      const off = idx * 4;
      data[off] = r;
      data[off + 1] = g;
      data[off + 2] = b;
      data[off + 3] = 255;
    }
  }

  // 2. Carve Scenic Pixel-Art Rivers
  for (const riv of state.rivers) {
    for (let i = 0; i < riv.points.length - 1; i++) {
      const a = { x: riv.points[i].x * WORLD_TO_PX, y: riv.points[i].y * WORLD_TO_PX };
      const b = { x: riv.points[i + 1].x * WORLD_TO_PX, y: riv.points[i + 1].y * WORLD_TO_PX };
      const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      drawPixelCurve(data, a, mid, b, 1, [56, 194, 236], [29, 98, 158]);
    }
  }

  // 3. Draw Winding Pixel-Art Cobblestone & Royal Paved Roads Connecting Claimed Visual Centers!
  const drawnPairs = new Set<string>();
  for (let i = 0; i < zoneCount; i++) {
    const zId = cache.zoneIds[i];
    const z = state.zones[zId];
    if (!z || z.status !== 'claimed' || z.roadLevel === 0) continue;
    for (const nId of z.neighbors) {
      const nz = state.zones[nId];
      if (!nz || nz.status !== 'claimed') continue;
      const key = zId < nId ? `${zId}-${nId}` : `${nId}-${zId}`;
      if (drawnPairs.has(key)) continue;
      drawnPairs.add(key);

      const nIdx = cache.zoneIds.indexOf(nId);
      if (nIdx < 0) continue;

      const lvl = Math.max(z.roadLevel, nz.roadLevel);
      const p0 = cache.visualCentersPx[i];
      const p2 = cache.visualCentersPx[nIdx];
      const p1 = {
        x: (p0.x + p2.x) * 0.5 + ((z.decorSeed % 15) - 7),
        y: (p0.y + p2.y) * 0.5 + (((z.decorSeed >> 3) % 15) - 7),
      };

      if (lvl >= 2) {
        drawPixelCurve(data, p0, p1, p2, 2, [246, 218, 146], [92, 68, 44], false);
      } else {
        drawPixelCurve(data, p0, p1, p2, 1, [206, 188, 162], [104, 78, 52], false);
      }
    }
  }

  // 4. Stamp Handcrafted Multi-Tone Pixel Mountains & Woodland Trees
  for (const pk of cache.peakSpots) {
    const st = statusCode[pk.zIdx];
    stampPixelPeak(data, pk.px, pk.py, season, pk.size, st === 0);
  }

  for (const tr of cache.treeSpots) {
    const st = statusCode[tr.zIdx];
    stampPixelTree(data, tr.px, tr.py, season, tr.variant, st === 0);
  }
}
