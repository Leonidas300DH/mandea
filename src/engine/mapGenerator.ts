import {
  BiomeType,
  CapitalBuildingId,
  DungeonSite,
  Point,
  RiverSegment,
  StaticMonster,
  Zone,
} from '../types/game';

export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1050;

export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clipPolygonHalfPlane(poly: Point[], siteA: Point, siteB: Point): Point[] {
  if (poly.length === 0) return [];
  const midX = (siteA.x + siteB.x) * 0.5;
  const midY = (siteA.y + siteB.y) * 0.5;
  const nx = siteB.x - siteA.x;
  const ny = siteB.y - siteA.y;

  const inside = (p: Point) => (p.x - midX) * nx + (p.y - midY) * ny <= 1e-6;
  const intersect = (p1: Point, p2: Point): Point => {
    const d1 = (p1.x - midX) * nx + (p1.y - midY) * ny;
    const d2 = (p2.x - midX) * nx + (p2.y - midY) * ny;
    const denom = d1 - d2;
    if (Math.abs(denom) < 1e-9) return p1;
    const t = d1 / denom;
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
    };
  };

  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const currIn = inside(curr);
    const prevIn = inside(prev);
    if (currIn) {
      if (!prevIn) out.push(intersect(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersect(prev, curr));
    }
  }
  return out;
}

function polygonCentroid(poly: Point[]): Point {
  if (poly.length === 0) return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const cross = p1.x * p2.y - p2.x * p1.y;
    area += cross;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
  }
  if (Math.abs(area) < 1e-5) {
    const sx = poly.reduce((acc, p) => acc + p.x, 0) / poly.length;
    const sy = poly.reduce((acc, p) => acc + p.y, 0) / poly.length;
    return { x: sx, y: sy };
  }
  area *= 0.5;
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function computeVoronoiCells(sites: Point[]): Point[][] {
  const baseRect: Point[] = [
    { x: 0, y: 0 },
    { x: MAP_WIDTH, y: 0 },
    { x: MAP_WIDTH, y: MAP_HEIGHT },
    { x: 0, y: MAP_HEIGHT },
  ];
  return sites.map((siteA, i) => {
    let cell = baseRect;
    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue;
      cell = clipPolygonHalfPlane(cell, siteA, sites[j]);
      if (cell.length === 0) break;
    }
    return cell;
  });
}

function buildSmoothClosedPath(pts: Point[]): string {
  if (pts.length < 3) return '';
  // Light organic rounding on already-perturbed shared vertices keeps borders lush and pixel-crisp
  const parts: string[] = [`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`];
  for (let i = 1; i < pts.length; i++) {
    parts.push(`L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

const REGION_PREFIXES: Record<BiomeType, string[]> = {
  capital: ['Cité Franche de', 'Bastion Royal de', 'Couronne de'],
  plains: ['Val Doré', 'Champs d’Aurore', 'Plaine des Blés', 'Terres Claires', 'Clos Solaire', 'Vaux Fertiles'],
  pasture: ['Prés d’Émeraude', 'Vallon des Brises', 'Combe Verte', 'Pâtures d’Argent', 'Bocage Fleuri'],
  forest: ['Bois des Murmures', 'Futaie d’Ambre', 'Sylve Profonde', 'Chênaie Ancienne', 'Forêt de Clairval'],
  hills: ['Crêtes de Fer', 'Monts d’Ocre', 'Collines Grises', 'Pics du Vent', 'Roches-Hautes'],
  marsh: ['Landes Brumeuses', 'Tourbières d’Écume', 'Marais des Saules', 'Val d’Eau-Vive'],
  ruins: ['Tertres Oubliés', 'Marches Anciennes', 'Colonnes Brisées', 'Val des Rois Déchus'],
  water: ['Mer des Brumes'],
};

const REGION_SUFFIXES = [
  'du Nord',
  'du Levant',
  'du Couchant',
  'du Midi',
  'd’Albe',
  'de Haute-Pierre',
  'des Cerfs',
  'des Sources',
  'de Clair-Ruisseau',
  'd’Or-Feuille',
  'de Val-Fier',
  'des Anciens',
];

const DUNGEON_NAMES = [
  { name: 'Crypte du Roi Sans-Couronne', theme: 'crypt' as const },
  { name: 'Tour Scellée d’Astrolabe', theme: 'tower' as const },
  { name: 'Forge Engloutie du Premier Âge', theme: 'mine' as const },
  { name: 'Sanctuaire des Racines Noires', theme: 'shrine' as const },
  { name: 'Catacombes d’Albâtre', theme: 'crypt' as const },
  { name: 'Observatoire des Éclipses', theme: 'tower' as const },
];

export function generateOrganicWorld(seed: number): {
  zones: Record<string, Zone>;
  zoneOrder: string[];
  capitalZoneId: string;
  rivers: RiverSegment[];
} {
  const rng = createRng(seed);

  // 1. Sample irregular organic points (strictly NO hex grid!) — spacious provinces like After Inc!
  const siteCount = 30;
  let sites: Point[] = [];
  let attempts = 0;
  const minDist = 172;

  // Ensure a nice central point for the Capital
  sites.push({
    x: MAP_WIDTH * 0.5 + (rng() - 0.5) * 50,
    y: MAP_HEIGHT * 0.5 + (rng() - 0.5) * 45,
  });

  while (sites.length < siteCount && attempts < 5000) {
    attempts++;
    const candidate: Point = {
      x: 65 + rng() * (MAP_WIDTH - 130),
      y: 65 + rng() * (MAP_HEIGHT - 130),
    };
    const ok = sites.every((s) => Math.hypot(s.x - candidate.x, s.y - candidate.y) >= minDist);
    if (ok) sites.push(candidate);
  }

  // 2. Two passes of partial Lloyd relaxation so territories have natural varied shapes (not uniform!)
  for (let pass = 0; pass < 2; pass++) {
    const rawCells = computeVoronoiCells(sites);
    sites = rawCells.map((cell, idx) => {
      if (idx === 0) return sites[0]; // Keep capital anchored near center
      const c = polygonCentroid(cell);
      // Blend 68% toward centroid to preserve organic asymmetry
      return {
        x: sites[idx].x * 0.32 + c.x * 0.68,
        y: sites[idx].y * 0.32 + c.y * 0.68,
      };
    });
  }

  const rawCells = computeVoronoiCells(sites);

  // 3. Canonicalize vertices and perturb shared edges organically so ZERO straight geometric edges remain!
  const canonicalVerts: Point[] = [];
  const getVertexId = (p: Point): number => {
    for (let i = 0; i < canonicalVerts.length; i++) {
      if (Math.hypot(canonicalVerts[i].x - p.x, canonicalVerts[i].y - p.y) < 1.2) {
        return i;
      }
    }
    canonicalVerts.push({ x: p.x, y: p.y });
    return canonicalVerts.length - 1;
  };

  const cellVertIds: number[][] = rawCells.map((poly) => {
    const ids: number[] = [];
    for (const p of poly) {
      const id = getVertexId(p);
      if (ids.length === 0 || ids[ids.length - 1] !== id) {
        ids.push(id);
      }
    }
    if (ids.length > 1 && ids[0] === ids[ids.length - 1]) ids.pop();
    return ids;
  });

  // Track which cells share each canonical undirected edge
  const edgeToCells = new Map<string, number[]>();
  const edgePointsCache = new Map<string, Point[]>();

  const makeEdgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);

  cellVertIds.forEach((vIds, cellIdx) => {
    for (let i = 0; i < vIds.length; i++) {
      const a = vIds[i];
      const b = vIds[(i + 1) % vIds.length];
      const key = makeEdgeKey(a, b);
      const list = edgeToCells.get(key) ?? [];
      if (!list.includes(cellIdx)) list.push(cellIdx);
      edgeToCells.set(key, list);
    }
  });

  // Generate wavy organic sub-points for every interior edge
  const getOrganicEdgePoints = (fromId: number, toId: number): Point[] => {
    const pFrom = canonicalVerts[fromId];
    const pTo = canonicalVerts[toId];
    const onMapBorder =
      (pFrom.x <= 1 && pTo.x <= 1) ||
      (pFrom.x >= MAP_WIDTH - 1 && pTo.x >= MAP_WIDTH - 1) ||
      (pFrom.y <= 1 && pTo.y <= 1) ||
      (pFrom.y >= MAP_HEIGHT - 1 && pTo.y >= MAP_HEIGHT - 1);

    if (onMapBorder) {
      return [pFrom, pTo];
    }

    const low = Math.min(fromId, toId);
    const high = Math.max(fromId, toId);
    const key = `${low}_${high}`;

    let canonicalChain = edgePointsCache.get(key);
    if (!canonicalChain) {
      const A = canonicalVerts[low];
      const B = canonicalVerts[high];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const len = Math.hypot(dx, dy);

      if (len < 18) {
        canonicalChain = [A, B];
      } else {
        const nx = -dy / len;
        const ny = dx / len;
        const amp = Math.min(16, len * 0.14);
        const s1 = (rng() - 0.5) * 2 * amp;
        const s2 = (rng() - 0.5) * 2 * amp * 1.15;
        const s3 = (rng() - 0.5) * 2 * amp;

        canonicalChain = [
          A,
          { x: A.x + dx * 0.25 + nx * s1, y: A.y + dy * 0.25 + ny * s1 },
          { x: A.x + dx * 0.5 + nx * s2, y: A.y + dy * 0.5 + ny * s2 },
          { x: A.x + dx * 0.75 + nx * s3, y: A.y + dy * 0.75 + ny * s3 },
          B,
        ];
      }
      edgePointsCache.set(key, canonicalChain);
    }

    return fromId === low ? canonicalChain : [...canonicalChain].reverse();
  };

  // Build organic polygons & neighbor adjacency
  const neighborsMap: number[][] = Array.from({ length: sites.length }, () => []);
  edgeToCells.forEach((cells) => {
    if (cells.length === 2) {
      const [c1, c2] = cells;
      if (!neighborsMap[c1].includes(c2)) neighborsMap[c1].push(c2);
      if (!neighborsMap[c2].includes(c1)) neighborsMap[c2].push(c1);
    }
  });

  const organicPolygons: Point[][] = cellVertIds.map((vIds) => {
    const pts: Point[] = [];
    for (let i = 0; i < vIds.length; i++) {
      const a = vIds[i];
      const b = vIds[(i + 1) % vIds.length];
      const seg = getOrganicEdgePoints(a, b);
      // Append all except last point (which starts next segment)
      for (let k = 0; k < seg.length - 1; k++) {
        pts.push(seg[k]);
      }
    }
    return pts;
  });

  // 4. Determine Water vs Land using organic angular island mask
  const phase1 = rng() * Math.PI * 2;
  const phase2 = rng() * Math.PI * 2;
  const isWaterIdx = new Set<number>();

  sites.forEach((p, idx) => {
    if (idx === 0) return;
    const touchesFrame = rawCells[idx].some(
      (v) => v.x <= 2 || v.x >= MAP_WIDTH - 2 || v.y <= 2 || v.y >= MAP_HEIGHT - 2
    );
    const nx = (p.x - MAP_WIDTH * 0.5) / (MAP_WIDTH * 0.46);
    const ny = (p.y - MAP_HEIGHT * 0.5) / (MAP_HEIGHT * 0.45);
    const angle = Math.atan2(ny, nx);
    const radialWobble =
      0.88 + 0.12 * Math.sin(angle * 3 + phase1) + 0.09 * Math.cos(angle * 5 + phase2);
    const normDist = Math.hypot(nx, ny);

    if (touchesFrame || normDist > radialWobble) {
      isWaterIdx.add(idx);
    }
  });

  // Ensure Capital neighbors are ALWAYS land so the capital is never pinched
  for (const nIdx of neighborsMap[0]) {
    isWaterIdx.delete(nIdx);
  }

  // 5. Assign Biomes with balanced starting ring around Capital (idx 0)
  const biomes: BiomeType[] = new Array(sites.length).fill('plains');
  biomes[0] = 'capital';
  isWaterIdx.forEach((idx) => {
    biomes[idx] = 'water';
  });

  const capLandNeighbors = neighborsMap[0].filter((n) => !isWaterIdx.has(n));
  const guaranteedStarterBiomes: BiomeType[] = ['plains', 'forest', 'pasture', 'hills', 'ruins', 'plains'];
  capLandNeighbors.forEach((nIdx, i) => {
    biomes[nIdx] = guaranteedStarterBiomes[i % guaranteedStarterBiomes.length];
  });

  for (let idx = 1; idx < sites.length; idx++) {
    if (isWaterIdx.has(idx) || capLandNeighbors.includes(idx)) continue;
    const roll = rng();
    if (roll < 0.25) biomes[idx] = 'plains';
    else if (roll < 0.46) biomes[idx] = 'forest';
    else if (roll < 0.64) biomes[idx] = 'pasture';
    else if (roll < 0.81) biomes[idx] = 'hills';
    else if (roll < 0.91) biomes[idx] = 'marsh';
    else biomes[idx] = 'ruins';
  }

  // 6. Generate 3 scenic organic Rivers along shared land cell borders from interior hills to water
  const rivers: RiverSegment[] = [];
  const hillCells = sites
    .map((_, idx) => idx)
    .filter((idx) => !isWaterIdx.has(idx) && (biomes[idx] === 'hills' || biomes[idx] === 'forest'));

  for (let r = 0; r < 3 && hillCells.length > 0; r++) {
    const startCell = hillCells[Math.floor(rng() * hillCells.length)];
    const startVerts = cellVertIds[startCell];
    if (startVerts.length === 0) continue;
    let currV = startVerts[Math.floor(rng() * startVerts.length)];
    const visitedV = new Set<number>([currV]);
    const riverPts: Point[] = [canonicalVerts[currV]];

    for (let step = 0; step < 12; step++) {
      // Find connected vertices via edgeToCells that move closer to coast/outer map
      const candidates: number[] = [];
      edgeToCells.forEach((cells, key) => {
        const [aStr, bStr] = key.split('_');
        const a = Number(aStr);
        const b = Number(bStr);
        if (a === currV && !visitedV.has(b)) candidates.push(b);
        if (b === currV && !visitedV.has(a)) candidates.push(a);
        void cells;
      });
      if (candidates.length === 0) break;
      // Pick vertex farthest from map center (flowing seaward!)
      candidates.sort((va, vb) => {
        const pa = canonicalVerts[va];
        const pb = canonicalVerts[vb];
        const da = Math.hypot(pa.x - MAP_WIDTH * 0.5, pa.y - MAP_HEIGHT * 0.5);
        const db = Math.hypot(pb.x - MAP_WIDTH * 0.5, pb.y - MAP_HEIGHT * 0.5);
        return db - da;
      });
      const nextV = candidates[0];
      const seg = getOrganicEdgePoints(currV, nextV);
      for (let k = 1; k < seg.length; k++) riverPts.push(seg[k]);
      visitedV.add(nextV);
      currV = nextV;

      // Stop once we reach a water cell vertex
      const touchesSea = Array.from(isWaterIdx).some((wIdx) => cellVertIds[wIdx].includes(currV));
      if (touchesSea) break;
    }

    if (riverPts.length >= 4) {
      rivers.push({ points: riverPts });
    }
  }

  // 7. Build Zone objects with Dungeons & Static Monsters in mid/outer territories
  const defaultCapBuildings: Record<CapitalBuildingId, number> = {
    palace: 1,
    grand_market: 0,
    cathedral: 0,
    noble_court: 0,
    barracks: 1,
    menagerie: 0,
    tavern: 1,
    walls: 1,
  };

  const emptyCapBuildings: Record<CapitalBuildingId, number> = {
    palace: 0,
    grand_market: 0,
    cathedral: 0,
    noble_court: 0,
    barracks: 0,
    menagerie: 0,
    tavern: 0,
    walls: 0,
  };

  const zones: Record<string, Zone> = {};
  const zoneOrder: string[] = [];
  const usedNames = new Set<string>();
  let dungeonCount = 0;
  let monsterCount = 0;

  // Sort non-capital land zones by distance from capital to place dungeons & monsters progressively
  const distFromCap = (idx: number) =>
    Math.hypot(sites[idx].x - sites[0].x, sites[idx].y - sites[0].y);

  for (let idx = 0; idx < sites.length; idx++) {
    const id = `zone_${idx}`;
    zoneOrder.push(id);
    const biome = biomes[idx];
    const center = polygonCentroid(organicPolygons[idx]);
    const landNeighbors = neighborsMap[idx]
      .filter((n) => !isWaterIdx.has(n))
      .map((n) => `zone_${n}`);
    const isCoastal = neighborsMap[idx].some((n) => isWaterIdx.has(n));

    // Unique regional French fantasy name
    const prefixes = REGION_PREFIXES[biome];
    let name = prefixes[Math.floor(rng() * prefixes.length)];
    if (biome !== 'water' && biome !== 'capital') {
      const candidate = `${name} ${REGION_SUFFIXES[Math.floor(rng() * REGION_SUFFIXES.length)]}`;
      name = usedNames.has(candidate) ? `${candidate} II` : candidate;
      usedNames.add(name);
    } else if (biome === 'capital') {
      name = 'Mandea-la-Haute';
    }

    const isCapital = idx === 0;
    const isStarterNeighbor = capLandNeighbors.includes(idx);
    const dist = distFromCap(idx);

    let status: Zone['status'] = 'unexplored';
    if (isCapital) status = 'claimed';
    else if (isStarterNeighbor || biome === 'water') status = 'explored';

    let dungeon: DungeonSite | null = null;
    let staticMonster: StaticMonster | null = null;

    if (!isWaterIdx.has(idx) && !isCapital) {
      if (isStarterNeighbor && biome === 'ruins' && dungeonCount === 0) {
        // Guaranteed visible 1-star starter Dungeon right on the horizon so Hero expeditions are obvious!
        const dTemplate = DUNGEON_NAMES[0];
        dungeon = {
          id: `dng_${idx}`,
          name: dTemplate.name,
          theme: dTemplate.theme,
          stars: 1,
          cleared: false,
          corrupted: false,
          activeHeroId: null,
          progress: 0,
          stage: 1,
          maxStages: 3,
          pendingEvent: null,
        };
        dungeonCount++;
      } else if (!isStarterNeighbor) {
        // Place Dungeons on Ruins or occasional deep Forests/Hills
        if (biome === 'ruins' || (dungeonCount < 4 && dist > 230 && rng() < 0.24)) {
          const dTemplate = DUNGEON_NAMES[dungeonCount % DUNGEON_NAMES.length];
          const stars: 1 | 2 | 3 = dist > 410 ? 3 : dist > 290 ? 2 : 1;
          dungeon = {
            id: `dng_${idx}`,
            name: dTemplate.name,
            theme: dTemplate.theme,
            stars,
            cleared: false,
            corrupted: stars >= 2 && rng() < 0.45,
            activeHeroId: null,
            progress: 0,
            stage: 1,
            maxStages: 3,
            pendingEvent: null,
          };
          dungeonCount++;
        } else if (dist > 205 && rng() < 0.42) {
          // Place Static Territorial Monster guarding rich outer lands!
          const rollM = rng();
          if (rollM < 0.34 || biome === 'hills') {
            staticMonster = {
              id: `mon_${idx}`,
              name: 'Troll Cuirassé des Crêtes',
              kind: 'troll',
              units: { monster_troll: dist > 380 ? 2 : 1, raider_goblin: 3 },
              rewardGold: 55,
              rewardIron: 28,
              description: 'Un colosse territorial qui interdit toute construction tant qu’il vit.',
            };
          } else if (rollM < 0.68 || biome === 'forest' || biome === 'marsh') {
            staticMonster = {
              id: `mon_${idx}`,
              name: 'Reine Arachnide Sylvestre',
              kind: 'spider_queen',
              units: { monster_spider: dist > 380 ? 2 : 1 },
              rewardGold: 50,
              rewardIron: 16,
              description: 'Ses toiles géantes étouffent la forêt. Des tireurs perce-armure seront précieux.',
            };
          } else {
            staticMonster = {
              id: `mon_${idx}`,
              name: 'Wyverne Émeraude',
              kind: 'wyvern',
              units: { monster_wyvern: 1 },
              rewardGold: 80,
              rewardIron: 24,
              description: 'Redoutable drake perché sur un trésor d’or ancien.',
            };
          }
          monsterCount++;
          void monsterCount;
        }
      }
    }

    zones[id] = {
      id,
      name,
      biome,
      polygon: organicPolygons[idx],
      smoothPath: buildSmoothClosedPath(organicPolygons[idx]),
      center,
      neighbors: biome === 'water' ? [] : landNeighbors,
      isCoastal,
      decorSeed: Math.floor(rng() * 100000),
      status,
      exploreProgress: status === 'unexplored' ? 0 : 100,
      roadLevel: isCapital ? 1 : 0,
      resourceBuilding: null,
      civicBuildings: [],
      capitalBuildings: isCapital ? { ...defaultCapBuildings } : { ...emptyCapBuildings },
      fortHp: isCapital ? 180 : 0,
      maxFortHp: isCapital ? 180 : 0,
      pillagedTimer: 0,
      dungeon,
      staticMonster,
    };
  }

  return {
    zones,
    zoneOrder,
    capitalZoneId: 'zone_0',
    rivers,
  };
}
