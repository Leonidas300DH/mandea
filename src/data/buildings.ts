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
      'Exploration moins chère (-1 ⚡ Commandement)',
      'Moral des Trois Ordres +4',
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
      treeCanopyAlt: '#f472b6',
      cropColor: '#65d643',
      fogFill: '#d9ccb0',
    },
  },
  summer: {
    id: 'summer',
    name: 'Été',
    emoji: '☀️',
    subtitle: 'Soleil Haut',
    farmMult: 1.35,
    livestockMult: 1.1,
    lumberMult: 1.1,
    winterHeating: false,
    armySpeedMult: 1.18,
    summaryEffects: [
      'Blés hauts : Fermes +35 %',
      'Vitesse des armées +18 % sur la carte',
      'Bonne saison pour étendre vos routes',
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
      'Grandes Moissons : Fermes +65 % + bonus de Vivres !',
      'Dernière saison pour stocker du Bois avant l’Hiver',
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
    subtitle: 'Gel & Chauffage',
    farmMult: 0.2,
    livestockMult: 0.95,
    lumberMult: 0.85,
    winterHeating: true,
    armySpeedMult: 0.72,
    summaryEffects: [
      'Gel : Fermes -80 % (mais les Élevages continuent de produire !)',
      'Chauffage : la Cité consomme du Bois (gardez un Camp de Bûcherons !)',
      'Armées ralenties hors des Routes empierrées',
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
  {
    name: string;
    emoji: string;
    mapHint: string;
    allowedResource: ResourceBuildingType | null;
    description: string;
  }
> = {
  capital: {
    name: 'Cité Royale',
    emoji: '🏰',
    mapHint: 'Capitale',
    allowedResource: null,
    description: 'Cœur de votre royaume : agrandissez la Cité pour gagner plus de Commandement et d’Impôts.',
  },
  plains: {
    name: 'Plaines Fertiles',
    emoji: '🌾',
    mapHint: '🌾 Donne des Vivres',
    allowedResource: 'farm',
    description: 'Construisez une Ferme ici pour produire beaucoup de 🌾 Vivres (sensible au gel en Hiver).',
  },
  pasture: {
    name: 'Pâturages',
    emoji: '🐄',
    mapHint: '🐄 Vivres (même l’Hiver)',
    allowedResource: 'livestock',
    description: 'Construisez un Élevage ici : produit des 🌾 Vivres toute l’année, même en plein Hiver !',
  },
  forest: {
    name: 'Forêt',
    emoji: '🌲',
    mapHint: '🪵 Donne du Bois',
    allowedResource: 'lumber',
    description: 'Construisez un Camp de Bûcherons ici pour produire le 🪵 Bois de construction et de chauffage.',
  },
  hills: {
    name: 'Collines Dorées',
    emoji: '⛰️',
    mapHint: '💰 Donne de l’Or',
    allowedResource: 'mine',
    description: 'Construisez une Mine d’Or ici pour financer vos Soldats et vos Héros !',
  },
  marsh: {
    name: 'Vallons Humides',
    emoji: '🌿',
    mapHint: '🐄 Pâturage rustique',
    allowedResource: 'livestock',
    description: 'Prairies humides adaptées aux Élevages rustiques produisant des 🌾 Vivres.',
  },
  ruins: {
    name: 'Terres Anciennes',
    emoji: '🏛️',
    mapHint: '💰 Or & Donjons',
    allowedResource: 'mine',
    description: 'Vestiges anciens riches en filons d’💰 Or et abritant souvent un Donjon à explorer.',
  },
  water: {
    name: 'Mer',
    emoji: '🌊',
    mapHint: '',
    allowedResource: null,
    description: 'Eaux côtières bordant Mandea.',
  },
};

export interface ResourceBuildingConfig {
  type: ResourceBuildingType;
  name: string;
  emoji: string;
  producesLabel: string;
  description: string;
  baseCost: { intendance: number; wood: number };
  outputPerLevel: { food?: number; wood?: number; gold?: number };
}

export const RESOURCE_BUILDINGS: Record<ResourceBuildingType, ResourceBuildingConfig> = {
  farm: {
    type: 'farm',
    name: 'Ferme & Moulin',
    emoji: '🌾',
    producesLabel: '+8 🌾 Vivres/s',
    description: 'Produit abondamment des Vivres du Printemps à l’Automne (gèle en Hiver).',
    baseCost: { intendance: 8, wood: 15 },
    outputPerLevel: { food: 8.0 },
  },
  livestock: {
    type: 'livestock',
    name: 'Élevage & Grange',
    emoji: '🐄',
    producesLabel: '+5.5 🌾 Vivres/s (même l’Hiver)',
    description: 'Troupeaux nourrissant votre population même pendant le gel de l’Hiver !',
    baseCost: { intendance: 8, wood: 16 },
    outputPerLevel: { food: 5.5, gold: 0.6 },
  },
  lumber: {
    type: 'lumber',
    name: 'Camp de Bûcherons',
    emoji: '🪵',
    producesLabel: '+6.5 🪵 Bois/s',
    description: 'Coupe du Bois pour construire vos bâtiments et chauffer la Cité en Hiver.',
    // Zero wood cost at Level 1 (just like After Inc!) so you can NEVER get soft-locked out of Wood!
    baseCost: { intendance: 8, wood: 0 },
    outputPerLevel: { wood: 6.5 },
  },
  mine: {
    type: 'mine',
    name: 'Mine d’Or',
    emoji: '💰',
    producesLabel: '+5.5 💰 Or/s',
    description: 'Extrait de l’Or pur chaque seconde pour recruter et entretenir vos Armées & Héros.',
    baseCost: { intendance: 9, wood: 18 },
    outputPerLevel: { gold: 5.5 },
  },
  grove: {
    type: 'grove',
    name: 'Bosquet Sylvestre',
    emoji: '🌳',
    producesLabel: '+4.5 🪵 Bois/s & +4 🌾 Vivres/s',
    description: 'Spécialité elfique produisant à la fois du Bois et des Vivres toute l’année.',
    baseCost: { intendance: 8, wood: 10 },
    outputPerLevel: { wood: 4.5, food: 4.0 },
  },
};

export interface CivicBuildingConfig {
  id: CivicBuildingId;
  name: string;
  emoji: string;
  cost: { intendance: number; wood: number };
  estateImpact: Partial<Record<EstateId, number>>;
  benefitTag: string;
  description: string;
}

export const CIVIC_BUILDINGS: Record<CivicBuildingId, CivicBuildingConfig> = {
  wells: {
    id: 'wells',
    name: 'Puits & Hameau',
    emoji: '🚰',
    cost: { intendance: 7, wood: 14 },
    estateImpact: { peuple: 6 },
    benefitTag: '+18 Hab. • +6 Peuple',
    description: 'Améliore les conditions de vie locales : loge plus d’habitants et ravit le Peuple.',
  },
  market: {
    id: 'market',
    name: 'Relais Marchand',
    emoji: '⛺',
    cost: { intendance: 8, wood: 16 },
    estateImpact: { peuple: 4, noblesse: 2 },
    benefitTag: '+3 💰 Or/s • +4 Peuple',
    description: 'Échoppes commerciales rapportant +3 Or/s (encore plus avec une Route !).',
  },
  chapel: {
    id: 'chapel',
    name: 'Chapelle',
    emoji: '⛪',
    cost: { intendance: 8, wood: 16 },
    estateImpact: { clerge: 8, peuple: 2 },
    benefitTag: '+8 Clergé • Soin troupes',
    description: 'Sanctuaire local qui satisfait le Clergé et soigne vos héros de passage.',
  },
  fort: {
    id: 'fort',
    name: 'Fortin de Garde',
    emoji: '🛡️',
    cost: { intendance: 9, wood: 20 },
    estateImpact: { noblesse: 7, peuple: 3 },
    benefitTag: 'Anti-Pillage • +7 Noblesse',
    description: 'Protège la province contre les Pillards, éclaire les alentours et plaît à la Noblesse.',
  },
};

export const ROAD_UPGRADES: Record<
  1 | 2,
  {
    level: RoadLevel;
    name: string;
    emoji: string;
    cost: { intendance: number; wood: number };
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
    cost: { intendance: 6, wood: 12 },
    speedBonus: 1.45,
    prodBonus: 0.15,
    peupleBonus: 4,
    description: 'Armées +45 % plus rapides, production locale +15 %, Peuple content.',
  },
  2: {
    level: 2,
    name: 'Grande Chaussée Pavée',
    emoji: '🛣️',
    cost: { intendance: 9, wood: 20 },
    speedBonus: 1.9,
    prodBonus: 0.3,
    peupleBonus: 7,
    description: 'Armées +90 % plus rapides (même en Hiver !), production locale +30 %.',
  },
};

export const CITY_TIER_NAMES: Record<number, string> = {
  1: 'Bourgade (Niv. 1)',
  2: 'Ville Franche (Niv. 2)',
  3: 'Cité Comtale (Niv. 3)',
  4: 'Capitale Royale (Niv. 4)',
  5: 'Métropole Légendaire (Niv. 5)',
};

export interface CapitalBuildingConfig {
  id: CapitalBuildingId;
  name: string;
  emoji: string;
  maxLevel: number;
  baseCost: { intendance: number; wood: number };
  estateImpactPerLevel: Partial<Record<EstateId, number>>;
  benefitTag: string;
  description: string;
}

export const CAPITAL_BUILDINGS: Record<CapitalBuildingId, CapitalBuildingConfig> = {
  palace: {
    id: 'palace',
    name: 'Agrandir la Cité',
    emoji: '🏰',
    maxLevel: 5,
    baseCost: { intendance: 12, wood: 24 },
    estateImpactPerLevel: { peuple: 4, noblesse: 4 },
    benefitTag: '+Commandement/s • +30 Hab. • +Impôts',
    description: 'Comme dans After Inc : fait grandir votre Cité pour générer plus de ⚡ Commandement et d’💰 Or !',
  },
  barracks: {
    id: 'barracks',
    name: 'Caserne & Armurerie',
    emoji: '⚔️',
    maxLevel: 3,
    baseCost: { intendance: 10, wood: 22 },
    estateImpactPerLevel: { noblesse: 5 },
    benefitTag: 'Débloque Arbalétriers • +12% ATQ',
    description: 'Débloque les Arbalétriers perce-armure et augmente la puissance de toutes vos troupes.',
  },
  noble_court: {
    id: 'noble_court',
    name: 'Cour & Écuries Nobles',
    emoji: '⚜️',
    maxLevel: 3,
    baseCost: { intendance: 11, wood: 24 },
    estateImpactPerLevel: { noblesse: 12 },
    benefitTag: 'Débloque Chevaliers • +12 Noblesse',
    description: 'Débloque votre Cavalerie lourde et assure la loyauté de la Noblesse.',
  },
  cathedral: {
    id: 'cathedral',
    name: 'Église & Cathédrale',
    emoji: '⛪',
    maxLevel: 3,
    baseCost: { intendance: 11, wood: 24 },
    estateImpactPerLevel: { clerge: 13, peuple: 3 },
    benefitTag: '+13 Clergé • +Autorité',
    description: 'Ravit le Clergé, renforce votre Autorité Royale et accélère la guérison des Héros.',
  },
  grand_market: {
    id: 'grand_market',
    name: 'Grand Marché Royal',
    emoji: '💰',
    maxLevel: 3,
    baseCost: { intendance: 10, wood: 20 },
    estateImpactPerLevel: { peuple: 7, noblesse: 2 },
    benefitTag: '+5 💰 Or/s • +7 Peuple',
    description: 'Génère +5 Or/s par niveau et améliore le niveau de vie en ville.',
  },
  menagerie: {
    id: 'menagerie',
    name: 'Sanctuaire Fantastique',
    emoji: '🐉',
    maxLevel: 3,
    baseCost: { intendance: 14, wood: 30 },
    estateImpactPerLevel: { clerge: 6, noblesse: 6 },
    benefitTag: 'Débloque Unités Fantastiques',
    description: 'Débloque vos 2 Unités Fantastiques raciales (Griffons, Mages, Tréants, Golems, Trolls...).',
  },
  walls: {
    id: 'walls',
    name: 'Remparts & Citadelle',
    emoji: '🧱',
    maxLevel: 3,
    baseCost: { intendance: 10, wood: 24 },
    estateImpactPerLevel: { peuple: 6, noblesse: 5 },
    benefitTag: '+Défense Capitale • +6 Peuple',
    description: 'Renforce les murailles de votre Capitale et rassure les habitants.',
  },
};
