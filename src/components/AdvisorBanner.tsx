import React, { useState } from 'react';
import {
  countUnits,
  evaluateCurrentGoals,
  getRepairCost,
  GoalItem,
} from '../engine/simulation';
import { GameState } from '../types/game';

export interface UrgentAlert {
  id: string;
  tone: 'repair' | 'danger' | 'epic' | 'winter';
  badge: string;
  text: string;
  buttonLabel: string;
  kind: 'repair_zone' | 'focus_zone' | 'open_dungeon' | 'open_estates';
  zoneId?: string;
}

export function computeUrgentAlert(state: GameState): UrgentAlert | null {
  // 1. Pending Dungeon choice
  const pendingDungeonZoneId = state.zoneOrder.find((id) =>
    Boolean(state.zones[id]?.dungeon?.pendingEvent)
  );
  if (pendingDungeonZoneId) {
    const z = state.zones[pendingDungeonZoneId];
    return {
      id: `dng_${pendingDungeonZoneId}`,
      tone: 'epic',
      badge: '🗝️ Donjon',
      text: `Votre Héros attend votre décision dans ${z.dungeon?.name} !`,
      buttonLabel: 'Choisir',
      kind: 'open_dungeon',
      zoneId: pendingDungeonZoneId,
    };
  }

  // 2. Pillaged province waiting for repair!
  const pillagedZoneId = state.zoneOrder.find(
    (id) =>
      state.zones[id]?.status === 'claimed' &&
      (state.zones[id]?.pillagedTimer ?? 0) > 0
  );
  if (pillagedZoneId) {
    const z = state.zones[pillagedZoneId];
    const repCost = getRepairCost();
    const canAfford = state.resources.intendance >= repCost;
    return {
      id: `rep_${pillagedZoneId}`,
      tone: 'repair',
      badge: '🔥 Zone pillée',
      text: `${z.name} est endommagée (production à l’arrêt).`,
      buttonLabel: canAfford ? `🔨 Réparer (⚡${repCost})` : `Voir (⚡${repCost})`,
      kind: canAfford ? 'repair_zone' : 'focus_zone',
      zoneId: pillagedZoneId,
    };
  }

  // 3. Active hostile army on the map
  const hostileArmy = Object.values(state.armies).find(
    (a) => a.owner !== 'player' && countUnits(a.units) > 0
  );
  if (hostileArmy) {
    const zName = state.zones[hostileArmy.zoneId]?.name ?? 'la frontière';
    return {
      id: `foe_${hostileArmy.id}`,
      tone: 'danger',
      badge: '⚔️ Alerte',
      text: `${hostileArmy.name} repérée à ${zName} !`,
      buttonLabel: '🎯 Voir',
      kind: 'focus_zone',
      zoneId: hostileArmy.zoneId,
    };
  }

  // 4. Advance Invasion or Raider warning
  if (state.invasionWarningZoneId && state.zones[state.invasionWarningZoneId]) {
    const zName = state.zones[state.invasionWarningZoneId].name;
    return {
      id: `inv_${state.invasionWarningZoneId}`,
      tone: 'danger',
      badge: '📯 Invasion',
      text: `Une armée ennemie approche vers ${zName} !`,
      buttonLabel: '📍 Voir',
      kind: 'focus_zone',
      zoneId: state.invasionWarningZoneId,
    };
  }

  if (state.raiderWarningZoneId && state.zones[state.raiderWarningZoneId]) {
    const zName = state.zones[state.raiderWarningZoneId].name;
    return {
      id: `raid_${state.raiderWarningZoneId}`,
      tone: 'repair',
      badge: '⚠️ Éclaireurs',
      text: `Des Pillards rôdent près de ${zName} (raid imminent).`,
      buttonLabel: '📍 Voir',
      kind: 'focus_zone',
      zoneId: state.raiderWarningZoneId,
    };
  }

  // 5. Estate in disgrace
  const disgraceCount = (['peuple', 'noblesse', 'clerge'] as const).filter(
    (k) => state.estates[k].inDisgrace
  ).length;
  if (disgraceCount > 0) {
    return {
      id: `disgrace_${disgraceCount}`,
      tone: 'danger',
      badge: '👑 Disgrâce',
      text:
        disgraceCount >= 2
          ? `${disgraceCount} Ordres en Disgrâce : l’Autorité Royale chute !`
          : 'Un Ordre est tombé en Disgrâce (< 20%) !',
      buttonLabel: '👑 3 Ordres',
      kind: 'open_estates',
    };
  }

  return null;
}

export function getHighlightedGoalZoneId(state: GameState): string | null {
  const alert = computeUrgentAlert(state);
  if (alert?.zoneId) return alert.zoneId;

  const pack = evaluateCurrentGoals(state);
  const firstMapGoal = pack.goals.find((g) => !g.done && g.focusZoneId);
  return firstMapGoal?.focusZoneId ?? null;
}

interface AdvisorBannerProps {
  state: GameState;
  onFocusZone: (zoneId: string) => void;
  onRepairZone: (zoneId: string) => void;
  onOpenDungeon: (zoneId: string) => void;
  onOpenCity: () => void;
  onOpenArmyModal: () => void;
  onOpenEstatesModal: () => void;
}

export const AdvisorBanner: React.FC<AdvisorBannerProps> = ({
  state,
  onFocusZone,
  onRepairZone,
  onOpenDungeon,
  onOpenCity,
  onOpenArmyModal,
  onOpenEstatesModal,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const goalPack = evaluateCurrentGoals(state);
  const urgentAlert = computeUrgentAlert(state);
  const doneCount = goalPack.goals.filter((g) => g.done).length;

  const handleGoalClick = (g: GoalItem) => {
    if (g.actionKind === 'open_city') {
      onOpenCity();
    } else if (g.actionKind === 'open_army') {
      onOpenArmyModal();
    } else if (g.actionKind === 'open_estates') {
      onOpenEstatesModal();
    } else if (g.focusZoneId) {
      onFocusZone(g.focusZoneId);
    }
  };

  const handleAlertAction = (a: UrgentAlert) => {
    if (a.kind === 'repair_zone' && a.zoneId) {
      onRepairZone(a.zoneId);
    } else if (a.kind === 'open_dungeon' && a.zoneId) {
      onOpenDungeon(a.zoneId);
    } else if (a.kind === 'open_estates') {
      onOpenEstatesModal();
    } else if (a.zoneId) {
      onFocusZone(a.zoneId);
    }
  };

  return (
    <div className="top-left-stack">
      {/* Live Urgent Alert (Repair / Dungeon / Raider / Disgrace) */}
      {urgentAlert && (
        <div className={`urgent-alert-pill alert-${urgentAlert.tone}`} role="status">
          <div className="urgent-alert-body">
            <span className="urgent-badge">{urgentAlert.badge}</span>
            <span className="urgent-text">{urgentAlert.text}</span>
          </div>
          <button
            type="button"
            className="urgent-action-btn"
            onClick={() => handleAlertAction(urgentAlert)}
          >
            {urgentAlert.buttonLabel}
          </button>
        </div>
      )}

      {/* After Inc-Style Chapter Goals Checklist */}
      {collapsed ? (
        <button
          type="button"
          className="advisor-expand-btn"
          onClick={() => setCollapsed(false)}
        >
          📋 Objectifs ({doneCount}/{goalPack.goals.length}) — Afficher
        </button>
      ) : (
        <section className="advisor-card goals-card" aria-label="Objectifs de la colonie">
          <div className="advisor-top">
            <span className="advisor-badge">
              📋 Objectifs ({doneCount}/{goalPack.goals.length})
            </span>
            <button
              type="button"
              className="advisor-min-btn"
              onClick={() => setCollapsed(true)}
              aria-label="Réduire les objectifs"
              title="Réduire"
            >
              −
            </button>
          </div>

          <h3 className="advisor-title">{goalPack.title}</h3>

          <ul className="goals-checklist">
            {goalPack.goals.map((g) => {
              const canJump =
                !g.done &&
                (Boolean(g.focusZoneId) ||
                  g.actionKind === 'open_city' ||
                  g.actionKind === 'open_army' ||
                  g.actionKind === 'open_estates');
              return (
                <li key={g.id} className={`goal-row ${g.done ? 'is-done' : ''}`}>
                  <span className="goal-check" aria-hidden="true">
                    {g.done ? '✅' : '⬜'}
                  </span>
                  <span className="goal-label">{g.label}</span>
                  {canJump && (
                    <button
                      type="button"
                      className="goal-jump-btn"
                      onClick={() => handleGoalClick(g)}
                    >
                      {g.actionLabel ?? 'Voir'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="goals-reward-line">🎁 {goalPack.rewardText}</div>
        </section>
      )}
    </div>
  );
};
