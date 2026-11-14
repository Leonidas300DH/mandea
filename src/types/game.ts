export type RaceId = 'humans' | 'elves' | 'dwarves' | 'orcs';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type GameSpeed = 0 | 0.5 | 1 | 2 | 4;

export type DifficultyPace = 'peaceful' | 'normal' | 'intense';

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
  | 'wells'   // Puits & Hameau (Conditions de vie : +Hab, +Peuple)
  | 'market'  // Relais Marchand (+Or/s, +Peuple)
  | 'chapel'  // Chapelle / Sanctuaire (+Clergé, Soin local)
  | 'fort';   // Fortin & Guet (Bloque pillards, tir défensif, vision, +Noblesse)

export type CapitalBuildingId =
  | 'palace'       // Niveau de la Cité (Niv. 1 -> 5 : +Commandement/s, +Habitants, +Impôts)
  | 'grand_market' // Grand Marché (+Or/s, +Peuple)
  | 'cathedral'    // Église & Cathédrale (+Clergé, +Autorité)
  | 'noble_court'  // Cour & Écuries Nobles (+Noblesse, débloque Cavalerie/Chevaliers)
  | 'barracks'     // Caserne & Forge (Débloque Arbalétriers, +15% ATQ armée)
  | 'menagerie'    // Sanctuaire Fantastique (Débloque les 2 Unités Fantastiques)
  | 'walls';       // Remparts de la Cité (+PV Capitale, +Peuple & Noblesse)

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

/**
 * Streamlined After Inc-inspired resources:
 * - `intendance` (⚡ Commandement / Stamina): regenerates automatically, used for exploring, claiming, building & repairing!
 * - `food` (🌾 Vivres): from Plaines (Ferme) & Pâturages (Élevage), feeds population & troops.
 * - `wood` (🪵 Bois): from Forêts (Camp de bûcherons), builds structures & heats homes in Winter.
 * - `gold` (💰 Or): from Impôts, Collines (Mine d'Or) & Donjons, recruits Soldiers & Heroes!
 */
export interface Resources {
  intendance: number;
  maxIntendance: number;
  food: number;
  wood: number;
  gold: number;
  population: number;
  maxPopulation: number;
}

export interface ResourceRates {
  intendance: number;
  food: number;
  wood: number;
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
  speed: number;
  goldCost: number;
  upkeepGold: number;
  upkeepFood: number;
  requiresBuilding?: CapitalBuildingId;
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
  armyAtkAura: number;
  armyDefAura: number;
  dungeonPower: number;
  status: 'idle' | 'army' | 'dungeon' | 'recovering';
  assignedId: string | null;
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
  corrupted: boolean;
  activeHeroId: string | null;
  progress: number;
  stage: number;
  maxStages: number;
  pendingEvent: DungeonChoiceEvent | null;
}

export interface StaticMonster {
  id: string;
  name: string;
  kind: 'wyvern' | 'troll' | 'spider_queen' | 'stone_titan' | 'specter';
  units: Record<string, number>;
  rewardGold: number;
  rewardWood: number;
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
  exploreProgress: number;
  roadLevel: RoadLevel;
  resourceBuilding: {
    type: ResourceBuildingType;
    level: 1 | 2 | 3;
  } | null;
  civicBuildings: CivicBuildingId[];
  capitalBuildings: Record<CapitalBuildingId, number>;
  fortHp: number;
  maxFortHp: number;
  pillagedTimer: number; // > 0 when pillaged/damaged -> can be repaired in 1 click!
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
  moveProgress: number;
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
  satisfaction: number;
  targetSatisfaction: number;
  taxLevel: TaxLevel;
  inDisgrace: boolean;
  crisisTimer: number;
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
  pace: DifficultyPace;
  kingdomName: string;
  year: number;
  season: Season;
  seasonProgress: number;
  totalTicks: number;
  speed: GameSpeed;
  goalChapter: number; // 1..4+ progressive After Inc-style goal chapters
  capitalZoneId: string;
  resources: Resources;
  rates: ResourceRates;
  authority: number;
  authorityDelta: number;
  festivitiesTimer: number;
  concessionsCount: number;
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
  raiderTimer: number;
  raiderWarningZoneId: string | null;
  invasionTimer: number;
  invasionWarningZoneId: string | null;
}
