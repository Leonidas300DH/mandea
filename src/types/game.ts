export type RaceId = 'humans' | 'elves' | 'dwarves' | 'orcs';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type GameSpeed = 0 | 0.5 | 1 | 2 | 4;

export type BiomeType =
  | 'capital'
  | 'plains'
  | 'pasture'
  | 'forest'
  | 'hills'
  | 'marsh'
  | 'ruins'
  | 'water';

export type ZoneStatus = 'unexplored' | 'explored' | 'claimed' | 'seceded';

export type EstateId = 'peuple' | 'noblesse' | 'clerge';

export type TaxLevel = 'exempt' | 'low' | 'normal' | 'high';

export type RoadLevel = 0 | 1 | 2;

export type ResourceBuildingType = 'farm' | 'livestock' | 'lumber' | 'mine' | 'grove';

export type CivicBuildingId =
  | 'wells'       // Puits & Hameau salubre (Peuple + Croissance)
  | 'market'      // Marché & Relais (Or + Peuple)
  | 'chapel'      // Chapelle / Sanctuaire rural (Clergé + Soin)
  | 'manor'       // Manoir féodal (Noblesse + Garnison)
  | 'watchtower'  // Tour de guet (Vision + Tir défensif)
  | 'fort';       // Fortin / Palissade (Muraille locale anti-pillage)

export type CapitalBuildingId =
  | 'palace'       // Palais / Donjon Central (Intendance + Capacité)
  | 'grand_market' // Grand Quartier Marchand (Or + Peuple)
  | 'cathedral'    // Église -> Cathédrale / Grand Sanctuaire (Clergé + Bénédictions)
  | 'noble_court'  // Cour des Nobles (Noblesse + Commandement)
  | 'barracks'     // Caserne & Forge (Recrutement militaire)
  | 'menagerie'    // Sanctuaire Fantastique / Tour Arcanique (Unités fantastiques)
  | 'tavern'       // Taverne des Héros (Recrutement de Héros)
  | 'walls';       // Fortifications (Palissade -> Murailles -> Citadelle)

export type UnitRole =
  | 'militia'
  | 'infantry'
  | 'archer'
  | 'crossbow'
  | 'cavalry'
  | 'fantasy';

export interface Point {
  x: number;
  y: number;
}

export interface Resources {
  intendance: number;
  maxIntendance: number;
  food: number;
  wood: number;
  iron: number;
  gold: number;
  population: number;
  maxPopulation: number;
}

export interface ResourceRates {
  intendance: number;
  food: number;
  wood: number;
  iron: number;
  gold: number;
}

export interface UnitDefinition {
  id: string;
  race: RaceId | 'enemy';
  name: string;
  role: UnitRole;
  hp: number;
  meleeAtk: number;
  rangedAtk: number;
  armorPierce: number;
  defense: number;
  speed: number; // Map movement speed base
  cost: {
    food: number;
    wood: number;
    iron: number;
    gold: number;
    intendance?: number;
  };
  upkeepGold: number;
  upkeepFood: number;
  requiresBuilding?: CapitalBuildingId;
  requiresPastureOrSpecial?: boolean;
  pixelColor: string;
  accentColor: string;
  portrait?: string;
  badgeEmoji: string;
  description: string;
}

export interface Relic {
  id: string;
  name: string;
  description: string;
  atkBonus: number;
  defBonus: number;
  dungeonBonus: number;
  icon: string;
}

export interface Hero {
  id: string;
  name: string;
  title: string;
  race: RaceId;
  archetype: 'paladin' | 'ranger' | 'mage' | 'slayer';
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  armyAtkAura: number; // e.g., 0.15 = +15% army attack
  armyDefAura: number; // e.g., 0.15 = +15% army defense
  dungeonPower: number;
  status: 'idle' | 'army' | 'dungeon' | 'recovering';
  assignedId: string | null; // armyId or zoneId (dungeon)
  relics: Relic[];
  portrait: string;
  lore: string;
}

export interface DungeonOption {
  id: string;
  label: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  outcomeType: 'treasure' | 'purify' | 'relic' | 'retreat';
}

export interface DungeonChoiceEvent {
  title: string;
  description: string;
  stage: number;
  options: DungeonOption[];
}

export interface DungeonSite {
  id: string;
  name: string;
  theme: 'crypt' | 'tower' | 'mine' | 'shrine' | 'rift';
  stars: 1 | 2 | 3;
  cleared: boolean;
  corrupted: boolean; // Hurts Clergé satisfaction until cleared!
  activeHeroId: string | null;
  progress: number; // 0..100 for current stage
  stage: number;    // 1..maxStages
  maxStages: number;
  pendingEvent: DungeonChoiceEvent | null;
}

export interface StaticMonster {
  id: string;
  name: string;
  kind: 'wyvern' | 'troll' | 'spider_queen' | 'stone_titan' | 'specter';
  units: Record<string, number>;
  rewardGold: number;
  rewardIron: number;
  description: string;
}

export interface RiverSegment {
  points: Point[];
}

export interface Zone {
  id: string;
  name: string;
  biome: BiomeType;
  polygon: Point[];
  smoothPath: string;
  center: Point;
  neighbors: string[];
  isCoastal: boolean;
  decorSeed: number;
  status: ZoneStatus;
  exploreProgress: number; // 0 or 100
  roadLevel: RoadLevel;
  resourceBuilding: {
    type: ResourceBuildingType;
    level: 1 | 2 | 3;
  } | null;
  civicBuildings: CivicBuildingId[];
  capitalBuildings: Record<CapitalBuildingId, number>;
  fortHp: number;
  maxFortHp: number;
  pillagedTimer: number; // > 0 when burned/raided
  dungeon: DungeonSite | null;
  staticMonster: StaticMonster | null;
}

export type ArmyOwner =
  | 'player'
  | 'raiders'
  | 'rebel_peasants'
  | 'secession_nobles'
  | 'schism_zealots'
  | 'invasion';

export interface Army {
  id: string;
  name: string;
  owner: ArmyOwner;
  race: RaceId | 'enemy';
  zoneId: string;
  path: string[];
  moveProgress: number; // 0..1 toward path[0]
  units: Record<string, number>;
  heroId: string | null;
  aiIntent?: 'pillage' | 'siege_capital' | 'hold' | 'corrupt';
}

export interface BattleState {
  zoneId: string;
  round: number;
  phase: 'ranged' | 'melee';
  timer: number;
  lastSummary: string;
  intensity: number;
}

export interface EstateState {
  id: EstateId;
  satisfaction: number;       // 0..100
  targetSatisfaction: number; // Equilibrium target
  taxLevel: TaxLevel;
  inDisgrace: boolean;        // < 20
  crisisTimer: number;        // Spawns rebel/secession/schism events periodically
  factors: { label: string; delta: number }[];
}

export interface LogEntry {
  id: string;
  year: number;
  season: Season;
  type: 'info' | 'warning' | 'danger' | 'success' | 'epic';
  text: string;
}

export interface GameState {
  started: boolean;
  gameOver: boolean;
  gameOverReason: string | null;
  seed: number;
  race: RaceId;
  kingdomName: string;
  year: number;
  season: Season;
  seasonProgress: number; // 0..100
  totalTicks: number;
  speed: GameSpeed;
  capitalZoneId: string;
  resources: Resources;
  rates: ResourceRates;
  authority: number; // 0..100
  authorityDelta: number;
  festivitiesTimer: number; // > 0 means active celebration
  concessionsCount: number; // Permanent +15% upkeep/consumption each
  pendingAuthorityCrisis: boolean;
  estates: Record<EstateId, EstateState>;
  zones: Record<string, Zone>;
  zoneOrder: string[];
  rivers: RiverSegment[];
  armies: Record<string, Army>;
  heroes: Record<string, Hero>;
  tavernPool: Hero[];
  battles: Record<string, BattleState>;
  logs: LogEntry[];
  invasionTimer: number;     // Countdown to next major rival army wave
  invasionWarningZoneId: string | null; // Red sonar pulse in fog!
}
