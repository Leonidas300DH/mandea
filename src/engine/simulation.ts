import {
  BIOME_INFO,
  CAPITAL_BUILDINGS,
  CITY_TIER_NAMES,
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
  CapitalBuildingId,
  CivicBuildingId,
  DifficultyPace,
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
const SEASON_DURATION_SEC = 48; // ~48s per season at x1 (~3.2 min per year)

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function countUnits(units: Record<string, number>): number {
  return Object.values(units).reduce((sum, n) => sum + Math.max(0, Math.floor(n)), 0);
}

export function computeArmyPower(army: Army, state: GameState): number {
  let power = 0;
  const barracksLvl =
    army.owner === 'player'
      ? state.zones[state.capitalZoneId]?.capitalBuildings.barracks ?? 0
      : 0;
  const barracksMult = 1 + barracksLvl * 0.12;

  for (const [uId, count] of Object.entries(army.units)) {
    if (count <= 0) continue;
    const def = UNIT_DEFINITIONS[uId];
    if (!def) continue;
    const unitVal =
      def.hp * 0.25 +
      def.meleeAtk * 1.4 +
      def.rangedAtk * 1.5 +
      def.armorPierce * 0.8 +
      def.defense * 1.2;
    power += unitVal * count * barracksMult;
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
  const queue = new Set<string>(
    state.zoneOrder.filter((id) => state.zones[id]?.biome !== 'water')
  );

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
      const biomeWeight = nz.biome === 'hills' || nz.biome === 'marsh' ? 1.2 : 1.0;
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
  customName?: string,
  pace: DifficultyPace = 'normal'
): GameState {
  const world = generateOrganicWorld(seed);
  const raceDef = RACES[race];
  const prefix =
    race === 'humans' ? 'h' : race === 'elves' ? 'e' : race === 'dwarves' ? 'd' : 'o';

  const starterUnits: Record<string, number> = {
    [`${prefix}_militia`]: 2,
    [`${prefix}_infantry`]: 1,
    [`${prefix}_archer`]: 2,
  };

  const starterArmyId = uid('army');
  const starterArmy: Army = {
    id: starterArmyId,
    name: 'Armée de la Couronne',
    owner: 'player',
    race,
    zoneId: world.capitalZoneId,
    path: [],
    moveProgress: 0,
    units: starterUnits,
    heroId: null,
  };

  const tavernPool = createTavernHeroes(race);
  const firstHero = { ...tavernPool[0] };
  const remainingTavern = tavernPool.slice(1);

  const makeEstate = (id: EstateId, initSat: number): EstateState => ({
    id,
    satisfaction: initSat,
    targetSatisfaction: initSat,
    taxLevel: 'normal',
    inDisgrace: false,
    crisisTimer: 26,
    factors: [],
  });

  const capitalZone = world.zones[world.capitalZoneId];
  if (capitalZone && customName?.trim()) {
    capitalZone.name = customName.trim();
  }
  const baseWallHp = Math.round(220 * raceDef.bonuses.wallHpMult);
  if (capitalZone) {
    capitalZone.fortHp = baseWallHp;
    capitalZone.maxFortHp = baseWallHp;
  }

  // Calm After Inc pacing: full Year 1 peace on Normal & Peaceful!
  const initRaiderTimer =
    pace === 'peaceful' ? 300 : pace === 'intense' ? 125 : 195;
  const initInvasionTimer =
    pace === 'peaceful' ? 540 : pace === 'intense' ? 240 : 365;

  return {
    started: true,
    gameOver: false,
    gameOverReason: null,
    seed,
    race,
    pace,
    kingdomName: customName?.trim() || raceDef.kingdomTitle,
    year: 1,
    season: 'spring',
    seasonProgress: 0,
    totalTicks: 0,
    speed: 1,
    goalChapter: 1,
    capitalZoneId: world.capitalZoneId,
    resources: {
      intendance: 42,
      maxIntendance: 60,
      food: 120,
      wood: 90,
      gold: 130,
      population: 35,
      maxPopulation: 65,
    },
    rates: {
      intendance: 2.0,
      food: 2.5,
      wood: 2.0,
      gold: 4.0,
    },
    authority: 85,
    authorityDelta: 0,
    festivitiesTimer: 0,
    concessionsCount: 0,
    pendingAuthorityCrisis: false,
    estates: {
      peuple: makeEstate('peuple', 70),
      noblesse: makeEstate('noblesse', 66),
      clerge: makeEstate('clerge', 68),
    },
    zones: world.zones,
    zoneOrder: world.zoneOrder,
    rivers: world.rivers,
    armies: {
      [starterArmyId]: starterArmy,
    },
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
        text: `Fondation de ${customName?.trim() || raceDef.kingdomTitle} ! Suivez les Objectifs en haut à gauche : prenez une Plaine et une Forêt autour de votre Cité.`,
      },
    ],
    raiderTimer: initRaiderTimer,
    raiderWarningZoneId: null,
    invasionTimer: initInvasionTimer,
    invasionWarningZoneId: null,
  };
}

// ==================== SIMPLE, AFTER INC-STYLE ACTION COSTS ====================

export function getExploreCost(state: GameState): number {
  let base = 6;
  if (state.season === 'spring') base -= 1;
  if (state.race === 'elves') base -= 1;
  return Math.max(4, base);
}

/**
 * Just like After Inc's Stamina: claiming an adjacent territory ONLY costs ⚡ Commandement!
 */
export function getClaimCost(state: GameState): number {
  const claimedCount = state.zoneOrder.filter(
    (id) => state.zones[id]?.status === 'claimed'
  ).length;
  return Math.min(26, 8 + claimedCount * 2);
}

/**
 * 1-click repair cost for pillaged provinces (`🔥`): ONLY costs ⚡ 6 Commandement!
 */
export function getRepairCost(): number {
  return 6;
}

export function getResourceBuildCost(
  type: ResourceBuildingType,
  currentLvl: number
): { intendance: number; wood: number } {
  const cfg = RESOURCE_BUILDINGS[type];
  if (currentLvl === 0) {
    return {
      intendance: cfg.baseCost.intendance,
      wood: cfg.baseCost.wood, // 0 wood for Level 1 Lumber Camp!
    };
  }
  const mult = currentLvl === 1 ? 1.5 : 2.1;
  return {
    intendance: Math.round(cfg.baseCost.intendance * 1.2),
    wood: Math.round(Math.max(16, cfg.baseCost.wood) * mult),
  };
}

export function getCapitalUpgradeCost(
  buildingId: CapitalBuildingId,
  currentLvl: number
): { intendance: number; wood: number } {
  const cfg = CAPITAL_BUILDINGS[buildingId];
  const mult = 1 + currentLvl * 0.55;
  return {
    intendance: Math.round(cfg.baseCost.intendance * (1 + currentLvl * 0.25)),
    wood: Math.round(cfg.baseCost.wood * mult),
  };
}

export function getUnitGoldCost(state: GameState, unitId: string): number {
  const def = UNIT_DEFINITIONS[unitId];
  if (!def) return 999;
  const mult = state.race === 'orcs' ? 0.85 : 1.0;
  return Math.round(def.goldCost * mult);
}

// ==================== PLAYER ACTIONS ====================

export function actionExploreZone(state: GameState, zoneId: string): GameState {
  const z = state.zones[zoneId];
  if (!z || z.status !== 'unexplored' || z.biome === 'water') return state;
  const hasKnownNeighbor = z.neighbors.some(
    (nId) => state.zones[nId]?.status !== 'unexplored'
  );
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
    `Zone explorée : ${z.name} (${BIOME_INFO[z.biome].name} — ${BIOME_INFO[z.biome].mapHint}).`
  );

  if (z.dungeon) {
    logs = pushLog(
      logs,
      state.year,
      state.season,
      'epic',
      `Donjon découvert dans ${z.name} ! Cliquez dessus pour y envoyer un Héros.`
    );
  }
  if (z.staticMonster) {
    logs = pushLog(
      logs,
      state.year,
      state.season,
      'warning',
      `${z.staticMonster.name} garde ${z.name} (immobile : il ne vous attaquera pas tant que vous n’entrez pas).`
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
  if (
    !z ||
    (z.status !== 'explored' && z.status !== 'seceded') ||
    z.biome === 'water'
  ) {
    return state;
  }
  const adjacentClaimed = z.neighbors.some(
    (nId) => state.zones[nId]?.status === 'claimed'
  );
  if (!adjacentClaimed) return state;

  if (z.staticMonster) return state;
  const hasHostile = Object.values(state.armies).some(
    (a) => a.zoneId === zoneId && a.owner !== 'player' && countUnits(a.units) > 0
  );
  if (hasHostile) return state;

  const costInt = getClaimCost(state);
  if (state.resources.intendance < costInt) return state;

  const wasSeceded = z.status === 'seceded';
  const updatedZone: Zone = {
    ...z,
    status: 'claimed',
  };

  return {
    ...state,
    resources: {
      ...state.resources,
      intendance: state.resources.intendance - costInt,
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
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'success',
      wasSeceded
        ? `${z.name} réintègre votre Royaume !`
        : `${z.name} prise ! Vous pouvez maintenant y construire.`
    ),
  };
}

export function actionRepairZone(state: GameState, zoneId: string): GameState {
  const z = state.zones[zoneId];
  if (!z || z.pillagedTimer <= 0) return state;
  const cost = getRepairCost();
  if (state.resources.intendance < cost) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      intendance: state.resources.intendance - cost,
    },
    estates: {
      ...state.estates,
      peuple: {
        ...state.estates.peuple,
        satisfaction: Math.min(100, state.estates.peuple.satisfaction + 4),
      },
    },
    zones: {
      ...state.zones,
      [zoneId]: {
        ...z,
        pillagedTimer: 0,
        fortHp: z.maxFortHp,
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'success',
      `🔨 ${z.name} a été réparée ! Sa production fonctionne à nouveau à 100 %.`
    ),
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

  const cost = getResourceBuildCost(type, currentLvl);
  if (
    state.resources.intendance < cost.intendance ||
    state.resources.wood < cost.wood
  ) {
    return state;
  }

  const nextLvl = (currentLvl + 1) as 1 | 2 | 3;
  return {
    ...state,
    resources: {
      ...state.resources,
      intendance: state.resources.intendance - cost.intendance,
      wood: state.resources.wood - cost.wood,
    },
    zones: {
      ...state.zones,
      [zoneId]: {
        ...z,
        pillagedTimer: 0, // Building/upgrading also clears any damage
        resourceBuilding: { type, level: nextLvl },
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'success',
      `${cfg.name} (Niv. ${nextLvl}) construit dans ${z.name} (${cfg.producesLabel}).`
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
    state.resources.intendance < cfg.cost.intendance ||
    state.resources.wood < cfg.cost.wood
  ) {
    return state;
  }

  const raceDef = RACES[state.race];
  const addedFortHp =
    civicId === 'fort' ? Math.round(150 * raceDef.bonuses.wallHpMult) : 0;

  const nextZones: Record<string, Zone> = {
    ...state.zones,
    [zoneId]: {
      ...z,
      civicBuildings: [...z.civicBuildings, civicId],
      fortHp: z.fortHp + addedFortHp,
      maxFortHp: z.maxFortHp + addedFortHp,
    },
  };

  // Fortin also reveals adjacent unexplored zones!
  if (civicId === 'fort') {
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
      intendance: state.resources.intendance - cfg.cost.intendance,
      wood: state.resources.wood - cfg.cost.wood,
    },
    zones: nextZones,
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'success',
      `${cfg.name} bâti dans ${z.name} (${cfg.benefitTag}).`
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
  const costInt = Math.max(4, Math.round(cfg.cost.intendance * discount));

  if (
    state.resources.wood < costWood ||
    state.resources.intendance < costInt
  ) {
    return state;
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - costWood,
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
      `${cfg.name} construite dans ${z.name} !`
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

  const cost = getCapitalUpgradeCost(buildingId, cur);
  if (
    state.resources.intendance < cost.intendance ||
    state.resources.wood < cost.wood
  ) {
    return state;
  }

  const nextLvl = cur + 1;
  const wallBonus =
    buildingId === 'walls'
      ? Math.round(160 * RACES[state.race].bonuses.wallHpMult)
      : buildingId === 'palace'
        ? 45
        : 0;

  return {
    ...state,
    resources: {
      ...state.resources,
      intendance: state.resources.intendance - cost.intendance,
      wood: state.resources.wood - cost.wood,
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
      buildingId === 'palace'
        ? `🏰 Votre Cité grandit : ${CITY_TIER_NAMES[nextLvl] ?? `Niveau ${nextLvl}`} ! (+Commandement/s et +Impôts)`
        : `${cfg.name} passe au Niveau ${nextLvl} dans votre Capitale !`
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
    if (state.resources.food < 30) return state;
    return {
      ...state,
      resources: {
        ...state.resources,
        food: state.resources.food - 30,
      },
      estates: {
        ...state.estates,
        peuple: {
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
        'Distribution royale de Vivres : la satisfaction du Peuple remonte (+15) !'
      ),
    };
  }
  if (estateId === 'noblesse') {
    if (state.resources.gold < 40) return state;
    return {
      ...state,
      resources: {
        ...state.resources,
        gold: state.resources.gold - 40,
      },
      estates: {
        ...state.estates,
        noblesse: {
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
        'Présents & titres accordés : la Noblesse vous acclame (+15) !'
      ),
    };
  }
  if (state.resources.gold < 35) return state;
  return {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold - 35,
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
      'Offrandes au sanctuaire : le Clergé bénit votre règne (+15) !'
    ),
  };
}

export function actionStartFestivities(state: GameState): GameState {
  if (state.festivitiesTimer > 0) return state;
  if (state.resources.gold < 30 || state.resources.food < 25) {
    return state;
  }
  return {
    ...state,
    festivitiesTimer: 38,
    authority: Math.min(100, state.authority + 12),
    resources: {
      ...state.resources,
      gold: state.resources.gold - 30,
      food: state.resources.food - 25,
    },
    estates: {
      peuple: {
        ...state.estates.peuple,
        satisfaction: Math.min(100, state.estates.peuple.satisfaction + 10),
      },
      noblesse: {
        ...state.estates.noblesse,
        satisfaction: Math.min(100, state.estates.noblesse.satisfaction + 8),
      },
      clerge: {
        ...state.estates.clerge,
        satisfaction: Math.min(100, state.estates.clerge.satisfaction + 8),
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'epic',
      '🎉 Grandes Festivités lancées ! L’Autorité et la joie des 3 Ordres remontent (consommation accrue temporairement).'
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
        'Votre Autorité Royale est tombée à 0 face au mécontentement des Ordres, et vous avez abdiqué.',
    };
  }

  const nextConcessions = state.concessionsCount + 1;
  return {
    ...state,
    pendingAuthorityCrisis: false,
    authority: 50,
    concessionsCount: nextConcessions,
    speed: 1,
    estates: {
      peuple: {
        ...state.estates.peuple,
        satisfaction: Math.min(100, Math.max(38, state.estates.peuple.satisfaction + 24)),
        inDisgrace: false,
      },
      noblesse: {
        ...state.estates.noblesse,
        satisfaction: Math.min(100, Math.max(38, state.estates.noblesse.satisfaction + 24)),
        inDisgrace: false,
      },
      clerge: {
        ...state.estates.clerge,
        satisfaction: Math.min(100, Math.max(38, state.estates.clerge.satisfaction + 24)),
        inDisgrace: false,
      },
    },
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'warning',
      `Loyauté achetée (+50 Autorité) ! Vos sujets consomment désormais +${nextConcessions * 12} % de ressources de façon permanente.`
    ),
  };
}

// ==================== MILITARY & HERO ACTIONS ====================

/**
 * Simple 1-cost recruitment (💰 Or only!).
 * Recruits directly into the selected player army (or your main army if none is selected!).
 */
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

  const costGold = getUnitGoldCost(state, unitId);
  if (state.resources.gold < costGold) {
    return state;
  }

  const nextArmies = { ...state.armies };
  const playerArmies = Object.values(nextArmies).filter(
    (a) => a.owner === 'player' && countUnits(a.units) > 0
  );

  let chosenArmy: Army | undefined;
  if (targetArmyId && targetArmyId !== 'new' && nextArmies[targetArmyId]?.owner === 'player') {
    chosenArmy = nextArmies[targetArmyId];
  } else if (targetArmyId !== 'new') {
    // Prefer an army at the Capital, otherwise reinforce the player's primary army!
    chosenArmy =
      playerArmies.find((a) => a.zoneId === state.capitalZoneId) ?? playerArmies[0];
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
    const bannerNum = playerArmies.length + 1;
    nextArmies[newId] = {
      id: newId,
      name: `${bannerNum}e Armée Royale`,
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
    logs: pushLog(
      state.logs,
      state.year,
      state.season,
      'info',
      `🚩 ${army.name} est en marche vers ${dest.name}.`
    ),
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
    nextHeroes[src.heroId] = {
      ...nextHeroes[src.heroId],
      status: 'idle',
      assignedId: null,
    };
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
  const bannerNum =
    Object.values(state.armies).filter((a) => a.owner === 'player').length + 1;
  return {
    ...state,
    armies: {
      ...state.armies,
      [armyId]: { ...src, units: keepUnits },
      [newId]: {
        id: newId,
        name: `${bannerNum}e Armée Royale`,
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
  const costGold = 60;
  if (state.resources.gold < costGold) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold - costGold,
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
      `🗡️ Héros recruté : ${hero.name} (${hero.title}) rejoint votre Royaume !`
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
  if (
    !hero ||
    !zone ||
    !zone.dungeon ||
    zone.dungeon.cleared ||
    zone.dungeon.activeHeroId
  ) {
    return state;
  }
  if (zone.status === 'unexplored') return state;

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
      `🗝️ ${hero.name} explore ${zone.dungeon.name} (Salle ${zone.dungeon.stage}/${zone.dungeon.maxStages}) !`
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
        `${hero.name} ressort prudemment de ${dng.name} avec le butin acquis.`
      ),
    };
  }

  let goldGain = 40 * dng.stars;
  let clergeGain = 5;
  let newRelic = null;
  let hpCost = opt.risk === 'high' ? 20 : opt.risk === 'medium' ? 11 : 4;
  hpCost = Math.max(3, hpCost - hero.level * 2);

  if (opt.outcomeType === 'treasure') {
    goldGain += 50 * dng.stars;
  } else if (opt.outcomeType === 'purify') {
    clergeGain += 10;
    goldGain += 25 * dng.stars;
  } else if (opt.outcomeType === 'relic') {
    newRelic = RELIC_POOL[Math.floor(Math.random() * RELIC_POOL.length)];
  }

  const isFinalStage = dng.stage >= dng.maxStages;
  if (isFinalStage && !newRelic) {
    newRelic = RELIC_POOL[Math.floor(Math.random() * RELIC_POOL.length)];
    goldGain += 60 * dng.stars;
    clergeGain += 8;
  }

  const updatedRelics = newRelic ? [...hero.relics, newRelic].slice(-3) : hero.relics;
  const nextXp = hero.xp + 45 * dng.stars;
  const leveledUp = nextXp >= 100;
  const nextLevel = leveledUp ? hero.level + 1 : hero.level;

  const updatedHero = {
    ...hero,
    level: nextLevel,
    xp: leveledUp ? nextXp - 100 : nextXp,
    maxHp: leveledUp ? hero.maxHp + 20 : hero.maxHp,
    hp: Math.max(18, hero.hp - hpCost + (leveledUp ? 25 : 0)),
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
      ? `🏆 Donjon terminé ! ${hero.name} conquiert ${dng.name} (+${goldGain} 💰 Or${newRelic ? `, Relique : ${newRelic.name}` : ''}) !`
      : `${hero.name} franchit la salle ${dng.stage} de ${dng.name} (+${goldGain} 💰 Or).`
  );

  if (leveledUp) {
    logs = pushLog(
      logs,
      state.year,
      state.season,
      'epic',
      `${hero.name} monte au Niveau ${nextLevel} !`
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

// ==================== GOALS CHECKER (AFTER INC STYLE) ====================

export interface GoalItem {
  id: string;
  label: string;
  done: boolean;
  focusZoneId?: string | null;
  actionKind?: 'map_zone' | 'open_city' | 'open_army' | 'open_estates';
  actionLabel?: string;
}

export function evaluateCurrentGoals(state: GameState): {
  chapter: number;
  title: string;
  rewardText: string;
  goals: GoalItem[];
} {
  const claimedNonCap = state.zoneOrder.filter(
    (id) => id !== state.capitalZoneId && state.zones[id]?.status === 'claimed'
  );
  const hasFoodBuild = claimedNonCap.some(
    (id) =>
      state.zones[id]?.resourceBuilding?.type === 'farm' ||
      state.zones[id]?.resourceBuilding?.type === 'livestock' ||
      state.zones[id]?.resourceBuilding?.type === 'grove'
  );
  const hasWoodBuild = claimedNonCap.some(
    (id) =>
      state.zones[id]?.resourceBuilding?.type === 'lumber' ||
      state.zones[id]?.resourceBuilding?.type === 'grove'
  );
  const hasGoldMine = claimedNonCap.some(
    (id) => state.zones[id]?.resourceBuilding?.type === 'mine'
  );

  const findZoneFor = (
    biomes: Zone['biome'][],
    preferStatus?: Zone['status']
  ): string | null => {
    if (preferStatus) {
      const exact = state.zoneOrder.find(
        (id) =>
          biomes.includes(state.zones[id]?.biome) &&
          state.zones[id]?.status === preferStatus &&
          !state.zones[id]?.resourceBuilding &&
          !state.zones[id]?.staticMonster
      );
      if (exact) return exact;
    }
    return (
      state.zoneOrder.find(
        (id) =>
          biomes.includes(state.zones[id]?.biome) &&
          state.zones[id]?.status !== 'unexplored' &&
          !state.zones[id]?.staticMonster
      ) ?? null
    );
  };

  const cityLvl = state.zones[state.capitalZoneId]?.capitalBuildings.palace ?? 1;
  const totalSoldiers = Object.values(state.armies)
    .filter((a) => a.owner === 'player')
    .reduce((s, a) => s + countUnits(a.units), 0);
  const heroUsedDungeon =
    Object.values(state.heroes).some((h) => h.status === 'dungeon') ||
    state.zoneOrder.some(
      (id) =>
        Boolean(state.zones[id]?.dungeon?.cleared) ||
        (state.zones[id]?.dungeon?.stage ?? 1) > 1
    );
  const dungeonZoneId =
    state.zoneOrder.find(
      (id) =>
        state.zones[id]?.status !== 'unexplored' &&
        state.zones[id]?.dungeon &&
        !state.zones[id]?.dungeon?.cleared
    ) ?? null;

  if (state.goalChapter === 1) {
    return {
      chapter: 1,
      title: 'Chapitre 1 — Nourrir & Chauffer la Colonie',
      rewardText: 'Récompense : +18 ⚡ Commandement & +40 💰 Or',
      goals: [
        {
          id: 'c1_claim',
          label: `Prendre 2 territoires voisins (${Math.min(2, claimedNonCap.length)}/2)`,
          done: claimedNonCap.length >= 2,
          focusZoneId: findZoneFor(['plains', 'pasture', 'forest'], 'explored'),
          actionKind: 'map_zone',
          actionLabel: 'Voir',
        },
        {
          id: 'c1_food',
          label: 'Construire une Ferme (Plaine) ou un Élevage (Pâturage)',
          done: hasFoodBuild,
          focusZoneId:
            findZoneFor(['plains', 'pasture'], 'claimed') ??
            findZoneFor(['plains', 'pasture'], 'explored'),
          actionKind: 'map_zone',
          actionLabel: 'Voir',
        },
        {
          id: 'c1_wood',
          label: 'Construire un Camp de Bûcherons en Forêt (pour l’Hiver)',
          done: hasWoodBuild,
          focusZoneId:
            findZoneFor(['forest'], 'claimed') ?? findZoneFor(['forest'], 'explored'),
          actionKind: 'map_zone',
          actionLabel: 'Voir',
        },
      ],
    };
  }

  if (state.goalChapter === 2) {
    const exploredCount = state.zoneOrder.filter(
      (id) =>
        state.zones[id]?.biome !== 'water' && state.zones[id]?.status !== 'unexplored'
    ).length;
    const fogZoneId =
      state.zoneOrder.find(
        (id) =>
          state.zones[id]?.status === 'unexplored' &&
          state.zones[id]?.biome !== 'water' &&
          state.zones[id]?.neighbors.some(
            (n) => state.zones[n]?.status !== 'unexplored'
          )
      ) ?? null;

    return {
      chapter: 2,
      title: 'Chapitre 2 — Agrandir la Cité & Lever l’Armée',
      rewardText: 'Récompense : +20 ⚡ Commandement, +50 💰 Or & +5 👑 Autorité',
      goals: [
        {
          id: 'c2_city',
          label: 'Agrandir votre Cité au Niveau 2',
          done: cityLvl >= 2,
          actionKind: 'open_city',
          actionLabel: 'Ma Cité',
        },
        {
          id: 'c2_army',
          label: `Avoir au moins 7 soldats dans l’Armée (${Math.min(7, totalSoldiers)}/7)`,
          done: totalSoldiers >= 7,
          actionKind: 'open_army',
          actionLabel: 'Recruter',
        },
        {
          id: 'c2_explore',
          label: `Explorer 9 territoires sur la carte (${Math.min(9, exploredCount)}/9)`,
          done: exploredCount >= 9,
          focusZoneId: fogZoneId,
          actionKind: 'map_zone',
          actionLabel: 'Voir',
        },
      ],
    };
  }

  if (state.goalChapter === 3) {
    const hasRoadOrCivic = claimedNonCap.some(
      (id) =>
        (state.zones[id]?.roadLevel ?? 0) > 0 ||
        (state.zones[id]?.civicBuildings.length ?? 0) > 0
    );
    return {
      chapter: 3,
      title: 'Chapitre 3 — Or, Routes & Donjons',
      rewardText: 'Récompense : +22 ⚡ Commandement, +70 💰 Or & +8 👑 Autorité',
      goals: [
        {
          id: 'c3_mine',
          label: 'Construire une Mine d’Or dans les Collines',
          done: hasGoldMine,
          focusZoneId:
            findZoneFor(['hills', 'ruins'], 'claimed') ??
            findZoneFor(['hills', 'ruins'], 'explored'),
          actionKind: 'map_zone',
          actionLabel: 'Voir',
        },
        {
          id: 'c3_dungeon',
          label: 'Envoyer un Héros explorer un Donjon',
          done: heroUsedDungeon,
          focusZoneId: dungeonZoneId,
          actionKind: 'map_zone',
          actionLabel: 'Donjon',
        },
        {
          id: 'c3_road',
          label: 'Aménager une Route, un Puits ou un Fortin en province',
          done: hasRoadOrCivic,
          focusZoneId: claimedNonCap[0] ?? null,
          actionKind: 'map_zone',
          actionLabel: 'Voir',
        },
      ],
    };
  }

  const allEstatesHappy = (['peuple', 'noblesse', 'clerge'] as EstateId[]).every(
    (e) => state.estates[e].satisfaction >= 65
  );
  const capMenagerie =
    (state.zones[state.capitalZoneId]?.capitalBuildings.menagerie ?? 0) >= 1 ||
    (state.zones[state.capitalZoneId]?.capitalBuildings.noble_court ?? 0) >= 1;

  return {
    chapter: 4,
    title: 'Royaume Florissant (Bac à Sable Infini)',
    rewardText: 'Continuez d’étendre Mandea librement !',
    goals: [
      {
        id: 'c4_city3',
        label: `Élever la Cité au Niveau 3 (${Math.min(3, cityLvl)}/3)`,
        done: cityLvl >= 3,
        actionKind: 'open_city',
        actionLabel: 'Ma Cité',
      },
      {
        id: 'c4_elite',
        label: 'Bâtir la Cour des Nobles ou le Sanctuaire Fantastique',
        done: capMenagerie,
        actionKind: 'open_city',
        actionLabel: 'Ma Cité',
      },
      {
        id: 'c4_estates',
        label: 'Maintenir les 3 Ordres au-dessus de 65 % de satisfaction',
        done: allEstatesHappy,
        actionKind: 'open_estates',
        actionLabel: '3 Ordres',
      },
    ],
  };
}

// ==================== SIMULATION TICK ====================

function buildDungeonEvent(dungeonName: string, stage: number): DungeonChoiceEvent {
  if (stage === 1) {
    return {
      title: `${dungeonName} — Antichambre Scellée`,
      description:
        'Votre Héros découvre une salle aux fresques anciennes gardée par des ombres et un autel oublié.',
      stage,
      options: [
        {
          id: 'purify',
          label: 'Purifier l’autel ancien',
          description: 'Risque faible • Ravit le Clergé (+15) et rapporte de l’Or.',
          risk: 'low',
          outcomeType: 'purify',
        },
        {
          id: 'vault',
          label: 'Ouvrir les coffres scellés',
          description: 'Risque moyen • Gros butin d’💰 Or pour recruter des troupes.',
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
        'Un reliquaire enchanté scintille au centre d’un pont suspendu.',
      stage,
      options: [
        {
          id: 'relic',
          label: 'S’emparer de la Relique',
          description: 'Risque élevé • Obtient immédiatement une Relique pour votre Héros !',
          risk: 'high',
          outcomeType: 'relic',
        },
        {
          id: 'treasure',
          label: 'Prendre l’Or des alcôves',
          description: 'Risque moyen • Coffres d’💰 Or assurés.',
          risk: 'medium',
          outcomeType: 'treasure',
        },
        {
          id: 'retreat',
          label: 'Quitter l’expédition',
          description: 'Préserver la santé du Héros.',
          risk: 'low',
          outcomeType: 'retreat',
        },
      ],
    };
  }
  return {
    title: `${dungeonName} — Le Gardien du Sanctuaire`,
    description:
      'Au cœur du donjon, le Gardien séculaire veille sur le trésor ancestral !',
    stage,
    options: [
      {
        id: 'boss_relic',
        label: 'Terrasser le Gardien',
        description: 'Combat final • Purifie le Donjon, gagne une Relique, de l’XP et beaucoup d’Or !',
        risk: 'high',
        outcomeType: 'relic',
      },
      {
        id: 'boss_purify',
        label: 'Rituel de bannissement',
        description: 'Risque modéré • Purifie le Donjon (+Clergé & +Or).',
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

  // 0. Check progressive Goal Chapter completion!
  if (state.goalChapter <= 3) {
    const evalRes = evaluateCurrentGoals(state);
    if (evalRes.goals.every((g) => g.done)) {
      const rewardInt = state.goalChapter === 1 ? 18 : state.goalChapter === 2 ? 20 : 22;
      const rewardGold = state.goalChapter === 1 ? 40 : state.goalChapter === 2 ? 50 : 70;
      const rewardAuth = state.goalChapter === 1 ? 0 : state.goalChapter === 2 ? 5 : 8;
      state.goalChapter += 1;
      state.resources = {
        ...state.resources,
        intendance: Math.min(
          state.resources.maxIntendance,
          state.resources.intendance + rewardInt
        ),
        gold: state.resources.gold + rewardGold,
      };
      state.authority = Math.min(100, state.authority + rewardAuth);
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'epic',
        `🎉 Objectifs accomplis (${evalRes.title}) ! Vous recevez +${rewardInt} ⚡ Commandement et +${rewardGold} 💰 Or.`
      );
    }
  }

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
      if (state.tavernPool.length < 2) {
        const fresh = createTavernHeroes(state.race);
        const candidate = fresh[Math.floor(Math.random() * fresh.length)];
        state.tavernPool = [...state.tavernPool, candidate];
      }
    }

    if (nextSeason === 'autumn') {
      let farmCount = 0;
      for (const zId of state.zoneOrder) {
        const z = state.zones[zId];
        if (
          z?.status === 'claimed' &&
          z.pillagedTimer <= 0 &&
          z.resourceBuilding?.type === 'farm'
        ) {
          farmCount += z.resourceBuilding.level;
        }
      }
      const harvestBonus = Math.round(20 + farmCount * 16 * raceDef.bonuses.farmMult);
      state.resources = { ...state.resources, food: state.resources.food + harvestBonus };
      state.logs = pushLog(
        state.logs,
        nextYear,
        nextSeason,
        'success',
        `🍂 Automne — Grandes Moissons ! Vos greniers reçoivent +${harvestBonus} 🌾 Vivres avant l’Hiver.`
      );
    } else if (nextSeason === 'winter') {
      state.logs = pushLog(
        state.logs,
        nextYear,
        nextSeason,
        'warning',
        '❄️ L’Hiver arrive ! Les Fermes gèlent (-80 %) et vos habitants brûlent du 🪵 Bois pour se chauffer.'
      );
    } else if (nextSeason === 'spring') {
      state.logs = pushLog(
        state.logs,
        nextYear,
        nextSeason,
        'info',
        `🌱 Printemps de l’An ${nextYear} ! Les récoltes reprennent.`
      );
    } else {
      state.logs = pushLog(
        state.logs,
        nextYear,
        nextSeason,
        'info',
        '☀️ Été : les Fermes tournent à plein régime (+35 %) !'
      );
    }
  }
  state.season = nextSeason;
  state.seasonProgress = nextSeasonProg;
  state.year = nextYear;

  const seasonCfg = SEASONS[state.season];
  const cap = state.zones[state.capitalZoneId];
  const cityLvl = cap?.capitalBuildings.palace ?? 1;
  const marketLvl = cap?.capitalBuildings.grand_market ?? 0;
  const cathedralLvl = cap?.capitalBuildings.cathedral ?? 0;
  const nobleCourtLvl = cap?.capitalBuildings.noble_court ?? 0;
  const wallsLvl = cap?.capitalBuildings.walls ?? 1;
  const barracksLvl = cap?.capitalBuildings.barracks ?? 0;

  // 2. Compute Production, Upkeep & Stamina (Commandement) Regen
  const concessionMult = 1 + state.concessionsCount * 0.12;
  const festivitiesConsumptionMult = state.festivitiesTimer > 0 ? 1.3 : 1.0;
  const peasantStrikeMult = state.estates.peuple.inDisgrace ? 0.5 : 1.0;
  const peasantFervorMult = state.estates.peuple.satisfaction >= 80 ? 1.18 : 1.0;

  let foodProd = 4.6; // Base Capital gardens
  let woodProd = 2.8; // Base Capital woods
  let goldProd =
    2.5 +
    (cityLvl - 1) * 2.8 +
    marketLvl * 5.0 * (state.season === 'autumn' ? 1.15 : 1.0);
  let maxPop = 35 + cityLvl * 30;

  let claimedCount = 0;
  let roadsCount = 0;
  let wellsCount = 0;
  let chapelsCount = 0;
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
      // Very slow natural recovery (or instant via 🔨 Réparer!)
      const nextP = Math.max(0, z.pillagedTimer - dt * 0.65);
      state.zones[zId] = { ...z, pillagedTimer: nextP };
      if (z.status === 'claimed') pillagedZonesCount++;
    }

    if (z.status === 'claimed' && z.fortHp < z.maxFortHp && !state.battles[zId]) {
      state.zones[zId] = {
        ...state.zones[zId],
        fortHp: Math.min(z.maxFortHp, z.fortHp + dt * 3),
      };
    }

    if (z.status !== 'claimed') continue;
    claimedCount++;
    if (z.roadLevel > 0) roadsCount += z.roadLevel;
    if (z.civicBuildings.includes('wells')) {
      wellsCount++;
      maxPop += 18;
    }
    if (z.civicBuildings.includes('chapel')) chapelsCount++;
    if (z.civicBuildings.includes('fort')) fortsCount++;
    if (z.civicBuildings.includes('market') && z.pillagedTimer <= 0) {
      const roadBoost = z.roadLevel === 2 ? 1.35 : z.roadLevel === 1 ? 1.18 : 1.0;
      const humanTrade = state.race === 'humans' ? 1.15 : 1.0;
      goldProd += 3.0 * roadBoost * humanTrade;
    }

    if (z.pillagedTimer > 0) continue; // Damaged province waits for repair!

    const localRoadProdMult =
      1 +
      (z.roadLevel === 2
        ? ROAD_UPGRADES[2].prodBonus
        : z.roadLevel === 1
          ? ROAD_UPGRADES[1].prodBonus
          : 0);

    if (z.resourceBuilding) {
      const rb = z.resourceBuilding;
      const cfg = RESOURCE_BUILDINGS[rb.type];
      const lvlScale = rb.level === 1 ? 1 : rb.level === 2 ? 1.75 : 2.55;
      const eff = lvlScale * localRoadProdMult * peasantStrikeMult * peasantFervorMult;

      if (rb.type === 'farm') {
        foodProd +=
          (cfg.outputPerLevel.food ?? 0) *
          eff *
          seasonCfg.farmMult *
          raceDef.bonuses.farmMult;
      } else if (rb.type === 'livestock') {
        foodProd +=
          (cfg.outputPerLevel.food ?? 0) *
          eff *
          seasonCfg.livestockMult *
          raceDef.bonuses.livestockMult;
        goldProd += (cfg.outputPerLevel.gold ?? 0) * eff;
      } else if (rb.type === 'lumber') {
        woodProd += (cfg.outputPerLevel.wood ?? 0) * eff * seasonCfg.lumberMult;
        if (raceDef.bonuses.forestFoodBonus > 0) {
          foodProd += raceDef.bonuses.forestFoodBonus * lvlScale * peasantStrikeMult;
        }
      } else if (rb.type === 'mine') {
        goldProd += (cfg.outputPerLevel.gold ?? 0) * eff * raceDef.bonuses.mineMult;
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
  const popTax =
    state.resources.population * 0.09 * taxMultipliers[state.estates.peuple.taxLevel];
  const nobleTax =
    (2.2 + fortsCount * 1.0 + nobleCourtLvl * 2.0) *
    taxMultipliers[state.estates.noblesse.taxLevel];
  const clergeTax =
    (1.8 + chapelsCount * 1.2 + cathedralLvl * 1.8) *
    taxMultipliers[state.estates.clerge.taxLevel];
  goldProd += popTax + nobleTax + clergeTax;

  // Consumption
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

  const baseFoodCons =
    (state.resources.population * 0.08 + armyFoodUpkeep) *
    concessionMult *
    festivitiesConsumptionMult;
  const winterWoodCons = seasonCfg.winterHeating
    ? state.resources.population *
      0.09 *
      (1 - raceDef.bonuses.winterWoodDiscount) *
      concessionMult
    : state.festivitiesTimer > 0
      ? 1.2
      : 0;
  const totalGoldCons =
    armyGoldUpkeep * concessionMult * (state.festivitiesTimer > 0 ? 1.2 : 1.0);

  // Commandement (Stamina) scales smoothly with City Level!
  const maxIntendance = 45 + cityLvl * 15 + Math.floor(claimedCount * 1.5);
  let intendanceRegen = 1.4 + cityLvl * 0.55;
  if (state.pace === 'peaceful') intendanceRegen += 0.5;
  if (state.estates.noblesse.satisfaction >= 75) intendanceRegen += 0.4;
  if (state.estates.clerge.inDisgrace) intendanceRegen *= 0.7;

  const netFood = foodProd - baseFoodCons;
  const netWood = woodProd - winterWoodCons;
  const netGold = goldProd - totalGoldCons;

  const nextFood = Math.max(0, state.resources.food + netFood * dt);
  const nextWood = Math.max(0, state.resources.wood + netWood * dt);
  const nextGold = Math.max(0, state.resources.gold + netGold * dt);
  const nextIntendance = Math.min(
    maxIntendance,
    state.resources.intendance + intendanceRegen * dt
  );

  const isStarving = nextFood <= 0.1 && netFood < 0;
  const isFreezing = seasonCfg.winterHeating && nextWood <= 0.1 && netWood < 0;

  let nextPop = state.resources.population;
  if (isStarving || isFreezing) {
    nextPop = Math.max(15, nextPop - dt * 0.4);
  } else if (nextPop < maxPop && nextFood > 20) {
    const growthFactor = state.estates.peuple.satisfaction >= 70 ? 0.4 : 0.22;
    nextPop = Math.min(maxPop, nextPop + dt * growthFactor);
  }

  state.resources = {
    intendance: nextIntendance,
    maxIntendance,
    food: nextFood,
    wood: nextWood,
    gold: nextGold,
    population: nextPop,
    maxPopulation: maxPop,
  };
  state.rates = {
    intendance: +intendanceRegen.toFixed(1),
    food: +netFood.toFixed(1),
    wood: +netWood.toFixed(1),
    gold: +netGold.toFixed(1),
  };

  if (state.festivitiesTimer > 0) {
    state.festivitiesTimer = Math.max(0, state.festivitiesTimer - dt);
  }

  // 3. Compute the 3 Estates Satisfaction
  const taxSatDelta: Record<TaxLevel, number> = {
    exempt: 18,
    low: 9,
    normal: 0,
    high: -22,
  };

  const clergeSchismPenalty = state.estates.clerge.inDisgrace ? -8 : 0;
  const springBonus = state.season === 'spring' ? 4 : 0;
  const festBonus = state.festivitiesTimer > 0 ? 15 : 0;

  // --- PEUPLE ---
  const peupleFactors: { label: string; delta: number }[] = [
    { label: 'Base loyale', delta: 56 },
  ];
  if (taxSatDelta[state.estates.peuple.taxLevel] !== 0) {
    peupleFactors.push({
      label: 'Niveau d’impôt',
      delta: taxSatDelta[state.estates.peuple.taxLevel],
    });
  }
  const livingBonus = Math.min(26, wellsCount * 6 + roadsCount * 3 + marketLvl * 6);
  if (livingBonus > 0) {
    peupleFactors.push({
      label: 'Routes, Puits & Marchés',
      delta: Math.round(livingBonus),
    });
  }
  if (wallsLvl > 0) {
    peupleFactors.push({ label: 'Protection des Remparts', delta: wallsLvl * 4 });
  }
  if (isStarving) peupleFactors.push({ label: 'Manque de Vivres !', delta: -30 });
  if (isFreezing) peupleFactors.push({ label: 'Manque de Bois en Hiver !', delta: -24 });
  if (pillagedZonesCount > 0) {
    peupleFactors.push({
      label: 'Provinces à réparer (🔥)',
      delta: -pillagedZonesCount * 7,
    });
  }
  if (clergeSchismPenalty < 0) {
    peupleFactors.push({ label: 'Schisme du Clergé', delta: clergeSchismPenalty });
  }
  if (festBonus > 0) peupleFactors.push({ label: 'Festivités en cours', delta: festBonus });
  if (springBonus > 0) peupleFactors.push({ label: 'Printemps', delta: springBonus });

  // --- NOBLESSE ---
  const noblesseFactors: { label: string; delta: number }[] = [
    { label: 'Base féodale', delta: 55 },
  ];
  if (taxSatDelta[state.estates.noblesse.taxLevel] !== 0) {
    noblesseFactors.push({
      label: 'Fiscalité noble',
      delta: taxSatDelta[state.estates.noblesse.taxLevel],
    });
  }
  const nobleInfra = Math.min(
    30,
    nobleCourtLvl * 12 + fortsCount * 7 + barracksLvl * 4 + wallsLvl * 3
  );
  if (nobleInfra > 0) {
    noblesseFactors.push({ label: 'Cour, Fortins & Caserne', delta: nobleInfra });
  }
  if (totalPlayerUnits >= 7) {
    noblesseFactors.push({ label: 'Armée prestigieuse', delta: 6 });
  }
  if (claimedCount <= 1 && state.year >= 3) {
    noblesseFactors.push({ label: 'Domaine trop petit', delta: -8 });
  }
  if (festBonus > 0) noblesseFactors.push({ label: 'Festivités', delta: festBonus });

  // --- CLERGÉ ---
  const clergeFactors: { label: string; delta: number }[] = [
    { label: 'Base spirituelle', delta: 56 },
  ];
  if (taxSatDelta[state.estates.clerge.taxLevel] !== 0) {
    clergeFactors.push({
      label: 'Fiscalité du Clergé',
      delta: taxSatDelta[state.estates.clerge.taxLevel],
    });
  }
  const sacredInfra = Math.min(
    32,
    cathedralLvl * 13 + chapelsCount * 8 + (cap?.capitalBuildings.menagerie ?? 0) * 5
  );
  if (sacredInfra > 0) {
    clergeFactors.push({ label: 'Église & Chapelles', delta: sacredInfra });
  }
  if (clearedDungeonsCount > 0) {
    clergeFactors.push({
      label: 'Donjons purifiés',
      delta: Math.min(18, clearedDungeonsCount * 6),
    });
  }
  if (corruptedDungeonsCount > 0) {
    clergeFactors.push({
      label: 'Donjons maudits ouverts',
      delta: -corruptedDungeonsCount * 9,
    });
  }
  if (festBonus > 0) clergeFactors.push({ label: 'Festivités', delta: festBonus });

  const updateEstate = (
    est: EstateState,
    factors: { label: string; delta: number }[]
  ): EstateState => {
    const rawTarget = factors.reduce((s, f) => s + f.delta, 0);
    const target = Math.max(0, Math.min(100, rawTarget));
    const diff = target - est.satisfaction;
    const nextSat = Math.max(0, Math.min(100, est.satisfaction + diff * 0.08 * dt));
    const nowDisgrace = nextSat < 20;

    return {
      ...est,
      satisfaction: nextSat,
      targetSatisfaction: target,
      inDisgrace: nowDisgrace,
      factors,
      crisisTimer: nowDisgrace ? est.crisisTimer - dt : 24,
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

  // Asymmetric Disgrace Crises (only when an estate drops below 20%!)
  if (state.estates.peuple.inDisgrace) {
    if (!prevDisgrace.peuple) {
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        '⚠️ DISGRÂCE DU PEUPLE (<20%) ! Baissez leurs impôts ou donnez des Vivres dans l’onglet « 3 Ordres » !'
      );
      state.estates.peuple.crisisTimer = 6;
    }
    if (state.estates.peuple.crisisTimer <= 0) {
      state.estates.peuple.crisisTimer = 42;
      const ruralClaimed = state.zoneOrder.filter(
        (id) => id !== state.capitalZoneId && state.zones[id]?.status === 'claimed'
      );
      const spawnZoneId =
        ruralClaimed[0] ?? state.zones[state.capitalZoneId].neighbors[0];
      if (spawnZoneId && state.zones[spawnZoneId]) {
        const rebelId = uid('rebel');
        state.armies[rebelId] = {
          id: rebelId,
          name: 'Serfs Révoltés',
          owner: 'rebel_peasants',
          race: 'enemy',
          zoneId: spawnZoneId,
          path: findShortestZonePath(state, spawnZoneId, state.capitalZoneId, true),
          moveProgress: 0,
          units: { rebel_peasant: Math.min(6, 2 + Math.floor(state.year * 0.6)) },
          heroId: null,
          aiIntent: 'siege_capital',
        };
        state.zones[spawnZoneId] = { ...state.zones[spawnZoneId], pillagedTimer: 60 };
        state.logs = pushLog(
          state.logs,
          state.year,
          state.season,
          'danger',
          `Révolte paysanne dans ${state.zones[spawnZoneId].name} !`
        );
      }
    }
  }

  if (state.estates.noblesse.inDisgrace) {
    if (!prevDisgrace.noblesse) {
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        '⚠️ DISGRÂCE DE LA NOBLESSE (<20%) ! Les Barons menacent de faire sécession !'
      );
      state.estates.noblesse.crisisTimer = 6;
    }
    if (state.estates.noblesse.crisisTimer <= 0) {
      state.estates.noblesse.crisisTimer = 48;
      const candidateProvinces = state.zoneOrder.filter(
        (id) => id !== state.capitalZoneId && state.zones[id]?.status === 'claimed'
      );
      const secedeId = candidateProvinces[candidateProvinces.length - 1];
      const spawnId = secedeId ?? state.zones[state.capitalZoneId].neighbors[0];
      if (spawnId && state.zones[spawnId]) {
        if (secedeId) {
          state.zones[secedeId] = { ...state.zones[secedeId], status: 'seceded' };
        }
        const baronArmyId = uid('baron');
        state.armies[baronArmyId] = {
          id: baronArmyId,
          name: 'Armée du Baron Rebelle',
          owner: 'secession_nobles',
          race: 'enemy',
          zoneId: spawnId,
          path: findShortestZonePath(state, spawnId, state.capitalZoneId, true),
          moveProgress: 0,
          units: {
            rebel_noble_inf: 2,
            rebel_noble_knight: 1,
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
            ? `Sécession noble de ${state.zones[secedeId].name} !`
            : 'Un Baron rebelle marche sur votre Capitale !'
        );
      }
    }
  }

  if (state.estates.clerge.inDisgrace) {
    if (!prevDisgrace.clerge) {
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        '⚠️ DISGRÂCE DU CLERGÉ (<20%) ! Le Schisme affaiblit votre Autorité !'
      );
      state.estates.clerge.crisisTimer = 6;
    }
    if (state.estates.clerge.crisisTimer <= 0) {
      state.estates.clerge.crisisTimer = 46;
      const borderZones = state.zoneOrder.filter(
        (id) =>
          id !== state.capitalZoneId &&
          state.zones[id]?.biome !== 'water' &&
          state.zones[id]?.status !== 'unexplored'
      );
      const riftZoneId = borderZones[Math.floor(Math.random() * borderZones.length)];
      if (riftZoneId && state.zones[riftZoneId]) {
        const zealotId = uid('zealot');
        state.armies[zealotId] = {
          id: zealotId,
          name: 'Zélotes du Schisme',
          owner: 'schism_zealots',
          race: 'enemy',
          zoneId: riftZoneId,
          path: findShortestZonePath(state, riftZoneId, state.capitalZoneId, true),
          moveProgress: 0,
          units: { zealot_fanatic: 3 },
          heroId: null,
          aiIntent: 'siege_capital',
        };
        state.logs = pushLog(
          state.logs,
          state.year,
          state.season,
          'danger',
          `Des Zélotes fanatiques surgissent à ${state.zones[riftZoneId].name} !`
        );
      }
    }
  }

  // 4. Royal Authority ("Supported by at least 2 of 3 Estates" rule)
  const supportedEstatesCount = (['peuple', 'noblesse', 'clerge'] as EstateId[]).filter(
    (id) => !state.estates[id].inDisgrace
  ).length;
  const capitalUnderSiege = Boolean(state.battles[state.capitalZoneId]);

  let authDelta = 0;
  if (supportedEstatesCount === 1) authDelta -= 1.5;
  else if (supportedEstatesCount === 0) authDelta -= 2.8;
  else if (supportedEstatesCount === 3 && state.estates.peuple.satisfaction >= 60) {
    authDelta += 0.25 + cathedralLvl * 0.1;
  }

  if (capitalUnderSiege) authDelta -= 0.6;
  if (state.festivitiesTimer > 0) authDelta += 1.0;

  state.authorityDelta = +authDelta.toFixed(2);
  state.authority = Math.max(0, Math.min(100, state.authority + authDelta * dt));

  if (state.authority <= 0 && !state.pendingAuthorityCrisis) {
    state.pendingAuthorityCrisis = true;
    state.speed = 0;
  }

  // 5. CALM, READABLE, SPACED-OUT THREATS (Never dogpile the player!)
  const activeHostileArmies = Object.values(state.armies).filter(
    (a) => a.owner !== 'player' && countUnits(a.units) > 0
  );

  // Pause raid & invasion countdowns slightly if the player is ALREADY fighting an enemy army!
  if (activeHostileArmies.length === 0) {
    state.raiderTimer -= dt;
    state.invasionTimer -= dt;
  }

  // 5A. Spaced Raider Foray with 18s Advance Warning!
  if (state.raiderTimer <= 18 && !state.raiderWarningZoneId && activeHostileArmies.length === 0) {
    const wildBorderZones = state.zoneOrder.filter((id) => {
      const z = state.zones[id];
      return (
        z &&
        z.biome !== 'water' &&
        z.status !== 'claimed' &&
        z.neighbors.some((n) => state.zones[n]?.status === 'claimed')
      );
    });
    const pickWarn =
      wildBorderZones[Math.floor(Math.random() * wildBorderZones.length)] ?? null;
    if (pickWarn && state.zones[pickWarn]) {
      state.zones[pickWarn] = {
        ...state.zones[pickWarn],
        status: 'explored',
        exploreProgress: 100,
      };
      state.raiderWarningZoneId = pickWarn;
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'warning',
        `⚠️ Alerte éclaireurs : une bande de Pillards approche par ${state.zones[pickWarn].name} (attaque dans ~18s) !`
      );
    }
  }

  if (state.raiderTimer <= 0) {
    const cooldown =
      state.pace === 'peaceful' ? 175 : state.pace === 'intense' ? 75 : 115;
    state.raiderTimer = cooldown;

    const spawnZ = state.raiderWarningZoneId;
    state.raiderWarningZoneId = null;

    const econTargets = state.zoneOrder.filter((id) => {
      const z = state.zones[id];
      return (
        z &&
        z.status === 'claimed' &&
        id !== state.capitalZoneId &&
        z.pillagedTimer <= 0 &&
        (z.resourceBuilding || z.civicBuildings.length > 0)
      );
    });

    if (spawnZ && state.zones[spawnZ] && econTargets.length > 0 && activeHostileArmies.length === 0) {
      // Pick closest claimed province to raid
      econTargets.sort((a, b) => {
        const pa = findShortestZonePath(state, spawnZ, a, true).length;
        const pb = findShortestZonePath(state, spawnZ, b, true).length;
        return pa - pb;
      });
      const targetZ = econTargets[0];
      const rId = uid('raid');
      const scale = Math.min(5, 2 + Math.floor((state.year - 1) * 0.6));

      state.armies[rId] = {
        id: rId,
        name: 'Pillards',
        owner: 'raiders',
        race: 'enemy',
        zoneId: spawnZ,
        path: findShortestZonePath(state, spawnZ, targetZ, true),
        moveProgress: 0,
        units: {
          raider_goblin: scale,
          ...(state.year >= 3 ? { raider_worg: 1 } : {}),
        },
        heroId: null,
        aiIntent: 'pillage',
      };
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'warning',
        `🔥 Des Pillards entrent par ${state.zones[spawnZ].name} vers ${state.zones[targetZ].name} ! Envoyez votre Armée les intercepter.`
      );
    }
  }

  // 5B. Rare Major Invasion Army (Year 3+ on Normal) with 35s Advance Warning!
  if (state.invasionTimer <= 35 && !state.invasionWarningZoneId) {
    const outerZones = state.zoneOrder.filter((id) => {
      const z = state.zones[id];
      return z && z.biome !== 'water' && z.status !== 'claimed' && z.isCoastal;
    });
    const warnId =
      outerZones[Math.floor(Math.random() * outerZones.length)] ??
      state.zoneOrder.find(
        (id) => state.zones[id]?.biome !== 'water' && id !== state.capitalZoneId
      ) ??
      null;
    if (warnId && state.zones[warnId]) {
      state.zones[warnId] = {
        ...state.zones[warnId],
        status: 'explored',
        exploreProgress: 100,
      };
      state.invasionWarningZoneId = warnId;
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        `📯 Grande Alerte : une Armée d’Invasion débarquera à ${state.zones[warnId].name} dans ~35 secondes ! Préparez vos troupes !`
      );
    }
  }

  if (state.invasionTimer <= 0) {
    const spawnId = state.invasionWarningZoneId;
    state.invasionTimer =
      state.pace === 'peaceful' ? 360 : state.pace === 'intense' ? 165 : 240;
    state.invasionWarningZoneId = null;

    if (spawnId && state.zones[spawnId]) {
      const invId = uid('inv');
      const wavePower = Math.max(1, Math.min(5, state.year - 1));
      state.armies[invId] = {
        id: invId,
        name: `Ost d’Invasion`,
        owner: 'invasion',
        race: 'enemy',
        zoneId: spawnId,
        path: findShortestZonePath(state, spawnId, state.capitalZoneId, true),
        moveProgress: 0,
        units: {
          inv_pikeman: 2 + wavePower,
          inv_crossbow: 1 + Math.floor(wavePower * 0.8),
          ...(wavePower >= 3 ? { inv_siege_ogre: 1 } : {}),
        },
        heroId: null,
        aiIntent: 'siege_capital',
      };
      state.logs = pushLog(
        state.logs,
        state.year,
        state.season,
        'danger',
        `⚔️ L’Ost d’Invasion marche depuis ${state.zones[spawnId].name} vers votre Capitale !`
      );
    }
  }

  // 6. Dungeon Expedition Progress & Hero Healing
  for (const h of Object.values(state.heroes)) {
    if (h.status !== 'dungeon' && h.hp < h.maxHp && !state.estates.clerge.inDisgrace) {
      state.heroes[h.id] = { ...h, hp: Math.min(h.maxHp, h.hp + dt * 3) };
    }
  }

  for (const zId of state.zoneOrder) {
    const z = state.zones[zId];
    if (
      !z?.dungeon ||
      !z.dungeon.activeHeroId ||
      z.dungeon.cleared ||
      z.dungeon.pendingEvent
    ) {
      continue;
    }
    const hero = state.heroes[z.dungeon.activeHeroId];
    if (!hero) continue;

    const speed = 12 + hero.dungeonPower * 0.25;
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

  // 7. Army Movement & Fair Hit-and-Run Raider Pillage
  for (const army of Object.values(state.armies)) {
    if (countUnits(army.units) <= 0) {
      delete state.armies[army.id];
      continue;
    }

    const zoneHasEnemy =
      army.owner === 'player'
        ? Boolean(state.zones[army.zoneId]?.staticMonster) ||
          Object.values(state.armies).some(
            (other) =>
              other.zoneId === army.zoneId &&
              other.owner !== 'player' &&
              countUnits(other.units) > 0
          )
        : Object.values(state.armies).some(
            (other) =>
              other.zoneId === army.zoneId &&
              other.owner === 'player' &&
              countUnits(other.units) > 0
          );

    if (zoneHasEnemy) continue;

    if (
      army.owner === 'player' &&
      state.zones[army.zoneId]?.civicBuildings.includes('chapel')
    ) {
      if (army.heroId && state.heroes[army.heroId]) {
        const h = state.heroes[army.heroId];
        state.heroes[army.heroId] = { ...h, hp: Math.min(h.maxHp, h.hp + dt * 3.5) };
      }
    }

    // Enemy behavior on arrival
    if (army.owner !== 'player' && army.path.length === 0) {
      const curZone = state.zones[army.zoneId];
      if (army.owner === 'raiders') {
        if (
          curZone &&
          curZone.status === 'claimed' &&
          army.zoneId !== state.capitalZoneId &&
          curZone.pillagedTimer <= 0
        ) {
          // Fortin blocks & shoots raiders!
          if (curZone.fortHp > 0) {
            state.zones[army.zoneId] = {
              ...curZone,
              fortHp: Math.max(0, curZone.fortHp - dt * 14),
            };
            // Fortin kills raiders trying to breach it!
            if (Math.random() < 0.22 * dt) {
              const entry = Object.entries(army.units).find(([, c]) => c > 0);
              if (entry) {
                const [uId, c] = entry;
                state.armies[army.id] = {
                  ...army,
                  units: { ...army.units, [uId]: c - 1 },
                };
              }
            }
          } else {
            // Single hit-and-run pillage, then raiders leave with their loot!
            const stolenGold = Math.min(state.resources.gold, 14);
            const stolenFood = Math.min(state.resources.food, 16);
            state.resources.gold -= stolenGold;
            state.resources.food -= stolenFood;
            state.zones[army.zoneId] = { ...curZone, pillagedTimer: 75 };
            delete state.armies[army.id];
            state.logs = pushLog(
              state.logs,
              state.year,
              state.season,
              'danger',
              `🔥 ${curZone.name} a été pillée puis les pillards ont pris la fuite ! Cliquez sur « 🔨 Réparer » sur la province pour relancer la production.`
            );
          }
          continue;
        } else {
          // No valid target left -> disperse
          delete state.armies[army.id];
          continue;
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

      // Player armies march briskly so responding to alerts feels snappy!
      const ownerBoost = updatedArmy.owner === 'player' ? 0.34 : 0.22;
      const stepRate = ownerBoost * avgUnitSpeed * roadMult;
      const nextProg = updatedArmy.moveProgress + stepRate * dt;

      if (nextProg >= 1) {
        state.armies[updatedArmy.id] = {
          ...updatedArmy,
          zoneId: nextZId,
          path: updatedArmy.path.slice(1),
          moveProgress: 0,
        };
      } else {
        state.armies[updatedArmy.id] = {
          ...updatedArmy,
          moveProgress: nextProg,
        };
      }
    }
  }

  // 8. Tactical Zone Battles & Capital Siege
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

    // Case A: Undefended Capital or Fort under siege
    if (playerArmies.length === 0 && enemyArmies.length > 0 && z.status === 'claimed') {
      if (z.fortHp > 0) {
        let siegeDps = 0;
        for (const ea of enemyArmies) {
          for (const [uId, c] of Object.entries(ea.units)) {
            const def = UNIT_DEFINITIONS[uId];
            if (def && c > 0) siegeDps += (def.meleeAtk * 0.4 + def.armorPierce * 0.5) * c;
          }
        }
        const towerBackfire =
          zId === state.capitalZoneId
            ? 14 + wallsLvl * 10
            : z.civicBuildings.includes('fort')
              ? 12
              : 4;

        state.zones[zId] = {
          ...z,
          fortHp: Math.max(0, z.fortHp - siegeDps * 0.3 * dt),
        };
        nextBattles[zId] = {
          zoneId: zId,
          round: state.battles[zId]?.round ?? 1,
          phase: 'ranged',
          timer: (state.battles[zId]?.timer ?? 0) + dt,
          lastSummary: `Siège en cours contre les remparts de ${z.name} !`,
          intensity: 1,
        };

        if (Math.random() < towerBackfire * 0.01 * dt) {
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
        state.gameOver = true;
        state.speed = 0;
        state.gameOverReason = `Votre Capitale (${z.name}) est tombée face à ${enemyArmies[0].name} en l’An ${state.year}.`;
        return state;
      }
      continue;
    }

    // Case B: Active Clash
    if (playerArmies.length > 0 && (enemyArmies.length > 0 || hasStaticMonster)) {
      const prevBattle = state.battles[zId];
      const nextTimer = (prevBattle?.timer ?? 0) + dt;
      const roundInterval = 1.5;

      if (nextTimer < roundInterval) {
        nextBattles[zId] = {
          zoneId: zId,
          round: prevBattle?.round ?? 1,
          phase: nextTimer < roundInterval * 0.5 ? 'ranged' : 'melee',
          timer: nextTimer,
          lastSummary: prevBattle?.lastSummary ?? `Combat en cours dans ${z.name} !`,
          intensity: 1,
        };
        continue;
      }

      const roundNum = (prevBattle?.round ?? 0) + 1;
      const elfRangedMult = state.race === 'elves' ? 1.2 : 1.0;
      const barracksAtkMult = 1 + barracksLvl * 0.12;

      let pRangedDmg = z.status === 'claimed' && z.civicBuildings.includes('fort') ? 18 : 0;
      if (zId === state.capitalZoneId) pRangedDmg += 16 + wallsLvl * 10;
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
          pMeleeDmg += 20 + h.level * 6;
        }
        for (const [uId, n] of Object.entries(pa.units)) {
          if (n <= 0) continue;
          const d = UNIT_DEFINITIONS[uId];
          if (!d) continue;
          pRangedDmg += d.rangedAtk * n * elfRangedMult * barracksAtkMult;
          pMeleeDmg += d.meleeAtk * n * barracksAtkMult;
          pPierce += d.armorPierce * n;
          if (
            d.role === 'infantry' ||
            d.role === 'militia' ||
            (d.role === 'fantasy' && d.hp >= 120)
          ) {
            pFrontlineCount += n;
          }
        }
      }

      const totalPlayerAttack =
        (pRangedDmg * 1.15 + pMeleeDmg + pPierce * 0.85) * heroAtkMult;

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

      let enemyLosses = 0;
      if (enemyArmies.length > 0) {
        const targetEA = enemyArmies[0];
        const nextEUnits = { ...targetEA.units };
        let dmgPool = totalPlayerAttack * (0.9 + Math.random() * 0.3);

        for (const [uId, count] of Object.entries(nextEUnits)) {
          if (count <= 0 || dmgPool <= 0) continue;
          const d = UNIT_DEFINITIONS[uId];
          if (!d) continue;
          const effHp = d.hp + d.defense * 3.2;
          const killed = Math.min(
            count,
            Math.floor(dmgPool / effHp + (Math.random() < (dmgPool % effHp) / effHp ? 1 : 0))
          );
          if (killed > 0) {
            nextEUnits[uId] = count - killed;
            enemyLosses += killed;
            dmgPool -= killed * effHp;
          }
        }

        if (countUnits(nextEUnits) <= 0) {
          delete state.armies[targetEA.id];
          const bounty = enemyLosses * raceDef.bonuses.battleGoldBounty + 22;
          state.resources.gold += bounty;
          for (const pa of playerArmies) {
            if (pa.heroId && state.heroes[pa.heroId]) {
              const h = state.heroes[pa.heroId];
              const nxp = h.xp + 35;
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
            `⚔️ Victoire à ${z.name} ! ${targetEA.name} est vaincue (+${bounty} 💰 Or).`
          );
        } else {
          state.armies[targetEA.id] = { ...targetEA, units: nextEUnits };
          if (raceDef.bonuses.battleGoldBounty > 0 && enemyLosses > 0) {
            state.resources.gold += enemyLosses * raceDef.bonuses.battleGoldBounty;
          }
        }
      } else if (z.staticMonster) {
        const nextMUnits = { ...z.staticMonster.units };
        let dmgPool = totalPlayerAttack * (0.95 + Math.random() * 0.3);
        for (const [uId, count] of Object.entries(nextMUnits)) {
          if (count <= 0 || dmgPool <= 0) continue;
          const d = UNIT_DEFINITIONS[uId];
          if (!d) continue;
          const effHp = d.hp + Math.max(0, d.defense * 3 - pPierce * 0.5);
          const killed = Math.min(
            count,
            Math.floor(dmgPool / effHp + (Math.random() < (dmgPool % effHp) / effHp ? 1 : 0))
          );
          if (killed > 0) {
            nextMUnits[uId] = count - killed;
            enemyLosses += killed;
            dmgPool -= killed * effHp;
          }
        }
        if (countUnits(nextMUnits) <= 0) {
          const rwGold = z.staticMonster.rewardGold;
          const rwWood = z.staticMonster.rewardWood;
          const mName = z.staticMonster.name;
          state.zones[zId] = { ...z, staticMonster: null };
          state.resources.gold += rwGold;
          state.resources.wood += rwWood;
          state.estates.clerge.satisfaction = Math.min(
            100,
            state.estates.clerge.satisfaction + 6
          );
          state.estates.noblesse.satisfaction = Math.min(
            100,
            state.estates.noblesse.satisfaction + 6
          );
          state.logs = pushLog(
            state.logs,
            state.year,
            state.season,
            'epic',
            `🐉 Monstre terrassé ! ${mName} est vaincu dans ${z.name} (+${rwGold} 💰 Or, +${rwWood} 🪵 Bois). Vous pouvez prendre la zone !`
          );
        } else {
          state.zones[zId] = {
            ...z,
            staticMonster: { ...z.staticMonster, units: nextMUnits },
          };
        }
      }

      // Casualties to Player
      let playerLosses = 0;
      const incomingDmg = (eTotalAttack / heroDefMult) * (0.7 + Math.random() * 0.3);
      const targetPA = playerArmies[0];
      const nextPUnits = { ...targetPA.units };

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
        .sort(
          ([a], [b]) =>
            (rolePriority[UNIT_DEFINITIONS[a]?.role ?? 'militia'] ?? 3) -
            (rolePriority[UNIT_DEFINITIONS[b]?.role ?? 'militia'] ?? 3)
        );

      let remIn = incomingDmg;
      if (pFrontlineCount >= 2) remIn *= 0.8;

      for (const [uId, count] of sortedEntries) {
        if (remIn <= 0) break;
        const d = UNIT_DEFINITIONS[uId];
        if (!d) continue;
        const effHp = d.hp + d.defense * 4.5;
        const lost = Math.min(
          count,
          Math.floor(remIn / effHp + (Math.random() < ((remIn % effHp) / effHp) * 0.7 ? 1 : 0))
        );
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
            hp: Math.max(25, Math.round(state.heroes[targetPA.heroId].hp * 0.6)),
          };
        }
        delete state.armies[targetPA.id];
        state.logs = pushLog(
          state.logs,
          state.year,
          state.season,
          'danger',
          `${targetPA.name} a été dispersée dans ${z.name} ! Recrutez de nouveaux soldats via le bouton « ⚔️ Armée & Héros » en bas.`
        );
      } else {
        state.armies[targetPA.id] = { ...targetPA, units: nextPUnits };
        const stillEnemy =
          Boolean(state.zones[zId]?.staticMonster) ||
          Object.values(state.armies).some(
            (a) => a.zoneId === zId && a.owner !== 'player' && countUnits(a.units) > 0
          );
        if (stillEnemy) {
          nextBattles[zId] = {
            zoneId: zId,
            round: roundNum,
            phase: 'ranged',
            timer: 0,
            lastSummary: `Round ${roundNum} : Ennemis -${enemyLosses} • Vos pertes -${playerLosses}`,
            intensity: Math.min(3, 1 + enemyLosses + playerLosses),
          };
        }
      }
    }
  }

  state.battles = nextBattles;
  return state;
}
