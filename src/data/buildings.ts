import {
  BiomeType,
  CapitalBuildingId,
  CivicBuildingId,
  EstateId,
  ResourceBuildingType,
  RoadLevel,
  Season,
} from '../types/game';

export interface SeasonConfig {
  id: Season;
  name: string;
  emoji: string;
  subtitle: string;
  farmMult: number;
  livestockMult: number;
  lumberMult: number;
  winterHeating: boolean;
  armySpeedMult: number;
  summaryEffects: string[];
  palette: {
    waterDeep: string;
    waterShallow: string;
    plainsFill: string;
    pastureFill: string;
    forestFill: string;
    hillsFill: string;
    marshFill: string;
    ruinsFill: string;
    capitalFill: string;
    treeCanopy: string;
    treeCanopyAlt: string;
    cropColor: string;
    fogFill: string;
  };
}

export const SEASONS: Record<Season, SeasonConfig> = {
  spring: {
    id: 'spring',
    name: 'Printemps',
    emoji: '🌱',
    subtitle: 'Dégel & Semences',
    farmMult: 1.15,
    livestockMult: 1.1,
    lumberMult: 1.05,
    winterHeating: false,
    armySpeedMult: 1.05,
    summaryEffects: [
      'Fermes +15 % • Élevages +10 %',
      'Coût d’exploration réduit (-15 % Intendance)',
      'Moral des Trois Ordres +4 (Renouveau)',
    ],
    palette: {
      waterDeep: '#2b6cb0',
      waterShallow: '#4fd1c5',
      plainsFill: '#8de068',
      pastureFill: '#a6eb78',
      forestFill: '#3ca355',
      hillsFill: '#9cb380',
      marshFill: '#5da683',
      ruinsFill: '#96b888',
      capitalFill: '#9ce673',
      treeCanopy: '#228b3b',
      treeCanopyAlt: '#f472b6', // Fleurs de printemps !
      cropColor: '#65d643',
      fogFill: '#d9ccb0',
    },
  },
  summer: {
    id: 'summer',
    name: 'Été',
    emoji: '☀️',
    subtitle: 'Soleil Haut & Raids',
    farmMult: 1.35,
    livestockMult: 1.1,
    lumberMult: 1.1,
    winterHeating: false,
    armySpeedMult: 1.18,
    summaryEffects: [
      'Blés hauts : Fermes +35 %',
      'Vitesse des armées +18 % sur la carte',
      'Saison propice aux raids de Pillards',
    ],
    palette: {
      waterDeep: '#1e6091',
      waterShallow: '#38bdf8',
      plainsFill: '#a3d95b',
      pastureFill: '#84cc16',
      forestFill: '#2f8540',
      hillsFill: '#a8a878',
      marshFill: '#4d9078',
      ruinsFill: '#9aa87c',
      capitalFill: '#b5e368',
      treeCanopy: '#1b6e2d',
      treeCanopyAlt: '#4ade80',
      cropColor: '#facc15',
      fogFill: '#decfa8',
    },
  },
  autumn: {
    id: 'autumn',
    name: 'Automne',
    emoji: '🍂',
    subtitle: 'Grandes Moissons',
    farmMult: 1.65,
    livestockMult: 1.05,
    lumberMult: 1.15,
    winterHeating: false,
    armySpeedMult: 1.0,
    summaryEffects: [
      'Grandes Moissons : Fermes +65 % !',
      'Commerce florissant (+15 % revenus des Marchés)',
      'Dernière saison pour stocker Bois & Vivres avant le gel',
    ],
    palette: {
      waterDeep: '#234e70',
      waterShallow: '#4ea8de',
      plainsFill: '#d8b85a',
      pastureFill: '#b8be62',
      forestFill: '#9c6b3b',
      hillsFill: '#a39374',
      marshFill: '#6b856b',
      ruinsFill: '#a69878',
      capitalFill: '#dec468',
      treeCanopy: '#d97706',
      treeCanopyAlt: '#dc2626',
      cropColor: '#f59e0b',
      fogFill: '#d6c39e',
    },
  },
  winter: {
    id: 'winter',
    name: 'Hiver',
    emoji: '❄️',
    subtitle: 'Grand Gel & Foyer',
    farmMult: 0.2,
    livestockMult: 0.9,
    lumberMult: 0.8,
    winterHeating: true,
    armySpeedMult: 0.68,
    summaryEffects: [
      'Terres gelées : Fermes -80 % (les Élevages résistent !)',
      'Chauffage requis : consomme du Bois (sinon colère du Peuple)',
      'Armées ralenties (-32 %) hors des Routes empierrées',
    ],
    palette: {
      waterDeep: '#335c81',
      waterShallow: '#93c5fd',
      plainsFill: '#e8f1f8',
      pastureFill: '#dbeafe',
      forestFill: '#9cc2c9',
      hillsFill: '#cbd5e1',
      marshFill: '#b6d0d9',
      ruinsFill: '#d1dce5',
      capitalFill: '#eef6fc',
      treeCanopy: '#336b5b',
      treeCanopyAlt: '#f8fafc',
      cropColor: '#cbd5e1',
      fogFill: '#cad5e2',
    },
  },
};

export const BIOME_INFO: Record<
  BiomeType,
  { name: string; emoji: string; allowedResource: ResourceBuildingType | null; description: string }
> = {
  capital: {
    name: 'Terres de la Couronne',
    emoji: '🏰',
    allowedResource: null,
    description: 'Cœur rayonnant de votre cité, protégé par vos enceintes et nourri par les provinces.',
  },
  plains: {
    name: 'Plaines Fertiles',
    emoji: '🌾',
    allowedResource: 'farm',
    description: 'Terres riches idéales pour les grandes Fermes céréalières et moulins.',
  },
  pasture: {
    name: 'Vallons & Pâturages',
    emoji: '🐄',
    allowedResource: 'livestock',
    description: 'Prairies verdoyantes propices aux Élevages (nourrissent même en plein Hiver !).',
  },
  forest: {
    name: 'Forêt Ancienne',
    emoji: '🌲',
    allowedResource: 'lumber',
    description: 'Futaies denses fournissant le Bois de construction et le chauffage d’hiver.',
  },
  hills: {
    name: 'Collines Rocheuses',
    emoji: '⛰️',
    allowedResource: 'mine',
    description: 'Veines de Fer et de Pierre indispensables aux armures et fortifications.',
  },
  marsh: {
    name: 'Landes & Marais',
    emoji: '🌿',
    allowedResource: 'livestock',
    description: 'Terres brumeuses abritant tourbières, pâtures rustiques et parfois d’antiques vestiges.',
  },
  ruins: {
    name: 'Terres Anciennes',
    emoji: '🏛️',
    allowedResource: 'mine',
    description: 'Vestiges du premier âge recelant pierres taillées, reliques et profonds Donjons.',
  },
  water: {
    name: 'Eaux Côtières',
    emoji: '🌊',
    allowedResource: null,
    description: 'Mers bordant le continent de Mandea.',
  },
};

export interface ResourceBuildingConfig {
  type: ResourceBuildingType;
  name: string;
  emoji: string;
  description: string;
  baseCost: { wood: number; iron: number; gold: number; intendance: number };
  outputPerLevel: { food?: number; wood?: number; iron?: number; gold?: number };
}

export const RESOURCE_BUILDINGS: Record<ResourceBuildingType, ResourceBuildingConfig> = {
  farm: {
    type: 'farm',
    name: 'Ferme & Moulin',
    emoji: '🌾',
    description: 'Champs cultivés et moulin à vent visibles sur la province. Sensible à l’hiver.',
    baseCost: { wood: 22, iron: 0, gold: 15, intendance: 14 },
    outputPerLevel: { food: 7.5 },
  },
  livestock: {
    type: 'livestock',
    name: 'Élevage & Enclos',
    emoji: '🐄',
    description: 'Granges et troupeaux produisant des Vivres réguliers même durant l’Hiver.',
    baseCost: { wood: 26, iron: 0, gold: 22, intendance: 15 },
    outputPerLevel: { food: 5.0, gold: 0.8 },
  },
  lumber: {
    type: 'lumber',
    name: 'Camp de Bûcherons',
    emoji: '🪵',
    description: 'Cabanes forestières et scierie alimentant le royaume en Bois.',
    baseCost: { wood: 14, iron: 0, gold: 15, intendance: 14 },
    outputPerLevel: { wood: 6.2 },
  },
  mine: {
    type: 'mine',
    name: 'Mine de Fer & Carrière',
    emoji: '⛏️',
    description: 'Galeries d’extraction fournissant Fer et Pierre pour vos forges et remparts.',
    baseCost: { wood: 28, iron: 0, gold: 26, intendance: 16 },
    outputPerLevel: { iron: 4.5, gold: 1.0 },
  },
  grove: {
    type: 'grove',
    name: 'Sanctuaire Sylvestre',
    emoji: '🌳',
    description: 'Exploitation harmonieuse de la forêt mêlant bois et cueillette.',
    baseCost: { wood: 18, iron: 0, gold: 20, intendance: 15 },
    outputPerLevel: { wood: 4.5, food: 3.5 },
  },
};

export interface CivicBuildingConfig {
  id: CivicBuildingId;
  name: string;
  emoji: string;
  category: 'living' | 'estates' | 'defense';
  cost: { wood: number; iron: number; gold: number; intendance: number };
  estateImpact: Partial<Record<EstateId, number>>;
  description: string;
}

export const CIVIC_BUILDINGS: Record<CivicBuildingId, CivicBuildingConfig> = {
  wells: {
    id: 'wells',
    name: 'Puits & Hameau Salubre',
    emoji: '🚰',
    category: 'living',
    cost: { wood: 18, iron: 4, gold: 18, intendance: 10 },
    estateImpact: { peuple: 5 },
    description: 'Améliore les conditions de vie locales (+15 hab. max, +5 Satisfaction Peuple).',
  },
  market: {
    id: 'market',
    name: 'Marché & Relais',
    emoji: '⛺',
    category: 'living',
    cost: { wood: 22, iron: 4, gold: 25, intendance: 12 },
    estateImpact: { peuple: 4, noblesse: 2 },
    description: 'Échoppes colorées générant +2.4 Or/s (encore plus si relié par Route !).',
  },
  chapel: {
    id: 'chapel',
    name: 'Chapelle / Sanctuaire',
    emoji: '⛪',
    category: 'estates',
    cost: { wood: 20, iron: 8, gold: 26, intendance: 12 },
    estateImpact: { clerge: 7, peuple: 2 },
    description: 'Rayonnement spirituel (+7 Satisfaction Clergé) et soin des armées sur place.',
  },
  manor: {
    id: 'manor',
    name: 'Manoir Seigneurial',
    emoji: '🏛️',
    category: 'estates',
    cost: { wood: 26, iron: 12, gold: 32, intendance: 13 },
    estateImpact: { noblesse: 7 },
    description: 'Fief noble (+7 Satisfaction Noblesse, +1.5 Or/s et petite garnison défensive).',
  },
  watchtower: {
    id: 'watchtower',
    name: 'Tour de Guet',
    emoji: '🗼',
    category: 'defense',
    cost: { wood: 24, iron: 8, gold: 18, intendance: 10 },
    estateImpact: { peuple: 2 },
    description: 'Révèle les zones adjacentes et crible de flèches pillards et envahisseurs.',
  },
  fort: {
    id: 'fort',
    name: 'Fortin de Marche',
    emoji: '🧱',
    category: 'defense',
    cost: { wood: 32, iron: 24, gold: 36, intendance: 16 },
    estateImpact: { noblesse: 4, peuple: 3 },
    description: 'Enceinte fortifiée locale qui bloque les pillards et protège vos troupes (+25 % déf).',
  },
};

export const ROAD_UPGRADES: Record<
  1 | 2,
  {
    level: RoadLevel;
    name: string;
    emoji: string;
    cost: { wood: number; iron: number; gold: number; intendance: number };
    speedBonus: number;
    prodBonus: number;
    peupleBonus: number;
    description: string;
  }
> = {
  1: {
    level: 1,
    name: 'Route Empierrée',
    emoji: '🛤️',
    cost: { wood: 14, iron: 6, gold: 16, intendance: 8 },
    speedBonus: 1.45,
    prodBonus: 0.12,
    peupleBonus: 3,
    description: 'Relie visuellement la province : vitesse armées +45 %, production +12 %, annule la boue.',
  },
  2: {
    level: 2,
    name: 'Grande Chaussée Pavée',
    emoji: '🛣️',
    cost: { wood: 18, iron: 16, gold: 32, intendance: 12 },
    speedBonus: 1.9,
    prodBonus: 0.25,
    peupleBonus: 6,
    description: 'Voie royale dallée : vitesse armées +90 % même en Hiver, production +25 %, Peuple ravi.',
  },
};

export interface CapitalBuildingConfig {
  id: CapitalBuildingId;
  name: string;
  emoji: string;
  maxLevel: number;
  baseCost: { wood: number; iron: number; gold: number; intendance: number };
  estateImpactPerLevel: Partial<Record<EstateId, number>>;
  description: string;
}

export const CAPITAL_BUILDINGS: Record<CapitalBuildingId, CapitalBuildingConfig> = {
  palace: {
    id: 'palace',
    name: 'Donjon & Palais Royal',
    emoji: '👑',
    maxLevel: 3,
    baseCost: { wood: 40, iron: 25, gold: 55, intendance: 20 },
    estateImpactPerLevel: { noblesse: 4, peuple: 3 },
    description: 'Augmente le plafond et la régénération d’Intendance ainsi que la capacité de la Capitale.',
  },
  grand_market: {
    id: 'grand_market',
    name: 'Halles & Quartier Marchand',
    emoji: '🪙',
    maxLevel: 3,
    baseCost: { wood: 32, iron: 10, gold: 40, intendance: 16 },
    estateImpactPerLevel: { peuple: 6, noblesse: 2 },
    description: 'Cœur économique générant d’importantes recettes d’Or (+5 Or/s par niveau) et ravissant le Peuple.',
  },
  cathedral: {
    id: 'cathedral',
    name: 'Église & Grande Cathédrale',
    emoji: '⛪',
    maxLevel: 3,
    baseCost: { wood: 34, iron: 22, gold: 48, intendance: 18 },
    estateImpactPerLevel: { clerge: 11, peuple: 3 },
    description: 'Pilier du Clergé (+11 Satisfaction Clergé/niv), bénit les Héros et stabilise l’Autorité.',
  },
  noble_court: {
    id: 'noble_court',
    name: 'Cour Seigneuriale & Lice',
    emoji: '⚜️',
    maxLevel: 3,
    baseCost: { wood: 30, iron: 20, gold: 48, intendance: 18 },
    estateImpactPerLevel: { noblesse: 10 },
    description: 'Débloque la Cavalerie lourde et assure la fidélité des grandes familles (+10 Noblesse/niv).',
  },
  barracks: {
    id: 'barracks',
    name: 'Grande Caserne & Forges',
    emoji: '⚔️',
    maxLevel: 3,
    baseCost: { wood: 32, iron: 22, gold: 38, intendance: 16 },
    estateImpactPerLevel: { noblesse: 4 },
    description: 'Débloque l’Infanterie lourde et les Arbalétriers, et renforce la garnison de la cité.',
  },
  menagerie: {
    id: 'menagerie',
    name: 'Tour Arcanique & Ménagerie',
    emoji: '🐉',
    maxLevel: 3,
    baseCost: { wood: 38, iron: 28, gold: 65, intendance: 22 },
    estateImpactPerLevel: { clerge: 5, noblesse: 5 },
    description: 'Débloque vos 2 Unités Fantastiques raciales (Griffons, Tréants, Golems, Trolls, Mages...).',
  },
  tavern: {
    id: 'tavern',
    name: 'Taverne & Guilde des Héros',
    emoji: '🍺',
    maxLevel: 3,
    baseCost: { wood: 28, iron: 8, gold: 36, intendance: 14 },
    estateImpactPerLevel: { peuple: 5 },
    description: 'Permet de recruter des Héros légendaires pour commander vos armées et explorer les Donjons.',
  },
  walls: {
    id: 'walls',
    name: 'Enceintes & Citadelle',
    emoji: '🏰',
    maxLevel: 3,
    baseCost: { wood: 36, iron: 32, gold: 45, intendance: 18 },
    estateImpactPerLevel: { peuple: 5, noblesse: 6 },
    description: 'Érige Palissade, Murailles de pierre puis Citadelle visibles autour de votre Capitale !',
  },
};
