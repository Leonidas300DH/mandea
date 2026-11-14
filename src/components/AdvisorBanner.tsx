import React, { useState } from 'react';
import { GameState } from '../types/game';

export interface AdvisorStep {
  stepNum?: number;
  totalSteps?: number;
  badge: string;
  title: string;
  description: string;
  targetZoneId: string | null;
  actionLabel?: string;
  tone?: 'guide' | 'warn' | 'epic';
}

export function computeAdvisorStep(state: GameState): AdvisorStep {
  const zones = Object.values(state.zones).filter((z) => z.biome !== 'water');
  const claimedProvinces = zones.filter(
    (z) => z.status === 'claimed' && z.biome !== 'capital'
  );

  // Urgent live alerts always take priority if a Dungeon choice or Raider attack happens!
  const pendingDungeonZone = zones.find((z) => Boolean(z.dungeon?.pendingEvent));
  if (pendingDungeonZone) {
    return {
      badge: '❗ Donjon',
      title: 'Décision d’expédition requise !',
      description: `Votre Héros attend vos ordres dans ${pendingDungeonZone.dungeon?.name}.`,
      targetZoneId: pendingDungeonZone.id,
      actionLabel: '🗝️ Ouvrir le Donjon',
      tone: 'epic',
    };
  }

  // Step 1: Claim first fertile land (Plains or Pasture)
  const hasFoodLand = claimedProvinces.some(
    (z) => z.biome === 'plains' || z.biome === 'pasture'
  );
  if (!hasFoodLand) {
    const candidate = zones.find(
      (z) =>
        z.status === 'explored' &&
        (z.biome === 'plains' || z.biome === 'pasture') &&
        !z.staticMonster &&
        z.neighbors.includes(state.capitalZoneId)
    );
    return {
      stepNum: 1,
      totalSteps: 6,
      badge: 'Étape 1 / 6',
      title: 'Agrandir le Royaume',
      description:
        'Cliquez sur une Plaine ou un Pâturage voisin de votre Capitale, puis cliquez sur « Annexer au Royaume ».',
      targetZoneId: candidate?.id ?? null,
      actionLabel: candidate ? '📍 Voir une Plaine' : undefined,
      tone: 'guide',
    };
  }

  // Step 2: Build first Farm or Livestock
  const hasFoodBuilding = claimedProvinces.some(
    (z) =>
      z.resourceBuilding?.type === 'farm' ||
      z.resourceBuilding?.type === 'livestock'
  );
  if (!hasFoodBuilding) {
    const target = claimedProvinces.find(
      (z) => (z.biome === 'plains' || z.biome === 'pasture') && !z.resourceBuilding
    );
    return {
      stepNum: 2,
      totalSteps: 6,
      badge: 'Étape 2 / 6',
      title: 'Nourrir la Population',
      description:
        'Sélectionnez votre province annexée et construisez une « Ferme & Moulin » (ou Élevage) pour produire des Vivres.',
      targetZoneId: target?.id ?? null,
      actionLabel: target ? '🌾 Aménager la province' : undefined,
      tone: 'guide',
    };
  }

  // Step 3: Claim Forest & Build Lumber Camp before Winter!
  const hasWoodBuilding = claimedProvinces.some(
    (z) =>
      z.resourceBuilding?.type === 'lumber' ||
      z.resourceBuilding?.type === 'grove'
  );
  if (!hasWoodBuilding) {
    const claimedForest = claimedProvinces.find(
      (z) => z.biome === 'forest' && !z.resourceBuilding
    );
    const wildForest = zones.find(
      (z) =>
        z.status === 'explored' &&
        z.biome === 'forest' &&
        !z.staticMonster &&
        z.neighbors.some((n) => state.zones[n]?.status === 'claimed')
    );
    const target = claimedForest ?? wildForest ?? null;
    return {
      stepNum: 3,
      totalSteps: 6,
      badge: 'Étape 3 / 6',
      title: 'Préparer le Bois avant l’Hiver',
      description: claimedForest
        ? 'Construisez un « Camp de Bûcherons » dans votre Forêt (vital pour le chauffage en Hiver !).'
        : 'Annexez une Forêt Ancienne voisine puis bâtissez un « Camp de Bûcherons ».',
      targetZoneId: target?.id ?? null,
      actionLabel: target ? '🌲 Voir la Forêt' : undefined,
      tone: 'guide',
    };
  }

  // Step 4: Build a Road or Civic Improvement
  const hasRoadOrCivic = claimedProvinces.some(
    (z) => z.roadLevel >= 1 || z.civicBuildings.length > 0
  );
  if (!hasRoadOrCivic) {
    const target = claimedProvinces[0] ?? null;
    return {
      stepNum: 4,
      totalSteps: 6,
      badge: 'Étape 4 / 6',
      title: 'Relier & Améliorer vos Terres',
      description:
        'Tracez une « Route Empierrée » (+vitesse d’armée, +récoltes) ou un « Puits & Hameau » (+Satisfaction du Peuple).',
      targetZoneId: target?.id ?? null,
      actionLabel: target ? '🛤️ Ouvrir une province' : undefined,
      tone: 'guide',
    };
  }

  // Step 5: Recruit additional soldiers in Capital
  const totalPlayerUnits = Object.values(state.armies)
    .filter((a) => a.owner === 'player')
    .reduce(
      (acc, a) => acc + Object.values(a.units).reduce((s, n) => s + n, 0),
      0
    );
  if (totalPlayerUnits <= 5) {
    return {
      stepNum: 5,
      totalSteps: 6,
      badge: 'Étape 5 / 6',
      title: 'Renforcer votre Armée',
      description:
        'Des Pillards menacent les campagnes ! Cliquez sur votre Capitale → onglet « Recruter » pour étoffer votre troupe.',
      targetZoneId: state.capitalZoneId,
      actionLabel: '🏰 Recruter à la Capitale',
      tone: 'guide',
    };
  }

  // Step 6: Send Hero to Dungeon or Explore
  const activeOrClearedDungeon = zones.some(
    (z) => z.dungeon && (z.dungeon.activeHeroId || z.dungeon.cleared)
  );
  if (!activeOrClearedDungeon) {
    const visibleDungeon = zones.find(
      (z) => z.status !== 'unexplored' && z.dungeon && !z.dungeon.cleared
    );
    const frontierZone = zones.find(
      (z) =>
        z.status === 'unexplored' &&
        z.neighbors.some((n) => state.zones[n]?.status !== 'unexplored')
    );
    const target = visibleDungeon ?? frontierZone ?? null;
    return {
      stepNum: 6,
      totalSteps: 6,
      badge: 'Étape 6 / 6',
      title: visibleDungeon
        ? 'Explorer un Donjon avec votre Héros'
        : 'Éclairer les Terres Brumeuses',
      description: visibleDungeon
        ? 'Cliquez sur la province du Donjon antique et envoyez votre Héros conquérir Or et Reliques !'
        : 'Cliquez sur une boussole 🧭 en lisière des brumes pour découvrir Donjons et Monstres.',
      targetZoneId: target?.id ?? null,
      actionLabel: visibleDungeon ? '🗝️ Voir le Donjon' : '🧭 Voir la frontière',
      tone: 'guide',
    };
  }

  // Dynamic Sandbox Advisor once onboarding is mastered!
  const enemyArmy = Object.values(state.armies).find((a) => a.owner !== 'player');
  if (enemyArmy) {
    return {
      badge: '⚔️ Alerte Militaire',
      title: `${enemyArmy.name} en mouvement !`,
      description:
        'Cliquez sur votre Chevalier sur la carte puis cliquez sur la province ennemie pour l’intercepter.',
      targetZoneId: enemyArmy.zoneId,
      actionLabel: '🎯 Localiser la menace',
      tone: 'warn',
    };
  }

  if (state.rates.food < 0) {
    return {
      badge: '🌾 Réserves',
      title: 'Solde de Vivres négatif',
      description:
        state.season === 'winter'
          ? 'L’Hiver gèle les fermes : vos Élevages continuent de produire en attendant le Printemps.'
          : 'Améliorez vos Fermes ou bâtissez un Élevage pour nourrir votre population croissante.',
      targetZoneId: claimedProvinces[0]?.id ?? state.capitalZoneId,
      tone: 'warn',
    };
  }

  return {
    badge: '👑 Règne Libre',
    title: 'Étendez la gloire de Mandea',
    description:
      'Maintenez le soutien d’au moins 2 Ordres sur 3, érigez votre Citadelle et repoussez les grandes invasions.',
    targetZoneId: null,
    tone: 'guide',
  };
}

export const AdvisorBanner: React.FC<{
  step: AdvisorStep;
  onFocusZone: (zoneId: string) => void;
  onOpenHelp: () => void;
}> = ({ step, onFocusZone, onOpenHelp }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="advisor-collapsed">
        <button
          type="button"
          className="advisor-expand-btn"
          onClick={() => setCollapsed(false)}
        >
          🧭 {step.badge} : {step.title}
        </button>
      </div>
    );
  }

  return (
    <section
      className={`advisor-card tone-${step.tone ?? 'guide'}`}
      aria-label="Objectif conseillé"
    >
      <div className="advisor-top">
        <span className="advisor-badge">{step.badge}</span>
        <div className="advisor-head-btns">
          <button
            type="button"
            className="advisor-link-btn"
            onClick={onOpenHelp}
            title="Ouvrir le guide illustré"
          >
            ❓ Comment jouer
          </button>
          <button
            type="button"
            className="advisor-min-btn"
            onClick={() => setCollapsed(true)}
            aria-label="Réduire le conseiller"
            title="Réduire"
          >
            −
          </button>
        </div>
      </div>

      <h3 className="advisor-title">{step.title}</h3>
      <p className="advisor-desc">{step.description}</p>

      {step.targetZoneId && step.actionLabel && (
        <button
          type="button"
          className="advisor-cta-btn"
          onClick={() => onFocusZone(step.targetZoneId!)}
        >
          {step.actionLabel}
        </button>
      )}
    </section>
  );
};
