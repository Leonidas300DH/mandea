import {
  BIOME_INFO,
  CAPITAL_BUILDINGS,
  CIVIC_BUILDINGS,
  RESOURCE_BUILDINGS,
  ROAD_UPGRADES,
  SEASONS,
} from '../data/buildings';
import {
  createTavernHeroes,
  RACES,
  RELIC_POOL,
  UNIT_DEFINITIONS,
} from '../data/races';
import {
  Army,
  ArmyOwner,
  CapitalBuildingId,
  CivicBuildingId,
  DungeonChoiceEvent,
  EstateId,
  EstateState,
  GameState,
  LogEntry,
  RaceId,
  ResourceBuildingType,
  Season,
  TaxLevel,
  Zone,
} from '../types/game';
import { generateOrganicWorld } from './mapGenerator';

const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_DURATION_SEC = 48; // 48s per season at 1x speed (~3.2 min per full year)

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function countUnits(units: Record<string, number>): number {
  return Object.values(units).reduce((sum, n) => sum + Math.max(0, Math.floor(n)), 0);
}

export function computeArmyPower(army: Army, state: GameState): number {
  let power = 0;
  for (const [uId, count] of Object.entries(army.units)) {
    if (count <= 0) continue;
    const def = UNIT_DEFINITIONS[uId];
    if (!def) continue;
    const unitVal = def.hp * 0.25 + def.meleeAtk * 1.4 + def.rangedAtk * 1.5 + def.armorPierce * 0.8 + def.defense * 1.2;
    power += unitVal * count;
  }
  if (army.heroId && state.heroes[army.heroId]) {
    const h = state.heroes[army.heroId];
    power = power * (1 + h.armyAtkAura + h.armyDefAura * 0.5) + 45 + h.level * 15;
  }
  return Math.round(power);
}

export function findShortestZonePath(
  state: GameState,
  startId: string,
  goalId: string,
  allowUnexplored = false
): string[] {
  if (startId === goalId) return [];
  const dist: Record<string, number> = { [startId]: 0 };
  const prev: Record<string, string | null> = { [startId]: null };
  const queue = new Set<string>(state.zoneOrder.filter((id) => state.zones[id]?.biome !== 'water'));

  while (queue.size > 0) {
    let best: string | null = null;
    let bestD = Infinity;
    for (const id of queue) {
      const d = dist[id] ?? Infinity;
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    if (!best || bestD === Infinity) break;
    queue.delete(best);
    if (best === goalId) break;

    const z = state.zones[best];
    if (!z) continue;
    for (const nId of z.neighbors) {
      if (!queue.has(nId)) continue;
      const nz = state.zones[nId];
      if (!nz || nz.biome === 'water') continue;
      if (!allowUnexplored && nz.status === 'unexplored' && nId !== goalId) continue;

      const roadWeight = nz.roadLevel === 2 ? 0.55 : nz.roadLevel === 1 ? 0.72 : 1.0;
      const biomeWeight = nz.biome === 'hills' || nz.biome === 'marsh' ? 1.25 : 1.0;
      const alt = bestD + roadWeight * biomeWeight;
      if (alt < (dist[nId] ?? Infinity)) {
        dist[nId] = alt;
        prev[nId] = best;
      }
    }
  }

  if (prev[goalId] === undefined) return [];
  const path: string[] = [];
  let curr: string | null = goalId;
  while (curr && curr !== startId) {
    path.unshift(curr);
    curr = prev[curr] ?? null;
  }
  return path;
}

function pushLog(
  logs: LogEntry[],
  year: number,
  season: Season,
  type: LogEntry['type'],
  text: string
): LogEntry[] {
  const next: LogEntry = { id: uid('log'), year, season, type, text };
  return [next, ...logs].slice(0, 45);
}

export function createInitialGameState(
  race: RaceId,
  seed = Math.floor(Math.random() * 999999) + 1,
  customName?: string
): GameState {
  const world = generateOrganicWorld(seed);
  const raceDef = RACES[race];
  const prefix = race === 'humans' ? 'h' : race === 'elves' ? 'e' : race === 'dwarves' ? 'd' : 'o';

  const starterUnits: Record<string, number> = {
    [`${prefix}_militia`]: 2,
    [`${prefix}_infantry`]: 1,
    [`${prefix}_archer`]: 2,
  };

  const starterArmyId = uid('army');
  const starterArmy: Army = {
    id: starterArmyId,
    name: '1re Compagnie de la Couronne',
    owner: 'player',
    race,
    zoneId: world.capitalZoneId,
    path: [],
    moveProgress: 0,
    units: starterUnits,
    heroId: null,
  };

  const tavernPool = createTavernHeroes(race);
  // Recruit first hero automatically to give immediate dungeon & army excitement!
  const firstHero = { ...tavernPool[0] };
  const remainingTavern = tavernPool.slice(1);

  // Also spawn 1 static monster army representation for every zone that has a staticMonster
  const armies: Record<string, Army> = {
    [starterArmyId]: starterArmy,
  };

  const makeEstate = (id: EstateId, initSat: number): EstateState => ({
    id,
    satisfaction: initSat,
    targetSatisfaction: initSat,
    taxLevel: 'normal',
    inDisgrace: false,
    crisisTimer: 22,
    factors: [],
  });

  const capitalZone = world.zones[world.capitalZoneId];
  if (capitalZone && customName?.trim()) {
    capitalZone.name = customName.trim();
  }
  const baseWallHp = Math.round(200 * raceDef.bonuses.wallHpMult);
  if (capitalZone) {
    capitalZone.fortHp = baseWallHp;
    capitalZone.maxFortHp = baseWallHp;
  }

  return {
    started: true,
    gameOver: false,
    gameOverReason: null,
    seed,
    race,
    kingdomName: customName?.trim() || raceDef.kingdomTitle,
    year: 1,
    season: 'spring',
    seasonProgress: 0,
    totalTicks: 0,
    speed: 1,
    capitalZoneId: world.capitalZoneId,
    resources: {
      intendance: 65,
      maxIntendance: 85,
      food: 135,
      wood: 120,
      iron: 55,
      gold: 145,
      population: 38,
      maxPopulation: 65,
    },
    rates: {
      intendance: 1.5,
      food: 2.0,
      wood: 1.5,
      iron: 0.5,
      gold: 2.5,
    },
    authority: 84,
    authorityDelta: 0,
    festivitiesTimer: 0,
    concessionsCount: 0,
    pendingAuthorityCrisis: false,
    estates: {
      peuple: makeEstate('peuple', 68),
      noblesse: makeEstate('noblesse', 64),
      clerge: makeEstate('clerge', 66),
    },
    zones: world.zones,
    zoneOrder: world.zoneOrder,
    rivers: world.rivers,
    armies,
    heroes: {
      [firstHero.id]: firstHero,
    },
    tavernPool: remainingTavern,
    battles: {},
    logs: [
      {
        id: uid('log'),
        year: 1,
        season: 'spring',
        type: 'epic',
        text: `Fondation de ${customName?.trim() || raceDef.kingdomTitle} ! Revendiquez les terres voisines et préparez vos greniers avant l’Hiver.`,
      },
      {
        id: uid('log'),
        year: 1,
        season: 'spring',
        type: 'info',
        text: `${firstHero.name} a rejoint votre Cour et attend vos ordres (Armée ou Donjon).`,
      },
    ],
    invasionTimer: 135, // First rival warhost arrives around late Year 1 / Year 2
    invasionWarningZoneId: null,
  };
}

// ==================== PLAYER ACTIONS ====================

export function getExploreCost(state: GameState): number {
  let base = 14;
  if (state.season === 'spring') base *= 0.85;
  if (state.race === 'elves') base *= 0.8;
  return Math.max(6, Math.round(base));
}

export function getClaimCost(state: GameState): { intendance: number; wood: number; gold: number } {
  const claimedCount = state.zoneOrder.filter((id) => state.zones[id]?.status === 'claimed').length;
  return {
    intendance: Math.min(34, 15 + Math.floor(claimedCount * 1.1)),
    wood: 12 + Math.floor(claimedCount * 1.5),
    gold: 14 + Math.floor(claimedCount * 2),
  };
}

export function actionExploreZone(state: GameState, zoneId: string): GameState {
  const z = state.zones[zoneId];
  if (!z || z.status !== 'unexplored' || z.biome === 'water') return state;
  const hasKnownNeighbor = z.neighbors.some((nId) => state.zones[nId]?.status !== 'unexplored');
  if (!hasKnownNeighbor) return state;

  const cost = getExploreCost(state);
  if (state.resources.intendance < cost) return state;

  const updatedZone: Zone = {
    ...z,
    status: 'explored',
    exploreProgress: 100,
  };

  let logs = pushLog(
    state.logs,
    state.year,
    state.season,
    'info',
    `Éclaireurs envoyés : ${z.name} (${BIOME_INFO[z.biome].name}) révélée.`
  );

  if (z.dungeon) {
    logs = pushLog(
      logs,
      state.year,
      state.season,
      'epic',
      `Donjon découvert dans ${z.name} : ${z.dungeon.name} (${'★'.repeat(z.dungeon.stars)}) ! Envoyez-y un Héros.`
    );
  }
  if (z.staticMonster) {
    logs = pushLog(
      logs,
      state.year,
      state.season,
      'warning',
      `Menace territoriale repérée dans ${z.name} : ${z.staticMonster.name} garde la région !`
    );
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      intendance: state.resources.intendance - cost,
    },
    zones: {
      ...state.zones,
      [zoneId]: updatedZone,
    },
    logs,
  };
}

export function actionClaimZone(state: GameState, zoneId: string): GameState {
  const z = state.zones[zoneId];
  if (!z || (z.status !== 'explored' && z.status !== 'seceded') || z.biome === 'water') return state;
  const adjacentClaimed = z.neighbors.some((nId) => state.zones[nId]?.status === 'claimed');
  if (!adjacentClaimed) return state;

  // Cannot claim while staticMonster or hostile army occupies the zone
  if (z.staticMonster) return state;
  const hasHostile = Object.values(state.armies).some(
    (a) => a.zoneId === zoneId && a.owner !== 'player' && countUnits(a.units) > 0
  );
  if (hasHostile) return state;

  const cost = getClaimCost(state);
  if (
    state.resources.intendance < cost.intendance ||
    state.resources.wood < cost.wood ||
    state.resources.gold < cost.gold
  ) {
    return state;
  }

  const wasSeceded = z.status === 'seceded';
  const updatedZone: Zone = {
    ...z,
    status: 'claimed',
  };

  const logs = pushLog(
    state.logs,
    state.year,
    state.season,
    'success',
    wasSeceded
      ? `${z.name} a été réintégrée sous l’autorité de la Couronne !`
      : `${z.name} a été annexée à votre domaine ! Vous pouvez l’aménager.`
  );

  return {
    ...state,
    resources: {
      ...state.resources,
      intendance: state.resources.intendance - cost.intendance,
      wood: state.resources.wood - cost.wood,
      gold: state.resources.gold - cost.gold,
    },
    estates: {
      ...state.estates,
      noblesse: {
        ...state.estates.noblesse,
        satisfaction: Math.min(100, state.estates.noblesse.satisfaction + 3),
      },
    },
    zones: {
      ...state.zones,
      [zoneId]: updatedZone,
    },
    logs,
  };
}

export function actionBuildOrUpgradeResource(
  state: GameState,
  zoneId: string,
  type: ResourceBuildingType
): GameState {
  const z = state.zones[zoneId];
  if (!z || z.status !== 'claimed' || z.biome === 'capital') return state;
  const cfg = RESOURCE_BUILDINGS[type];
  const currentLvl = z.resourceBuilding?.type === type ? z.resourceBuilding.level : 0;
  if (currentLvl >= 3) return state;

  const mult = currentLvl === 0 ? 1 : currentLvl === 1 ? 1.55 : 2.2;
  const costWood = Math.round(cfg.baseCost.wood * mult);
  const costIron = Math.round((cfg.baseCost.iron + (currentLvl > 0 ? 6 * currentLvl : 0)) * mult);
  const costGold = Math.round(cfg.baseCost.gold * mult);
  const costInt = Math.round(cfg.baseCost.intendance * (currentLvl === 0 ? 1 : 1.15));

  if (
    state.resources.wood < costWood ||
    state.resources.iron < costIron ||
    state.resources.gold < costGold ||
    state.resources.intendance < costInt
  ) {
    return state;
  }

  const nextLvl = (currentLvl + 1) as 1 | 2 | 3;
  return {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - costWood,
      iron: state.resources.iron - costIron,
      gold: state.resources.gold - costGold,
      intendance: state.resources.intendance - costInt,
    },
    zones: {
      ...state.zones,
      [zoneId]: {
        ...z,
        resourceBuilding: { type, level: nextLvl },
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'success',
      `${cfg.name} (Niv. ${nextLvl}) bâti dans ${z.name}.`
    ),
  };
}

export function actionBuildCivic(
  state: GameState,
  zoneId: string,
  civicId: CivicBuildingId
): GameState {
  const z = state.zones[zoneId];
  if (!z || z.status !== 'claimed' || z.biome === 'capital') return state;
  if (z.civicBuildings.includes(civicId)) return state;

  const cfg = CIVIC_BUILDINGS[civicId];
  if (
    state.resources.wood < cfg.cost.wood ||
    state.resources.iron < cfg.cost.iron ||
    state.resources.gold < cfg.cost.gold ||
    state.resources.intendance < cfg.cost.intendance
  ) {
    return state;
  }

  const raceDef = RACES[state.race];
  const addedFortHp = civicId === 'fort' ? Math.round(140 * raceDef.bonuses.wallHpMult) : civicId === 'watchtower' ? 45 : 0;

  const nextZones: Record<string, Zone> = {
    ...state.zones,
    [zoneId]: {
      ...z,
      civicBuildings: [...z.civicBuildings, civicId],
      fortHp: z.fortHp + addedFortHp,
      maxFortHp: z.maxFortHp + addedFortHp,
    },
  };

  // Watchtower immediately reveals all adjacent unexplored zones!
  if (civicId === 'watchtower') {
    for (const nId of z.neighbors) {
      const nz = nextZones[nId];
      if (nz && nz.status === 'unexplored' && nz.biome !== 'water') {
        nextZones[nId] = { ...nz, status: 'explored', exploreProgress: 100 };
      }
    }
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - cfg.cost.wood,
      iron: state.resources.iron - cfg.cost.iron,
      gold: state.resources.gold - cfg.cost.gold,
      intendance: state.resources.intendance - cfg.cost.intendance,
    },
    zones: nextZones,
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'success',
      `${cfg.name} érigé dans ${z.name}.`
    ),
  };
}

export function actionUpgradeRoad(state: GameState, zoneId: string): GameState {
  const z = state.zones[zoneId];
  if (!z || z.status !== 'claimed' || z.roadLevel >= 2) return state;
  const nextLevel = (z.roadLevel + 1) as 1 | 2;
  const cfg = ROAD_UPGRADES[nextLevel];
  const discount = 1 - RACES[state.race].bonuses.roadCostDiscount;

  const costWood = Math.round(cfg.cost.wood * discount);
  const costIron = Math.round(cfg.cost.iron * discount);
  const costGold = Math.round(cfg.cost.gold * discount);
  const costInt = Math.max(4, Math.round(cfg.cost.intendance * discount));

  if (
    state.resources.wood < costWood ||
    state.resources.iron < costIron ||
    state.resources.gold < costGold ||
    state.resources.intendance < costInt
  ) {
    return state;
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - costWood,
      iron: state.resources.iron - costIron,
      gold: state.resources.gold - costGold,
      intendance: state.resources.intendance - costInt,
    },
    zones: {
      ...state.zones,
      [zoneId]: {
        ...z,
        roadLevel: nextLevel,
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'success',
      `${cfg.name} aménagée à travers ${z.name} !`
    ),
  };
}

export function actionUpgradeCapital(
  state: GameState,
  buildingId: CapitalBuildingId
): GameState {
  const cap = state.zones[state.capitalZoneId];
  if (!cap) return state;
  const cfg = CAPITAL_BUILDINGS[buildingId];
  const cur = cap.capitalBuildings[buildingId] ?? 0;
  if (cur >= cfg.maxLevel) return state;

  const mult = cur === 0 ? 1 : cur === 1 ? 1.65 : 2.4;
  const costWood = Math.round(cfg.baseCost.wood * mult);
  const costIron = Math.round(cfg.baseCost.iron * mult);
  const costGold = Math.round(cfg.baseCost.gold * mult);
  const costInt = Math.round(cfg.baseCost.intendance * (cur === 0 ? 1 : 1.2));

  if (
    state.resources.wood < costWood ||
    state.resources.iron < costIron ||
    state.resources.gold < costGold ||
    state.resources.intendance < costInt
  ) {
    return state;
  }

  const nextLvl = cur + 1;
  const wallBonus =
    buildingId === 'walls'
      ? Math.round(160 * RACES[state.race].bonuses.wallHpMult)
      : 0;

  return {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - costWood,
      iron: state.resources.iron - costIron,
      gold: state.resources.gold - costGold,
      intendance: state.resources.intendance - costInt,
    },
    zones: {
      ...state.zones,
      [state.capitalZoneId]: {
        ...cap,
        capitalBuildings: {
          ...cap.capitalBuildings,
          [buildingId]: nextLvl,
        },
        fortHp: cap.fortHp + wallBonus,
        maxFortHp: cap.maxFortHp + wallBonus,
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'epic',
      `Capitale embellie : ${cfg.name} atteint le Niveau ${nextLvl} !`
    ),
  };
}

export function actionSetTaxLevel(
  state: GameState,
  estateId: EstateId,
  taxLevel: TaxLevel
): GameState {
  return {
    ...state,
    estates: {
      ...state.estates,
      [estateId]: {
        ...state.estates[estateId],
        taxLevel,
      },
    },
  };
}

export function actionAppeaseEstate(state: GameState, estateId: EstateId): GameState {
  const est = state.estates[estateId];
  if (estateId === 'peuple') {
    if (state.resources.food < 35 || state.resources.intendance < 8) return state;
    return {
      ...state,
      resources: {
        ...state.resources,
        food: state.resources.food - 35,
        intendance: state.resources.intendance - 8,
      },
      estates: {
        ...state.estates,
        peuple: {
          ...est,
          satisfaction: Math.min(100, est.satisfaction + 14),
          inDisgrace: est.satisfaction + 14 < 20,
        },
      },
      logs: pushLog(
        state.logs,
        state.year,
        state.season,
        'success',
        'Distribution royale de grain : la ferveur du Peuple remonte (+14) !'
      ),
    };
  }
  if (estateId === 'noblesse') {
    if (state.resources.gold < 45 || state.resources.intendance < 8) return state;
    return {
      ...state,
      resources: {
        ...state.resources,
        gold: state.resources.gold - 45,
        intendance: state.resources.intendance - 8,
      },
      estates: {
        ...state.estates,
        noblesse: {
          ...est,
          satisfaction: Math.min(100, est.satisfaction + 14),
          inDisgrace: est.satisfaction + 14 < 20,
        },
      },
      logs: pushLog(
        state.logs,
        state.year,
        state.season,
        'success',
        'Grand Banquet & Fiefs d’honneur : la Noblesse acclame votre nom (+14) !'
      ),
    };
  }
  // Clergé
  if (state.resources.gold < 35 || state.resources.wood < 15 || state.resources.intendance < 8) {
    return state;
  }
  return {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold - 35,
      wood: state.resources.wood - 15,
      intendance: state.resources.intendance - 8,
    },
    estates: {
      ...state.estates,
      clerge: {
        ...est,
        satisfaction: Math.min(100, est.satisfaction + 15),
        inDisgrace: est.satisfaction + 15 < 20,
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'success',
      'Offrandes & Procession solennelle : le Clergé renouvelle sa bénédiction (+15) !'
    ),
  };
}

export function actionStartFestivities(state: GameState): GameState {
  if (state.festivitiesTimer > 0) return state;
  if (state.resources.gold < 30 || state.resources.food < 30 || state.resources.intendance < 10) {
    return state;
  }
  return {
    ...state,
    festivitiesTimer: 38,
    authority: Math.min(100, state.authority + 10),
    resources: {
      ...state.resources,
      gold: state.resources.gold - 30,
      food: state.resources.food - 30,
      intendance: state.resources.intendance - 10,
    },
    estates: {
      peuple: {
        ...state.estates.peuple,
        satisfaction: Math.min(100, state.estates.peuple.satisfaction + 8),
      },
      noblesse: {
        ...state.estates.noblesse,
        satisfaction: Math.min(100, state.estates.noblesse.satisfaction + 6),
      },
      clerge: {
        ...state.estates.clerge,
        satisfaction: Math.min(100, state.estates.clerge.satisfaction + 6),
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'epic',
      'Grandes Festivités proclamées ! L’Autorité et la joie des Ordres remontent (consommation temporairement accrue).'
    ),
  };
}

export function actionResolveAuthorityCrisis(
  state: GameState,
  decision: 'buy_loyalty' | 'abdicate'
): GameState {
  if (decision === 'abdicate') {
    return {
      ...state,
      pendingAuthorityCrisis: false,
      gameOver: true,
      speed: 0,
      gameOverReason:
        'Votre Autorité Royale s’est éteinte face à la fronde conjointe des Ordres, et vous avez choisi d’abdiquer.',
    };
  }

  const nextConcessions = state.concessionsCount + 1;
  return {
    ...state,
    pendingAuthorityCrisis: false,
    authority: 48,
    concessionsCount: nextConcessions,
    speed: 1,
    estates: {
      peuple: {
        ...state.estates.peuple,
        satisfaction: Math.min(100, Math.max(34, state.estates.peuple.satisfaction + 22)),
        inDisgrace: false,
      },
      noblesse: {
        ...state.estates.noblesse,
        satisfaction: Math.min(100, Math.max(34, state.estates.noblesse.satisfaction + 22)),
        inDisgrace: false,
      },
      clerge: {
        ...state.estates.clerge,
        satisfaction: Math.min(100, Math.max(34, state.estates.clerge.satisfaction + 22)),
        inDisgrace: false,
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'warning',
      `Grande Charte concédée pour sauver le trône ! Loyauté achetée (+48 Autorité), mais consommation permanente du royaume +${nextConcessions * 15} %.`
    ),
  };
}

// ==================== MILITARY & HERO ACTIONS ====================

export function actionRecruitUnit(
  state: GameState,
  unitId: string,
  targetArmyId?: string | 'new'
): GameState {
  const def = UNIT_DEFINITIONS[unitId];
  if (!def || def.race !== state.race) return state;

  const cap = state.zones[state.capitalZoneId];
  if (!cap) return state;
  if (def.requiresBuilding && (cap.capitalBuildings[def.requiresBuilding] ?? 0) < 1) {
    return state;
  }

  const goldDiscount = state.race === 'orcs' ? 0.85 : 1.0;
  const costGold = Math.round(def.cost.gold * goldDiscount);

  if (
    state.resources.food < def.cost.food ||
    state.resources.wood < def.cost.wood ||
    state.resources.iron < def.cost.iron ||
    state.resources.gold < costGold
  ) {
    return state;
  }

  const nextArmies = { ...state.armies };
  const playerCapArmies = Object.values(nextArmies).filter(
    (a) => a.owner === 'player' && a.zoneId === state.capitalZoneId
  );

  let chosenArmy: Army | undefined;
  if (targetArmyId && targetArmyId !== 'new' && nextArmies[targetArmyId]?.zoneId === state.capitalZoneId) {
    chosenArmy = nextArmies[targetArmyId];
  } else if (targetArmyId !== 'new' && playerCapArmies.length > 0) {
    chosenArmy = playerCapArmies[0];
  }

  if (chosenArmy) {
    nextArmies[chosenArmy.id] = {
      ...chosenArmy,
      units: {
        ...chosenArmy.units,
        [unitId]: (chosenArmy.units[unitId] ?? 0) + 1,
      },
    };
  } else {
    const newId = uid('army');
    const bannerNum = Object.values(nextArmies).filter((a) => a.owner === 'player').length + 1;
    nextArmies[newId] = {
      id: newId,
      name: `${bannerNum}e Compagnie`,
      owner: 'player',
      race: state.race,
      zoneId: state.capitalZoneId,
      path: [],
      moveProgress: 0,
      units: { [unitId]: 1 },
      heroId: null,
    };
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      food: state.resources.food - def.cost.food,
      wood: state.resources.wood - def.cost.wood,
      iron: state.resources.iron - def.cost.iron,
      gold: state.resources.gold - costGold,
    },
    armies: nextArmies,
  };
}

export function actionMoveArmy(
  state: GameState,
  armyId: string,
  destinationZoneId: string
): GameState {
  const army = state.armies[armyId];
  if (!army || army.owner !== 'player') return state;
  const dest = state.zones[destinationZoneId];
  if (!dest || dest.biome === 'water' || dest.status === 'unexplored') return state;
  if (army.zoneId === destinationZoneId) {
    return {
      ...state,
      armies: { ...state.armies, [armyId]: { ...army, path: [], moveProgress: 0 } },
    };
  }

  const path = findShortestZonePath(state, army.zoneId, destinationZoneId, false);
  if (path.length === 0) return state;

  return {
    ...state,
    armies: {
      ...state.armies,
      [armyId]: {
        ...army,
        path,
        moveProgress: 0,
      },
    },
  };
}

export function actionMergeArmies(
  state: GameState,
  sourceArmyId: string,
  targetArmyId: string
): GameState {
  if (sourceArmyId === targetArmyId) return state;
  const src = state.armies[sourceArmyId];
  const dst = state.armies[targetArmyId];
  if (!src || !dst || src.owner !== 'player' || dst.owner !== 'player') return state;
  if (src.zoneId !== dst.zoneId) return state;

  const mergedUnits = { ...dst.units };
  for (const [uId, n] of Object.entries(src.units)) {
    if (n > 0) mergedUnits[uId] = (mergedUnits[uId] ?? 0) + n;
  }

  const nextHeroes = { ...state.heroes };
  let finalHeroId = dst.heroId;
  if (!finalHeroId && src.heroId) {
    finalHeroId = src.heroId;
    if (nextHeroes[src.heroId]) {
      nextHeroes[src.heroId] = { ...nextHeroes[src.heroId], assignedId: dst.id };
    }
  } else if (src.heroId && nextHeroes[src.heroId]) {
    nextHeroes[src.heroId] = { ...nextHeroes[src.heroId], status: 'idle', assignedId: null };
  }

  const nextArmies = { ...state.armies };
  delete nextArmies[sourceArmyId];
  nextArmies[targetArmyId] = {
    ...dst,
    units: mergedUnits,
    heroId: finalHeroId,
  };

  return {
    ...state,
    armies: nextArmies,
    heroes: nextHeroes,
  };
}

export function actionSplitHalfArmy(state: GameState, armyId: string): GameState {
  const src = state.armies[armyId];
  if (!src || src.owner !== 'player' || countUnits(src.units) < 2) return state;

  const keepUnits: Record<string, number> = {};
  const splitUnits: Record<string, number> = {};
  let movedAny = false;

  for (const [uId, count] of Object.entries(src.units)) {
    if (count <= 0) continue;
    const half = Math.floor(count / 2);
    if (half > 0) {
      splitUnits[uId] = half;
      keepUnits[uId] = count - half;
      movedAny = true;
    } else {
      keepUnits[uId] = count;
    }
  }

  if (!movedAny) {
    // Move 1 unit of the second entry or first entry
    const entries = Object.entries(src.units).filter(([, c]) => c > 0);
    if (entries.length < 2) return state;
    const [firstId, firstC] = entries[0];
    splitUnits[firstId] = 1;
    keepUnits[firstId] = firstC - 1;
    for (let i = 1; i < entries.length; i++) {
      keepUnits[entries[i][0]] = entries[i][1];
    }
  }

  const newId = uid('army');
  const bannerNum = Object.values(state.armies).filter((a) => a.owner === 'player').length + 1;
  return {
    ...state,
    armies: {
      ...state.armies,
      [armyId]: { ...src, units: keepUnits },
      [newId]: {
        id: newId,
        name: `Détachement ${bannerNum}`,
        owner: 'player',
        race: state.race,
        zoneId: src.zoneId,
        path: [],
        moveProgress: 0,
        units: splitUnits,
        heroId: null,
      },
    },
  };
}

export function actionRecruitHero(state: GameState, tavernHeroId: string): GameState {
  const hero = state.tavernPool.find((h) => h.id === tavernHeroId);
  if (!hero) return state;
  const costGold = 65;
  if (state.resources.gold < costGold || state.resources.intendance < 12) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold - costGold,
      intendance: state.resources.intendance - 12,
    },
    heroes: {
      ...state.heroes,
      [hero.id]: { ...hero, status: 'idle', assignedId: null },
    },
    tavernPool: state.tavernPool.filter((h) => h.id !== tavernHeroId),
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'epic',
      `Héros recruté à la Taverne : ${hero.name} (${hero.title}) rejoint votre bannière !`
    ),
  };
}

export function actionAssignHeroToArmy(
  state: GameState,
  heroId: string,
  armyId: string | null
): GameState {
  const hero = state.heroes[heroId];
  if (!hero || hero.status === 'dungeon') return state;

  const nextArmies = { ...state.armies };
  // Detach from any previous army
  for (const a of Object.values(nextArmies)) {
    if (a.heroId === heroId) {
      nextArmies[a.id] = { ...a, heroId: null };
    }
  }

  const nextHeroes = { ...state.heroes };
  if (!armyId) {
    nextHeroes[heroId] = { ...hero, status: 'idle', assignedId: null };
    return { ...state, armies: nextArmies, heroes: nextHeroes };
  }

  const targetArmy = nextArmies[armyId];
  if (!targetArmy || targetArmy.owner !== 'player') return state;

  // Unassign previous hero of targetArmy if any
  if (targetArmy.heroId && nextHeroes[targetArmy.heroId]) {
    nextHeroes[targetArmy.heroId] = {
      ...nextHeroes[targetArmy.heroId],
      status: 'idle',
      assignedId: null,
    };
  }

  nextArmies[armyId] = { ...targetArmy, heroId };
  nextHeroes[heroId] = { ...hero, status: 'army', assignedId: armyId };

  return {
    ...state,
    armies: nextArmies,
    heroes: nextHeroes,
  };
}

export function actionSendHeroToDungeon(
  state: GameState,
  heroId: string,
  zoneId: string
): GameState {
  const hero = state.heroes[heroId];
  const zone = state.zones[zoneId];
  if (!hero || !zone || !zone.dungeon || zone.dungeon.cleared || zone.dungeon.activeHeroId) {
    return state;
  }
  if (zone.status === 'unexplored') return state;

  // Detach hero from army if attached
  const nextArmies = { ...state.armies };
  for (const a of Object.values(nextArmies)) {
    if (a.heroId === heroId) nextArmies[a.id] = { ...a, heroId: null };
  }

  return {
    ...state,
    armies: nextArmies,
    heroes: {
      ...state.heroes,
      [heroId]: {
        ...hero,
        status: 'dungeon',
        assignedId: zoneId,
      },
    },
    zones: {
      ...state.zones,
      [zoneId]: {
        ...zone,
        dungeon: {
          ...zone.dungeon,
          activeHeroId: heroId,
          progress: 5,
        },
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'epic',
      `${hero.name} pénètre dans ${zone.dungeon.name} (Palier ${zone.dungeon.stage}/${zone.dungeon.maxStages}) !`
    ),
  };
}

export function actionResolveDungeonChoice(
  state: GameState,
  zoneId: string,
  optionId: string
): GameState {
  const zone = state.zones[zoneId];
  const dng = zone?.dungeon;
  if (!zone || !dng || !dng.pendingEvent || !dng.activeHeroId) {
    return state;
  }
  const hero = state.heroes[dng.activeHeroId];
  if (!hero) return state;

  const opt = dng.pendingEvent.options.find((o) => o.id === optionId);
  if (!opt) return state;

  if (opt.outcomeType === 'retreat') {
    return {
      ...state,
      heroes: {
        ...state.heroes,
        [hero.id]: { ...hero, status: 'idle', assignedId: null },
      },
      zones: {
        ...state.zones,
        [zoneId]: {
          ...zone,
          dungeon: { ...dng, activeHeroId: null, pendingEvent: null, progress: 0 },
        },
      },
      logs: pushLog(
        state.logs,
        state.year,
        state.season,
        'info',
        `${hero.name} ressort prudemment de ${dng.name} avec le butin déjà acquis.`
      ),
    };
  }

  let goldGain = 35 * dng.stars;
  let clergeGain = 4;
  let newRelic = null;
  let hpCost = opt.risk === 'high' ? 22 : opt.risk === 'medium' ? 12 : 5;
  hpCost = Math.max(3, hpCost - hero.level * 2);

  if (opt.outcomeType === 'treasure') {
    goldGain += 45 * dng.stars;
  } else if (opt.outcomeType === 'purify') {
    clergeGain += 10;
    goldGain += 20 * dng.stars;
  } else if (opt.outcomeType === 'relic') {
    newRelic = RELIC_POOL[Math.floor(Math.random() * RELIC_POOL.length)];
  }

  const isFinalStage = dng.stage >= dng.maxStages;
  if (isFinalStage && !newRelic) {
    newRelic = RELIC_POOL[Math.floor(Math.random() * RELIC_POOL.length)];
    goldGain += 55 * dng.stars;
    clergeGain += 8;
  }

  const updatedRelics = newRelic ? [...hero.relics, newRelic].slice(-3) : hero.relics;
  const nextXp = hero.xp + 40 * dng.stars;
  const leveledUp = nextXp >= 100;
  const nextLevel = leveledUp ? hero.level + 1 : hero.level;

  const updatedHero = {
    ...hero,
    level: nextLevel,
    xp: leveledUp ? nextXp - 100 : nextXp,
    maxHp: leveledUp ? hero.maxHp + 20 : hero.maxHp,
    hp: Math.max(15, hero.hp - hpCost + (leveledUp ? 25 : 0)),
    armyAtkAura: leveledUp ? +(hero.armyAtkAura + 0.04).toFixed(2) : hero.armyAtkAura,
    dungeonPower: leveledUp ? hero.dungeonPower + 6 : hero.dungeonPower,
    relics: updatedRelics,
    status: isFinalStage ? ('idle' as const) : ('dungeon' as const),
    assignedId: isFinalStage ? null : zoneId,
  };

  let logs = pushLog(
    state.logs,
    state.year,
    state.season,
    isFinalStage ? 'epic' : 'success',
    isFinalStage
      ? `Donjon conquis ! ${hero.name} triomphe de ${dng.name} (+${goldGain} Or${newRelic ? `, Relique : ${newRelic.name}` : ''}) !`
      : `${hero.name} franchit le palier ${dng.stage} de ${dng.name} (+${goldGain} Or).`
  );

  if (leveledUp) {
    logs = pushLog(
      logs,
      state.year,
      state.season,
      'epic',
      `${hero.name} passe au Niveau ${nextLevel} !`
    );
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold + goldGain,
    },
    estates: {
      ...state.estates,
      clerge: {
        ...state.estates.clerge,
        satisfaction: Math.min(100, state.estates.clerge.satisfaction + clergeGain),
      },
    },
    heroes: {
      ...state.heroes,
      [hero.id]: updatedHero,
    },
    zones: {
      ...state.zones,
      [zoneId]: {
        ...zone,
        dungeon: {
          ...dng,
          cleared: isFinalStage,
          corrupted: isFinalStage ? false : dng.corrupted,
          activeHeroId: isFinalStage ? null : hero.id,
          stage: isFinalStage ? dng.stage : dng.stage + 1,
          progress: 0,
          pendingEvent: null,
        },
      },
    },
    logs,
  };
}

// ==================== SIMULATION TICK ====================

function buildDungeonEvent(dungeonName: string, stage: number): DungeonChoiceEvent {
  if (stage === 1) {
    return {
      title: `${dungeonName} — Antichambre Scellée`,
      description:
        'Votre Héros découvre une salle aux fresques anciennes gardée par des sentinelles d’ombre et un autel profané.',
      stage,
      options: [
        {
          id: 'purify',
          label: 'Purifier l’autel ancien',
          description: 'Risque faible • Ravit fortement le Clergé (+14) et rapporte un peu d’Or.',
          risk: 'low',
          outcomeType: 'purify',
        },
        {
          id: 'vault',
          label: 'Forcer la chambre des coffres',
          description: 'Risque moyen • Important butin d’Or pour le trésor royal.',
          risk: 'medium',
          outcomeType: 'treasure',
        },
        {
          id: 'retreat',
          label: 'Rebrousser chemin',
          description: 'Ressortir sain et sauf du donjon.',
          risk: 'low',
          outcomeType: 'retreat',
        },
      ],
    };
  }
  if (stage === 2) {
    return {
      title: `${dungeonName} — Galerie des Reliques`,
      description:
        'Un reliquaire runique scintille au centre d’un pont suspendu au-dessus du gouffre.',
      stage,
      options: [
        {
          id: 'relic',
          label: 'S’emparer du reliquaire enchanté',
          description: 'Risque élevé • Chance d’obtenir une Relique héroïque dès maintenant !',
          risk: 'high',
          outcomeType: 'relic',
        },
        {
          id: 'treasure',
          label: 'Récolter l’or des alcôves latérales',
          description: 'Risque moyen • Coffres d’or assurés avant la salle finale.',
          risk: 'medium',
          outcomeType: 'treasure',
        },
        {
          id: 'retreat',
          label: 'Quitter l’expédition',
          description: 'Préserver les forces du Héros.',
          risk: 'low',
          outcomeType: 'retreat',
        },
      ],
    };
  }
  return {
    title: `${dungeonName} — Le Cœur du Gardien`,
    description:
      'Au plus profond du sanctuaire, le Gardien séculaire s’éveille autour du trésor ancestral !',
    stage,
    options: [
      {
        id: 'boss_relic',
        label: 'Terrasser le Gardien & sceller le lieu',
        description: 'Combat décisif • Purifie le Donjon, gagne une Relique, de l’XP et un grand trésor !',
        risk: 'high',
        outcomeType: 'relic',
      },
      {
        id: 'boss_purify',
        label: 'Rituel de bannissement lumineux',
        description: 'Risque modéré • Purifie le Donjon avec grande gloire religieuse (+Clergé & Or).',
        risk: 'medium',
        outcomeType: 'purify',
      },
    ],
  };
}

export function stepSimulation(prevState: GameState, dtRealSeconds: number): GameState {
  if (prevState.gameOver || prevState.pendingAuthorityCrisis || prevState.speed === 0) {
    return prevState;
  }

  const dt = Math.min(0.5, dtRealSeconds * prevState.speed);
  if (dt <= 0) return prevState;

  let state: GameState = {
    ...prevState,
    totalTicks: prevState.totalTicks + 1,
    zones: { ...prevState.zones },
    armies: { ...prevState.armies },
    heroes: { ...prevState.heroes },
    battles: { ...prevState.battles },
    estates: {
      peuple: { ...prevState.estates.peuple },
      noblesse: { ...prevState.estates.noblesse },
      clerge: { ...prevState.estates.clerge },
    },
    logs: prevState.logs,
  };

  const raceDef = RACES[state.race];

  // 1. Advance Season & Year
  let nextSeasonProg = state.seasonProgress + (dt / SEASON_DURATION_SEC) * 100;
  let nextSeason = state.season;
  let nextYear = state.year;

  if (nextSeasonProg >= 100) {
    nextSeasonProg -= 100;
    const curIdx = SEASON_ORDER.indexOf(state.season);
    const nextIdx = (curIdx + 1) % 4;
    nextSeason = SEASON_ORDER[nextIdx];
    if (nextIdx === 0) {
      nextYear += 1;
      // Add a new Tavern Hero every new Spring if pool is small
      if (state.tavernPool.length < 2) {
        const fresh = createTavernHeroes(state.race);
        const candidate = fresh[Math.floor(Math.random() * fresh.length)];
        state.tavernPool = [...state.tavernPool, candidate];
      }
    }

    if (nextSeason === 'autumn') {
      // Autumn Harvest windfall!
      let farmCount = 0;
      for (const zId of state.zoneOrder) {
        const z = state.zones[zId];
        if (z?.status === 'claimed' && z.resourceBuilding?.type === 'farm') {
          farmCount += z.resourceBuilding.level;
        }
      }
      const harvestBonus = Math.round(18 + farmCount * 14 * raceDef.bonuses.farmMult);
      state.resources = { ...state.resources, food: state.resources.food + harvestBonus };
      state.logs = pushLog(
        state.logs,
        nextYear,
        nextSeason,
        'success',
        `Automne — Grandes Moissons ! Vos greniers reçoivent +${harvestBonus} Vivres avant l’hiver.`
      );
    } else if (nextSeason === 'winter') {
      state.logs = pushLog(
        state.logs,
        nextYear,
        nextSeason,
        'warning',
        'L’Hiver s’abat sur Mandea ! Les fermes gèlent (-80 %) et les foyers consomment du Bois de chauffage.'
      );
    } else if (nextSeason === 'spring') {
      state.logs = pushLog(
        state.logs,
        nextYear,
        nextSeason,
        'info',
        `Printemps de l’An ${nextYear} ! La neige fond et les semences reprennent.`
      );
    } else {
      state.logs = pushLog(
        state.logs,
        nextYear,
        nextSeason,
        'info',
        'L’Été rayonne sur vos terres : récoltes hautes, mais gare aux raids de Pillards !'
      );
    }
  }
  state.season = nextSeason;
  state.seasonProgress = nextSeasonProg;
  state.year = nextYear;

  const seasonCfg = SEASONS[state.season];
  const cap = state.zones[state.capitalZoneId];
  const palaceLvl = cap?.capitalBuildings.palace ?? 1;
  const marketLvl = cap?.capitalBuildings.grand_market ?? 0;
  const cathedralLvl = cap?.capitalBuildings.cathedral ?? 0;
  const nobleCourtLvl = cap?.capitalBuildings.noble_court ?? 0;
  const wallsLvl = cap?.capitalBuildings.walls ?? 1;

  // 2. Compute Production, Upkeep, Population & Concessions Multiplier
  const concessionMult = 1 + state.concessionsCount * 0.15;
  const festivitiesConsumptionMult = state.festivitiesTimer > 0 ? 1.35 : 1.0;
  const peasantStrikeMult = state.estates.peuple.inDisgrace ? 0.5 : 1.0;
  const peasantFervorMult = state.estates.peuple.satisfaction >= 80 ? 1.18 : 1.0;

  let foodProd = 4.2; // Base Capital gardens
  let woodProd = 2.6; // Base Capital woods
  let ironProd = 0.8;
  let goldProd = 2.5 + marketLvl * 5.0 * (state.season === 'autumn' ? 1.15 : 1.0);
  let maxPop = 50 + palaceLvl * 25;

  let claimedCount = 0;
  let roadsCount = 0;
  let wellsCount = 0;
  let chapelsCount = 0;
  let manorsCount = 0;
  let fortsCount = 0;
  let corruptedDungeonsCount = 0;
  let clearedDungeonsCount = 0;
  let pillagedZonesCount = 0;

  for (const zId of state.zoneOrder) {
    const z = state.zones[zId];
    if (!z || z.biome === 'water') continue;

    if (z.dungeon?.corrupted && !z.dungeon.cleared && z.status !== 'unexplored') {
      corruptedDungeonsCount++;
    }
    if (z.dungeon?.cleared) {
      clearedDungeonsCount++;
    }

    if (z.pillagedTimer > 0) {
      const nextP = Math.max(0, z.pillagedTimer - dt);
      state.zones[zId] = { ...z, pillagedTimer: nextP };
      if (z.status === 'claimed') pillagedZonesCount++;
    }

    // Regenerate fort HP slowly when no battle in zone
    if (z.status === 'claimed' && z.fortHp < z.maxFortHp && !state.battles[zId]) {
      state.zones[zId] = {
        ...state.zones[zId],
        fortHp: Math.min(z.maxFortHp, z.fortHp + dt * 2.5),
      };
    }

    if (z.status !== 'claimed') continue;
    claimedCount++;
    if (z.roadLevel > 0) roadsCount += z.roadLevel;
    if (z.civicBuildings.includes('wells')) {
      wellsCount++;
      maxPop += 16;
    }
    if (z.civicBuildings.includes('chapel')) chapelsCount++;
    if (z.civicBuildings.includes('manor')) {
      manorsCount++;
      goldProd += 1.6;
    }
    if (z.civicBuildings.includes('fort')) fortsCount++;
    if (z.civicBuildings.includes('market')) {
      const roadBoost = z.roadLevel === 2 ? 1.35 : z.roadLevel === 1 ? 1.18 : 1.0;
      const humanTrade = state.race === 'humans' ? 1.15 : 1.0;
      goldProd += 2.4 * roadBoost * humanTrade;
    }

    if (z.pillagedTimer > 0) continue; // Burned province produces nothing until fires die out!

    const localRoadProdMult =
      1 + (z.roadLevel === 2 ? ROAD_UPGRADES[2].prodBonus : z.roadLevel === 1 ? ROAD_UPGRADES[1].prodBonus : 0);

    if (z.resourceBuilding) {
      const rb = z.resourceBuilding;
      const cfg = RESOURCE_BUILDINGS[rb.type];
      const lvlScale = rb.level === 1 ? 1 : rb.level === 2 ? 1.75 : 2.55;
      const eff = lvlScale * localRoadProdMult * peasantStrikeMult * peasantFervorMult;

      if (rb.type === 'farm') {
        foodProd += (cfg.outputPerLevel.food ?? 0) * eff * seasonCfg.farmMult * raceDef.bonuses.farmMult;
      } else if (rb.type === 'livestock') {
        foodProd += (cfg.outputPerLevel.food ?? 0) * eff * seasonCfg.livestockMult * raceDef.bonuses.livestockMult;
        goldProd += (cfg.outputPerLevel.gold ?? 0) * eff;
      } else if (rb.type === 'lumber') {
        woodProd += (cfg.outputPerLevel.wood ?? 0) * eff * seasonCfg.lumberMult;
        if (raceDef.bonuses.forestFoodBonus > 0) {
          foodProd += raceDef.bonuses.forestFoodBonus * lvlScale * peasantStrikeMult;
        }
      } else if (rb.type === 'mine') {
        ironProd += (cfg.outputPerLevel.iron ?? 0) * eff * raceDef.bonuses.mineMult;
        goldProd += (cfg.outputPerLevel.gold ?? 0) * eff;
      } else if (rb.type === 'grove') {
        woodProd += (cfg.outputPerLevel.wood ?? 0) * eff * seasonCfg.lumberMult;
        foodProd += (cfg.outputPerLevel.food ?? 0) * eff;
      }
    }
  }

  // Taxes from the 3 Estates
  const taxMultipliers: Record<TaxLevel, number> = {
    exempt: 0,
    low: 0.55,
    normal: 1.0,
    high: 1.65,
  };
  const popTax = (state.resources.population * 0.085) * taxMultipliers[state.estates.peuple.taxLevel];
  const nobleTax = (2.2 + manorsCount * 1.3 + nobleCourtLvl * 1.8) * taxMultipliers[state.estates.noblesse.taxLevel];
  const clergeTax = (1.8 + chapelsCount * 1.1 + cathedralLvl * 1.6) * taxMultipliers[state.estates.clerge.taxLevel];
  goldProd += popTax + nobleTax + clergeTax;

  // Consumption (Population + Armies + Winter Heating + Concessions + Festivities)
  let armyFoodUpkeep = 0;
  let armyGoldUpkeep = 0;
  let totalPlayerUnits = 0;

  for (const army of Object.values(state.armies)) {
    if (army.owner !== 'player') continue;
    for (const [uId, count] of Object.entries(army.units)) {
      if (count <= 0) continue;
      const uDef = UNIT_DEFINITIONS[uId];
      if (!uDef) continue;
      armyFoodUpkeep += uDef.upkeepFood * count;
      armyGoldUpkeep += uDef.upkeepGold * count;
      totalPlayerUnits += count;
    }
  }

  const baseFoodCons = (state.resources.population * 0.085 + armyFoodUpkeep) * concessionMult * festivitiesConsumptionMult;
  const winterWoodCons = seasonCfg.winterHeating
    ? state.resources.population * 0.095 * (1 - raceDef.bonuses.winterWoodDiscount) * concessionMult
    : state.festivitiesTimer > 0
      ? 1.5
      : 0;
  const totalGoldCons = armyGoldUpkeep * concessionMult * (state.festivitiesTimer > 0 ? 1.25 : 1.0);

  // Intendance regen
  const maxIntendance = 75 + palaceLvl * 20 + Math.floor(claimedCount * 1.5);
  let intendanceRegen = 1.35 + palaceLvl * 0.45;
  if (state.estates.noblesse.satisfaction >= 75) intendanceRegen += 0.45;
  if (state.estates.clerge.inDisgrace) intendanceRegen *= 0.65;

  const netFood = foodProd - baseFoodCons;
  const netWood = woodProd - winterWoodCons;
  const netIron = ironProd;
  const netGold = goldProd - totalGoldCons;

  const nextFood = Math.max(0, state.resources.food + netFood * dt);
  const nextWood = Math.max(0, state.resources.wood + netWood * dt);
  const nextIron = Math.max(0, state.resources.iron + netIron * dt);
  const nextGold = Math.max(0, state.resources.gold + netGold * dt);
  const nextIntendance = Math.min(maxIntendance, state.resources.intendance + intendanceRegen * dt);

  const isStarving = nextFood <= 0.1 && netFood < 0;
  const isFreezing = seasonCfg.winterHeating && nextWood <= 0.1 && netWood < 0;

  // Population growth / decline
  let nextPop = state.resources.population;
  if (isStarving || isFreezing) {
    nextPop = Math.max(12, nextPop - dt * 0.45);
  } else if (nextPop < maxPop && nextFood > 25) {
    const growthFactor = state.estates.peuple.satisfaction >= 70 ? 0.35 : 0.18;
    nextPop = Math.min(maxPop, nextPop + dt * growthFactor);
  }

  state.resources = {
    intendance: nextIntendance,
    maxIntendance,
    food: nextFood,
    wood: nextWood,
    iron: nextIron,
    gold: nextGold,
    population: nextPop,
    maxPopulation: maxPop,
  };
  state.rates = {
    intendance: +intendanceRegen.toFixed(1),
    food: +netFood.toFixed(1),
    wood: +netWood.toFixed(1),
    iron: +netIron.toFixed(1),
    gold: +netGold.toFixed(1),
  };

  if (state.festivitiesTimer > 0) {
    state.festivitiesTimer = Math.max(0, state.festivitiesTimer - dt);
  }

  // 3. Compute the 3 Estates Satisfaction Targets & Drift
  const taxSatDelta: Record<TaxLevel, number> = {
    exempt: 18,
    low: 9,
    normal: 0,
    high: -22,
  };

  const clergeSchismPenalty = state.estates.clerge.inDisgrace ? -9 : 0;
  const springBonus = state.season === 'spring' ? 4 : 0;
  const festBonus = state.festivitiesTimer > 0 ? 15 : 0;

  // --- PEUPLE ---
  const peupleFactors: { label: string; delta: number }[] = [{ label: 'Base loyale', delta: 54 }];
  if (taxSatDelta[state.estates.peuple.taxLevel] !== 0) {
    peupleFactors.push({ label: 'Niveau d’impôt', delta: taxSatDelta[state.estates.peuple.taxLevel] });
  }
  const livingBonus = Math.min(24, wellsCount * 5 + roadsCount * 2.5 + marketLvl * 5);
  if (livingBonus > 0) peupleFactors.push({ label: 'Routes, Puits & Marchés', delta: Math.round(livingBonus) });
  if (wallsLvl > 0) peupleFactors.push({ label: 'Protection des Remparts', delta: wallsLvl * 3 });
  if (isStarving) peupleFactors.push({ label: 'Famine en cours !', delta: -32 });
  if (isFreezing) peupleFactors.push({ label: 'Foyers sans Bois en Hiver !', delta: -26 });
  if (pillagedZonesCount > 0) peupleFactors.push({ label: 'Provinces incendiées', delta: -pillagedZonesCount * 8 });
  if (clergeSchismPenalty < 0) peupleFactors.push({ label: 'Prêches de l’Anathème', delta: clergeSchismPenalty });
  if (festBonus > 0) peupleFactors.push({ label: 'Festivités en cours', delta: festBonus });
  if (springBonus > 0) peupleFactors.push({ label: 'Renouveau du Printemps', delta: springBonus });

  // --- NOBLESSE ---
  const noblesseFactors: { label: string; delta: number }[] = [{ label: 'Base féodale', delta: 52 }];
  if (taxSatDelta[state.estates.noblesse.taxLevel] !== 0) {
    noblesseFactors.push({ label: 'Fiscalité noble', delta: taxSatDelta[state.estates.noblesse.taxLevel] });
  }
  const nobleInfra = Math.min(28, nobleCourtLvl * 9 + manorsCount * 6 + fortsCount * 3 + wallsLvl * 3);
  if (nobleInfra > 0) noblesseFactors.push({ label: 'Cour, Manoirs & Forts', delta: nobleInfra });
  if (totalPlayerUnits >= 8) noblesseFactors.push({ label: 'Prestige de l’Ost', delta: 6 });
  if (claimedCount <= 1 && state.year >= 2) noblesseFactors.push({ label: 'Manque de conquêtes', delta: -10 });
  if (clergeSchismPenalty < 0) noblesseFactors.push({ label: 'Schisme du Clergé', delta: clergeSchismPenalty });
  if (festBonus > 0) noblesseFactors.push({ label: 'Tournois & Festivités', delta: festBonus });

  // --- CLERGÉ ---
  const clergeFactors: { label: string; delta: number }[] = [{ label: 'Base spirituelle', delta: 54 }];
  if (taxSatDelta[state.estates.clerge.taxLevel] !== 0) {
    clergeFactors.push({ label: 'Dîme & Fiscalité', delta: taxSatDelta[state.estates.clerge.taxLevel] });
  }
  const sacredInfra = Math.min(30, cathedralLvl * 11 + chapelsCount * 7 + (cap?.capitalBuildings.menagerie ?? 0) * 4);
  if (sacredInfra > 0) clergeFactors.push({ label: 'Cathédrale & Sanctuaires', delta: sacredInfra });
  if (clearedDungeonsCount > 0) {
    clergeFactors.push({ label: 'Donjons purifiés', delta: Math.min(18, clearedDungeonsCount * 6) });
  }
  if (corruptedDungeonsCount > 0) {
    clergeFactors.push({ label: 'Lieux maudits non purifiés', delta: -corruptedDungeonsCount * 11 });
  }
  if (festBonus > 0) clergeFactors.push({ label: 'Jubilé & Festivités', delta: festBonus });

  const updateEstate = (est: EstateState, factors: { label: string; delta: number }[]): EstateState => {
    const rawTarget = factors.reduce((s, f) => s + f.delta, 0);
    const target = Math.max(0, Math.min(100, rawTarget));
    const diff = target - est.satisfaction;
    const speedRate = 0.085; // Smooth convergence
    const nextSat = Math.max(0, Math.min(100, est.satisfaction + diff * speedRate * dt));
    const nowDisgrace = nextSat < 20;

    return {
      ...est,
      satisfaction: nextSat,
      targetSatisfaction: target,
      inDisgrace: nowDisgrace,
      factors,
      crisisTimer: nowDisgrace ? est.crisisTimer - dt : 16,
    };
  };

  const prevDisgrace = {
    peuple: state.estates.peuple.inDisgrace,
    noblesse: state.estates.noblesse.inDisgrace,
    clerge: state.estates.clerge.inDisgrace,
  };

  state.estates.peuple = updateEstate(state.estates.peuple, peupleFactors);
  state.estates.noblesse = updateEstate(state.estates.noblesse, noblesseFactors);
  state.estates.clerge = updateEstate(state.estates.clerge, clergeFactors);

  // Trigger Disgrace Entry Logs & Periodic Asymmetric Disgrace Crises!
  // A) PEUPLE -> JACQUERIE (Bandes de rebelles qui brûlent les fermes et marchent sur la Capitale)
  if (state.estates.peuple.inDisgrace) {
    if (!prevDisgrace.peuple) {
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        'DISGRÂCE DU PEUPLE ! La Jacquerie éclate : grèves (-50 % prod.) et soulèvement des serfs dans vos campagnes !'
      );
      state.estates.peuple.crisisTimer = 2;
    }
    if (state.estates.peuple.crisisTimer <= 0) {
      state.estates.peuple.crisisTimer = 28;
      const ruralClaimed = state.zoneOrder.filter(
        (id) => id !== state.capitalZoneId && state.zones[id]?.status === 'claimed'
      );
      const spawnZoneId =
        ruralClaimed.length > 0
          ? ruralClaimed[Math.floor(Math.random() * ruralClaimed.length)]
          : state.zones[state.capitalZoneId].neighbors[0];

      if (spawnZoneId && state.zones[spawnZoneId]) {
        const rebelId = uid('rebel');
        const strength = Math.min(8, 3 + Math.floor(state.year * 0.8));
        state.armies[rebelId] = {
          id: rebelId,
          name: 'Jacquerie des Serfs Révoltés',
          owner: 'rebel_peasants',
          race: 'enemy',
          zoneId: spawnZoneId,
          path: findShortestZonePath(state, spawnZoneId, state.capitalZoneId, true),
          moveProgress: 0,
          units: { rebel_peasant: strength },
          heroId: null,
          aiIntent: 'siege_capital',
        };
        state.zones[spawnZoneId] = { ...state.zones[spawnZoneId], pillagedTimer: 18 };
        state.logs = pushLog(
          state.logs,
          state.year,
          state.season,
          'danger',
          `Une bande de Serfs insurgés embrase ${state.zones[spawnZoneId].name} et marche sur la Capitale !`
        );
      }
    }
  }

  // B) NOBLESSE -> FRONDE & SÉCESSION TERRITORIALE + ARMÉE FÉODALE
  if (state.estates.noblesse.inDisgrace) {
    if (!prevDisgrace.noblesse) {
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        'DISGRÂCE DE LA NOBLESSE ! Les Barons entrent en Fronde : sécession de provinces et levée d’armées rebelles !'
      );
      state.estates.noblesse.crisisTimer = 2;
    }
    if (state.estates.noblesse.crisisTimer <= 0) {
      state.estates.noblesse.crisisTimer = 34;
      const candidateProvinces = state.zoneOrder.filter(
        (id) => id !== state.capitalZoneId && state.zones[id]?.status === 'claimed'
      );
      const secedeId =
        candidateProvinces.find((id) => state.zones[id].civicBuildings.includes('manor')) ??
        candidateProvinces[candidateProvinces.length - 1];

      const spawnId = secedeId ?? state.zones[state.capitalZoneId].neighbors[0];
      if (spawnId && state.zones[spawnId]) {
        if (secedeId) {
          state.zones[secedeId] = { ...state.zones[secedeId], status: 'seceded' };
        }
        const baronArmyId = uid('baron');
        state.armies[baronArmyId] = {
          id: baronArmyId,
          name: 'Ost du Baron Sécessionniste',
          owner: 'secession_nobles',
          race: 'enemy',
          zoneId: spawnId,
          path: findShortestZonePath(state, spawnId, state.capitalZoneId, true),
          moveProgress: 0,
          units: {
            rebel_noble_inf: 2 + Math.floor(state.year * 0.6),
            rebel_noble_knight: 1 + Math.floor(state.year * 0.4),
          },
          heroId: null,
          aiIntent: 'siege_capital',
        };
        state.logs = pushLog(
          state.logs,
          state.year,
          state.season,
          'danger',
          secedeId
            ? `Sécession ! ${state.zones[secedeId].name} fait défection et lève un Ost féodal contre votre trône !`
            : `Un Baron félon lève une armée de chevaliers rebelles aux portes du domaine !`
        );
      }
    }
  }

  // C) CLERGÉ -> ANATHÈME, FANATIQUES & OUVERTURE DE FAILLES MAUDITES
  if (state.estates.clerge.inDisgrace) {
    if (!prevDisgrace.clerge) {
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        'DISGRÂCE DU CLERGÉ ! L’Anathème est jeté : vos sujets doutent, et des sceaux occultes se brisent !'
      );
      state.estates.clerge.crisisTimer = 2;
    }
    if (state.estates.clerge.crisisTimer <= 0) {
      state.estates.clerge.crisisTimer = 32;
      const borderZones = state.zoneOrder.filter(
        (id) => id !== state.capitalZoneId && state.zones[id]?.biome !== 'water' && state.zones[id]?.status !== 'unexplored'
      );
      const riftZoneId = borderZones[Math.floor(Math.random() * borderZones.length)];
      if (riftZoneId && state.zones[riftZoneId]) {
        const rz = state.zones[riftZoneId];
        if (!rz.dungeon) {
          state.zones[riftZoneId] = {
            ...rz,
            dungeon: {
              id: uid('rift'),
              name: 'Faille de l’Anathème',
              theme: 'rift',
              stars: 2,
              cleared: false,
              corrupted: true,
              activeHeroId: null,
              progress: 0,
              stage: 1,
              maxStages: 2,
              pendingEvent: null,
            },
          };
        }
        const zealotId = uid('zealot');
        state.armies[zealotId] = {
          id: zealotId,
          name: 'Procession des Zélotes Maudits',
          owner: 'schism_zealots',
          race: 'enemy',
          zoneId: riftZoneId,
          path: findShortestZonePath(state, riftZoneId, state.capitalZoneId, true),
          moveProgress: 0,
          units: { zealot_fanatic: 3 + Math.floor(state.year * 0.5) },
          heroId: null,
          aiIntent: 'siege_capital',
        };
        state.logs = pushLog(
          state.logs,
          state.year,
          state.season,
          'danger',
          `Schisme ! Une Faille profane s’ouvre à ${rz.name}, libérant des Zélotes vers votre cité !`
        );
      }
    }
  }

  // 4. Royal Authority ("2 out of 3 support" rule + Festivities + Crisis at 0)
  const supportedEstatesCount = (['peuple', 'noblesse', 'clerge'] as EstateId[]).filter(
    (id) => !state.estates[id].inDisgrace
  ).length;
  const capitalUnderSiege = Boolean(state.battles[state.capitalZoneId]);

  let authDelta = 0;
  if (supportedEstatesCount === 1) authDelta -= 1.65;
  else if (supportedEstatesCount === 0) authDelta -= 3.1;
  else if (supportedEstatesCount === 3 && state.estates.peuple.satisfaction >= 60) {
    authDelta += 0.22 + cathedralLvl * 0.08;
  }

  if (capitalUnderSiege) authDelta -= 0.7;
  if (state.festivitiesTimer > 0) authDelta += 0.95;

  state.authorityDelta = +authDelta.toFixed(2);
  state.authority = Math.max(0, Math.min(100, state.authority + authDelta * dt));

  if (state.authority <= 0 && !state.pendingAuthorityCrisis) {
    state.pendingAuthorityCrisis = true;
    state.speed = 0;
  }

  // 5. Endless Sandbox External Threats (Raiders & Major Rival Invasion Armies!)
  state.invasionTimer -= dt;

  // Periodic Raider Warbands (target farms/livestock/lumber!)
  if (state.totalTicks % 35 === 0 && Math.random() < (state.season === 'summer' ? 0.24 : 0.14)) {
    const activeRaiders = Object.values(state.armies).filter((a) => a.owner === 'raiders').length;
    if (activeRaiders < 2) {
      const wildBorderZones = state.zoneOrder.filter((id) => {
        const z = state.zones[id];
        return (
          z &&
          z.biome !== 'water' &&
          z.status !== 'claimed' &&
          z.neighbors.some((n) => state.zones[n]?.status === 'claimed' || state.zones[n]?.status === 'explored')
        );
      });
      const econTargets = state.zoneOrder.filter((id) => {
        const z = state.zones[id];
        return z && z.status === 'claimed' && id !== state.capitalZoneId && (z.resourceBuilding || z.civicBuildings.length > 0);
      });

      if (wildBorderZones.length > 0) {
        const spawnZ = wildBorderZones[Math.floor(Math.random() * wildBorderZones.length)];
        const targetZ =
          econTargets.length > 0
            ? econTargets[Math.floor(Math.random() * econTargets.length)]
            : state.capitalZoneId;

        if (state.zones[spawnZ].status === 'unexplored') {
          state.zones[spawnZ] = { ...state.zones[spawnZ], status: 'explored', exploreProgress: 100 };
        }

        const rId = uid('raid');
        const scale = Math.min(7, 2 + Math.floor(state.year * 0.7));
        state.armies[rId] = {
          id: rId,
          name: 'Bande de Pillards',
          owner: 'raiders',
          race: 'enemy',
          zoneId: spawnZ,
          path: findShortestZonePath(state, spawnZ, targetZ, true),
          moveProgress: 0,
          units: {
            raider_goblin: scale,
            ...(state.year >= 2 ? { raider_worg: Math.max(1, Math.floor(scale / 2)) } : {}),
          },
          heroId: null,
          aiIntent: 'pillage',
        };
        state.logs = pushLog(
          state.logs,
          state.year,
          state.season,
          'warning',
          `Raid repéré ! Des Pillards surgissent de ${state.zones[spawnZ].name} pour piller vos terres !`
        );
      }
    }
  }

  // Warning Sonar Pulse 28s before Major Invasion Army!
  if (state.invasionTimer <= 28 && !state.invasionWarningZoneId) {
    const outerZones = state.zoneOrder.filter((id) => {
      const z = state.zones[id];
      return z && z.biome !== 'water' && z.status !== 'claimed' && z.isCoastal;
    });
    const warnId =
      outerZones[Math.floor(Math.random() * outerZones.length)] ??
      state.zoneOrder.find((id) => state.zones[id]?.biome !== 'water' && id !== state.capitalZoneId) ??
      null;
    if (warnId) {
      state.invasionWarningZoneId = warnId;
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        `Cors d’alerte aux frontières ! Une Grande Armée Ennemie se rassemble du côté de ${state.zones[warnId].name} !`
      );
    }
  }

  if (state.invasionTimer <= 0) {
    const spawnId =
      state.invasionWarningZoneId ??
      state.zoneOrder.find((id) => state.zones[id]?.biome !== 'water' && id !== state.capitalZoneId);
    state.invasionTimer = Math.max(95, 145 - state.year * 4);
    state.invasionWarningZoneId = null;

    if (spawnId && state.zones[spawnId]) {
      state.zones[spawnId] = { ...state.zones[spawnId], status: 'explored', exploreProgress: 100 };
      const invId = uid('inv');
      const waveTier = state.year;
      state.armies[invId] = {
        id: invId,
        name: `Ost d’Invasion de l’An ${state.year}`,
        owner: 'invasion',
        race: 'enemy',
        zoneId: spawnId,
        path: findShortestZonePath(state, spawnId, state.capitalZoneId, true),
        moveProgress: 0,
        units: {
          inv_pikeman: 3 + waveTier * 2,
          inv_crossbow: 2 + waveTier,
          ...(waveTier >= 2 ? { inv_siege_ogre: Math.min(4, waveTier - 1) } : {}),
        },
        heroId: null,
        aiIntent: 'siege_capital',
      };
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        `INVASION ! L’${state.armies[invId].name} foule ${state.zones[spawnId].name} et marche pour détruire votre Capitale !`
      );
    }
  }

  // Endless Sandbox renewal: occasionally awaken a new Dungeon or Monster in distant wild zones!
  if (state.totalTicks % 90 === 0 && Math.random() < 0.25) {
    const wildEmpty = state.zoneOrder.filter((id) => {
      const z = state.zones[id];
      return z && z.biome !== 'water' && z.status !== 'claimed' && !z.dungeon && !z.staticMonster;
    });
    if (wildEmpty.length > 0) {
      const pick = wildEmpty[Math.floor(Math.random() * wildEmpty.length)];
      const pz = state.zones[pick];
      if (Math.random() < 0.5) {
        state.zones[pick] = {
          ...pz,
          dungeon: {
            id: uid('dng'),
            name: 'Sanctuaire Éveillé des Brumes',
            theme: 'shrine',
            stars: (Math.min(3, 1 + Math.floor(state.year / 2)) as 1 | 2 | 3),
            cleared: false,
            corrupted: false,
            activeHeroId: null,
            progress: 0,
            stage: 1,
            maxStages: 3,
            pendingEvent: null,
          },
        };
        if (pz.status === 'explored') {
          state.logs = pushLog(
            state.logs,
            state.year,
            state.season,
            'epic',
            `Les sables du temps révèlent un nouveau Donjon dans ${pz.name} !`
          );
        }
      }
    }
  }

  // 6. Dungeon Expedition Progress & Hero Healing
  for (const h of Object.values(state.heroes)) {
    if (h.status !== 'dungeon' && h.hp < h.maxHp && !state.estates.clerge.inDisgrace) {
      state.heroes[h.id] = { ...h, hp: Math.min(h.maxHp, h.hp + dt * 2.5) };
    }
  }

  for (const zId of state.zoneOrder) {
    const z = state.zones[zId];
    if (!z?.dungeon || !z.dungeon.activeHeroId || z.dungeon.cleared || z.dungeon.pendingEvent) {
      continue;
    }
    const hero = state.heroes[z.dungeon.activeHeroId];
    if (!hero) continue;

    const speed = 11 + hero.dungeonPower * 0.25;
    const nextProg = z.dungeon.progress + speed * dt;
    if (nextProg >= 100) {
      state.zones[zId] = {
        ...z,
        dungeon: {
          ...z.dungeon,
          progress: 100,
          pendingEvent: buildDungeonEvent(z.dungeon.name, z.dungeon.stage),
        },
      };
    } else {
      state.zones[zId] = {
        ...z,
        dungeon: { ...z.dungeon, progress: nextProg },
      };
    }
  }

  // 7. Army Movement & Raider Pillage Behavior
  for (const army of Object.values(state.armies)) {
    if (countUnits(army.units) <= 0) {
      delete state.armies[army.id];
      continue;
    }

    // Freeze movement while fighting in current zone
    const zoneHasEnemy =
      army.owner === 'player'
        ? Boolean(state.zones[army.zoneId]?.staticMonster) ||
          Object.values(state.armies).some(
            (other) => other.zoneId === army.zoneId && other.owner !== 'player' && countUnits(other.units) > 0
          )
        : Object.values(state.armies).some(
            (other) => other.zoneId === army.zoneId && other.owner === 'player' && countUnits(other.units) > 0
          );

    if (zoneHasEnemy) continue;

    // Chapel healing for player armies
    if (army.owner === 'player' && state.zones[army.zoneId]?.civicBuildings.includes('chapel')) {
      if (army.heroId && state.heroes[army.heroId]) {
        const h = state.heroes[army.heroId];
        state.heroes[army.heroId] = { ...h, hp: Math.min(h.maxHp, h.hp + dt * 3) };
      }
    }

    // Enemy AI retargeting if path is empty
    if (army.owner !== 'player' && army.path.length === 0) {
      const curZone = state.zones[army.zoneId];
      if (army.owner === 'raiders') {
        if (curZone && curZone.status === 'claimed' && army.zoneId !== state.capitalZoneId && curZone.pillagedTimer <= 0) {
          if (curZone.fortHp > 0) {
            state.zones[army.zoneId] = { ...curZone, fortHp: Math.max(0, curZone.fortHp - dt * 16) };
          } else {
            // Burn & steal!
            const stolenGold = Math.min(state.resources.gold, 22);
            const stolenFood = Math.min(state.resources.food, 25);
            state.resources.gold -= stolenGold;
            state.resources.food -= stolenFood;
            state.zones[army.zoneId] = { ...curZone, pillagedTimer: 26 };
            state.logs = pushLog(
              state.logs,
              state.year,
              state.season,
              'danger',
              `${curZone.name} a été pillée par les maraudeurs (-${Math.round(stolenGold)} Or, -${Math.round(stolenFood)} Vivres) !`
            );
            // Pick another target!
            const nextTargets = state.zoneOrder.filter(
              (id) =>
                id !== army.zoneId &&
                state.zones[id]?.status === 'claimed' &&
                state.zones[id]?.pillagedTimer <= 0
            );
            if (nextTargets.length > 0) {
              const pick = nextTargets[Math.floor(Math.random() * nextTargets.length)];
              state.armies[army.id] = {
                ...army,
                path: findShortestZonePath(state, army.zoneId, pick, true),
              };
            }
          }
          continue;
        } else if (army.zoneId !== state.capitalZoneId) {
          state.armies[army.id] = {
            ...army,
            path: findShortestZonePath(state, army.zoneId, state.capitalZoneId, true),
          };
        }
      } else if (army.zoneId !== state.capitalZoneId) {
        state.armies[army.id] = {
          ...army,
          path: findShortestZonePath(state, army.zoneId, state.capitalZoneId, true),
        };
      }
    }

    // Advance along path
    const updatedArmy = state.armies[army.id];
    if (updatedArmy && updatedArmy.path.length > 0) {
      const nextZId = updatedArmy.path[0];
      const curZ = state.zones[updatedArmy.zoneId];
      const nextZ = state.zones[nextZId];
      if (!curZ || !nextZ) continue;

      // Average speed of stack
      let totalSpeed = 0;
      let totalCount = 0;
      for (const [uId, n] of Object.entries(updatedArmy.units)) {
        if (n <= 0) continue;
        totalSpeed += (UNIT_DEFINITIONS[uId]?.speed ?? 1) * n;
        totalCount += n;
      }
      const avgUnitSpeed = totalCount > 0 ? totalSpeed / totalCount : 1;

      const roadMult =
        curZ.roadLevel === 2 || nextZ.roadLevel === 2
          ? ROAD_UPGRADES[2].speedBonus
          : curZ.roadLevel === 1 || nextZ.roadLevel === 1
            ? ROAD_UPGRADES[1].speedBonus
            : seasonCfg.armySpeedMult;

      const stepRate = 0.24 * avgUnitSpeed * roadMult;
      const nextProg = updatedArmy.moveProgress + stepRate * dt;

      if (nextProg >= 1) {
        state.armies[army.id] = {
          ...updatedArmy,
          zoneId: nextZId,
          path: updatedArmy.path.slice(1),
          moveProgress: 0,
        };
      } else {
        state.armies[army.id] = {
          ...updatedArmy,
          moveProgress: nextProg,
        };
      }
    }
  }

  // 8. Multi-Phase Tactical Zone Battles & Capital Siege!
  const nextBattles: Record<string, GameState['battles'][string]> = {};

  for (const zId of state.zoneOrder) {
    const z = state.zones[zId];
    if (!z || z.biome === 'water') continue;

    const playerArmies = Object.values(state.armies).filter(
      (a) => a.zoneId === zId && a.owner === 'player' && countUnits(a.units) > 0
    );
    const enemyArmies = Object.values(state.armies).filter(
      (a) => a.zoneId === zId && a.owner !== 'player' && countUnits(a.units) > 0
    );
    const hasStaticMonster = Boolean(z.staticMonster);

    // Case A: Undefended Capital or Fort under enemy siege!
    if (playerArmies.length === 0 && enemyArmies.length > 0 && z.status === 'claimed') {
      if (z.fortHp > 0) {
        let siegeDps = 0;
        for (const ea of enemyArmies) {
          for (const [uId, c] of Object.entries(ea.units)) {
            const def = UNIT_DEFINITIONS[uId];
            if (def && c > 0) siegeDps += (def.meleeAtk * 0.45 + def.armorPierce * 0.6) * c;
          }
        }
        // Watchtower / Capital Walls shoot back!
        const towerBackfire =
          zId === state.capitalZoneId ? 10 + wallsLvl * 9 : z.civicBuildings.includes('watchtower') ? 11 : 4;

        state.zones[zId] = { ...z, fortHp: Math.max(0, z.fortHp - siegeDps * 0.35 * dt) };
        nextBattles[zId] = {
          zoneId: zId,
          round: (state.battles[zId]?.round ?? 1),
          phase: 'ranged',
          timer: (state.battles[zId]?.timer ?? 0) + dt,
          lastSummary: `Siège en cours contre les remparts de ${z.name} !`,
          intensity: 1,
        };

        // Occasional defender arrow kills an attacker during long siege
        if (Math.random() < towerBackfire * 0.008 * dt) {
          const targetArmy = enemyArmies[0];
          const firstEntry = Object.entries(targetArmy.units).find(([, n]) => n > 0);
          if (firstEntry) {
            const [uId, c] = firstEntry;
            state.armies[targetArmy.id] = {
              ...targetArmy,
              units: { ...targetArmy.units, [uId]: c - 1 },
            };
          }
        }
      } else if (zId === state.capitalZoneId) {
        // CAPITAL DESTROYED -> GAME OVER!
        state.gameOver = true;
        state.speed = 0;
        state.gameOverReason = `Votre Capitale (${z.name}) a été prise et détruite par ${enemyArmies[0].name} en l’An ${state.year} !`;
        return state;
      }
      continue;
    }

    // Case B: Active Clash (Player Armies vs Enemy Armies OR Static Monster!)
    if (playerArmies.length > 0 && (enemyArmies.length > 0 || hasStaticMonster)) {
      const prevBattle = state.battles[zId];
      const nextTimer = (prevBattle?.timer ?? 0) + dt;
      const roundInterval = 1.65; // Tactical clash round every 1.65s

      if (nextTimer < roundInterval) {
        nextBattles[zId] = {
          zoneId: zId,
          round: prevBattle?.round ?? 1,
          phase: nextTimer < roundInterval * 0.5 ? 'ranged' : 'melee',
          timer: nextTimer,
          lastSummary: prevBattle?.lastSummary ?? `Engagement tactique dans ${z.name} !`,
          intensity: 1,
        };
        continue;
      }

      // Execute a Tactical Combat Round (Ranged Salvo + Melee Shock + Armor Pierce + Hero Aura + Terrain/Fort)!
      const roundNum = (prevBattle?.round ?? 0) + 1;
      const elfRangedMult = state.race === 'elves' ? 1.2 : 1.0;

      // Aggregate Player Force
      let pRangedDmg = z.status === 'claimed' && z.civicBuildings.includes('watchtower') ? 18 : 0;
      if (zId === state.capitalZoneId) pRangedDmg += 14 + wallsLvl * 10;
      let pMeleeDmg = 0;
      let pPierce = 0;
      let pFrontlineCount = 0;
      let heroAtkMult = 1.0;
      let heroDefMult = z.status === 'claimed' && z.civicBuildings.includes('fort') ? 1.25 : 1.0;

      for (const pa of playerArmies) {
        if (pa.heroId && state.heroes[pa.heroId]) {
          const h = state.heroes[pa.heroId];
          const relicAtk = h.relics.reduce((s, r) => s + r.atkBonus, 0);
          const relicDef = h.relics.reduce((s, r) => s + r.defBonus, 0);
          heroAtkMult = Math.max(heroAtkMult, 1 + h.armyAtkAura + relicAtk);
          heroDefMult = Math.max(heroDefMult, heroDefMult + h.armyDefAura + relicDef);
          pMeleeDmg += 18 + h.level * 5;
        }
        for (const [uId, n] of Object.entries(pa.units)) {
          if (n <= 0) continue;
          const d = UNIT_DEFINITIONS[uId];
          if (!d) continue;
          pRangedDmg += d.rangedAtk * n * elfRangedMult;
          pMeleeDmg += d.meleeAtk * n;
          pPierce += d.armorPierce * n;
          if (d.role === 'infantry' || d.role === 'militia' || (d.role === 'fantasy' && d.hp >= 120)) {
            pFrontlineCount += n;
          }
        }
      }

      const totalPlayerAttack = (pRangedDmg * 1.1 + pMeleeDmg + pPierce * 0.85) * heroAtkMult;

      // Aggregate Enemy Force (either Enemy Armies or Static Monster)
      let eTotalAttack = 0;
      if (enemyArmies.length > 0) {
        for (const ea of enemyArmies) {
          for (const [uId, n] of Object.entries(ea.units)) {
            if (n <= 0) continue;
            const d = UNIT_DEFINITIONS[uId];
            if (!d) continue;
            eTotalAttack += (d.rangedAtk * 1.05 + d.meleeAtk + d.armorPierce * 0.8) * n;
          }
        }
      } else if (z.staticMonster) {
        for (const [uId, n] of Object.entries(z.staticMonster.units)) {
          if (n <= 0) continue;
          const d = UNIT_DEFINITIONS[uId];
          if (!d) continue;
          eTotalAttack += (d.rangedAtk + d.meleeAtk + d.armorPierce) * n;
        }
      }

      // Apply casualties to Enemy
      let enemyLosses = 0;
      if (enemyArmies.length > 0) {
        const targetEA = enemyArmies[0];
        const nextEUnits = { ...targetEA.units };
        let dmgPool = totalPlayerAttack * (0.85 + Math.random() * 0.35);

        for (const [uId, count] of Object.entries(nextEUnits)) {
          if (count <= 0 || dmgPool <= 0) continue;
          const d = UNIT_DEFINITIONS[uId];
          if (!d) continue;
          const effHp = d.hp + d.defense * 3.5;
          const killed = Math.min(count, Math.floor(dmgPool / effHp + (Math.random() < (dmgPool % effHp) / effHp ? 1 : 0)));
          if (killed > 0) {
            nextEUnits[uId] = count - killed;
            enemyLosses += killed;
            dmgPool -= killed * effHp;
          }
        }

        if (countUnits(nextEUnits) <= 0) {
          delete state.armies[targetEA.id];
          const bounty = enemyLosses * raceDef.bonuses.battleGoldBounty + 18;
          state.resources.gold += bounty;
          // Hero XP reward
          for (const pa of playerArmies) {
            if (pa.heroId && state.heroes[pa.heroId]) {
              const h = state.heroes[pa.heroId];
              const nxp = h.xp + 30;
              state.heroes[pa.heroId] = {
                ...h,
                level: nxp >= 100 ? h.level + 1 : h.level,
                xp: nxp >= 100 ? nxp - 100 : nxp,
              };
            }
          }
          state.logs = pushLog(
            state.logs,
            state.year,
            state.season,
            'success',
            `Victoire à ${z.name} ! ${targetEA.name} est anéantie (+${bounty} Or).`
          );
        } else {
          state.armies[targetEA.id] = { ...targetEA, units: nextEUnits };
          if (raceDef.bonuses.battleGoldBounty > 0 && enemyLosses > 0) {
            state.resources.gold += enemyLosses * raceDef.bonuses.battleGoldBounty;
          }
        }
      } else if (z.staticMonster) {
        const nextMUnits = { ...z.staticMonster.units };
        let dmgPool = totalPlayerAttack * (0.9 + Math.random() * 0.3);
        for (const [uId, count] of Object.entries(nextMUnits)) {
          if (count <= 0 || dmgPool <= 0) continue;
          const d = UNIT_DEFINITIONS[uId];
          if (!d) continue;
          const effHp = d.hp + Math.max(0, d.defense * 3 - pPierce * 0.5);
          const killed = Math.min(count, Math.floor(dmgPool / effHp + (Math.random() < (dmgPool % effHp) / effHp ? 1 : 0)));
          if (killed > 0) {
            nextMUnits[uId] = count - killed;
            enemyLosses += killed;
            dmgPool -= killed * effHp;
          }
        }
        if (countUnits(nextMUnits) <= 0) {
          const rwGold = z.staticMonster.rewardGold;
          const rwIron = z.staticMonster.rewardIron;
          const mName = z.staticMonster.name;
          state.zones[zId] = { ...z, staticMonster: null };
          state.resources.gold += rwGold;
          state.resources.iron += rwIron;
          state.estates.clerge.satisfaction = Math.min(100, state.estates.clerge.satisfaction + 6);
          state.estates.noblesse.satisfaction = Math.min(100, state.estates.noblesse.satisfaction + 5);
          state.logs = pushLog(
            state.logs,
            state.year,
            state.season,
            'epic',
            `Monstre terrassé ! ${mName} est vaincu dans ${z.name} (+${rwGold} Or, +${rwIron} Fer). La zone peut être revendiquée !`
          );
        } else {
          state.zones[zId] = {
            ...z,
            staticMonster: { ...z.staticMonster, units: nextMUnits },
          };
        }
      }

      // Apply casualties to Player (Frontline shields archers/crossbows!)
      let playerLosses = 0;
      const incomingDmg = (eTotalAttack / heroDefMult) * (0.75 + Math.random() * 0.35);
      const targetPA = playerArmies[0];
      const nextPUnits = { ...targetPA.units };

      // Sort roles so militia & infantry absorb damage before archers/mages!
      const rolePriority: Record<string, number> = {
        militia: 1,
        infantry: 2,
        cavalry: 3,
        fantasy: 4,
        crossbow: 5,
        archer: 6,
      };
      const sortedEntries = Object.entries(nextPUnits)
        .filter(([, c]) => c > 0)
        .sort(([a], [b]) => (rolePriority[UNIT_DEFINITIONS[a]?.role ?? 'militia'] ?? 3) - (rolePriority[UNIT_DEFINITIONS[b]?.role ?? 'militia'] ?? 3));

      let remIn = incomingDmg;
      // Frontline screen bonus reduces damage when infantry shields ranged
      if (pFrontlineCount >= 2) remIn *= 0.82;

      for (const [uId, count] of sortedEntries) {
        if (remIn <= 0) break;
        const d = UNIT_DEFINITIONS[uId];
        if (!d) continue;
        const effHp = d.hp + d.defense * 4.2;
        const lost = Math.min(count, Math.floor(remIn / effHp + (Math.random() < (remIn % effHp) / effHp * 0.75 ? 1 : 0)));
        if (lost > 0) {
          nextPUnits[uId] = count - lost;
          playerLosses += lost;
          remIn -= lost * effHp;
        }
      }

      if (countUnits(nextPUnits) <= 0) {
        if (targetPA.heroId && state.heroes[targetPA.heroId]) {
          state.heroes[targetPA.heroId] = {
            ...state.heroes[targetPA.heroId],
            status: 'idle',
            assignedId: null,
            hp: Math.max(20, Math.round(state.heroes[targetPA.heroId].hp * 0.5)),
          };
        }
        delete state.armies[targetPA.id];
        state.logs = pushLog(
          state.logs,
          state.year,
          state.season,
          'danger',
          `${targetPA.name} a été mise en déroute dans ${z.name} !`
        );
      } else {
        state.armies[targetPA.id] = { ...targetPA, units: nextPUnits };
      }

      nextBattles[zId] = {
        zoneId: zId,
        round: roundNum,
        phase: 'melee',
        timer: 0,
        lastSummary: `Round ${roundNum} : -${enemyLosses} ennemis, -${playerLosses} alliés`,
        intensity: 1,
      };
    }
  }

  state.battles = nextBattles;
  return state;
}
