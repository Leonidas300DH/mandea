import React from 'react';
import {
  BIOME_INFO,
  CAPITAL_BUILDINGS,
  CIVIC_BUILDINGS,
  RESOURCE_BUILDINGS,
  ROAD_UPGRADES,
} from '../data/buildings';
import { getRaceUnits, RACES, UNIT_DEFINITIONS } from '../data/races';
import {
  computeArmyPower,
  countUnits,
  getClaimCost,
  getExploreCost,
} from '../engine/simulation';
import {
  CapitalBuildingId,
  CivicBuildingId,
  GameState,
  ResourceBuildingType,
} from '../types/game';

interface ZonePanelProps {
  state: GameState;
  zoneId: string | null;
  selectedArmyId: string | null;
  orderMoveModeArmyId: string | null;
  onClose: () => void;
  onExplore: (zoneId: string) => void;
  onClaim: (zoneId: string) => void;
  onBuildResource: (zoneId: string, type: ResourceBuildingType) => void;
  onBuildCivic: (zoneId: string, civicId: CivicBuildingId) => void;
  onUpgradeRoad: (zoneId: string) => void;
  onUpgradeCapital: (buildingId: CapitalBuildingId) => void;
  onRecruitUnit: (unitId: string, targetArmyId?: string | 'new') => void;
  onToggleMoveMode: (armyId: string | null) => void;
  onSplitArmy: (armyId: string) => void;
  onMergeArmies: (srcId: string, dstId: string) => void;
  onAssignHero: (heroId: string, armyId: string | null) => void;
  onSendHeroToDungeon: (heroId: string, zoneId: string) => void;
  onOpenDungeonEvent: (zoneId: string) => void;
  onQuickSendArmyToZone: (destZoneId: string) => void;
}

export const ZonePanel: React.FC<ZonePanelProps> = ({
  state,
  zoneId,
  selectedArmyId,
  orderMoveModeArmyId,
  onClose,
  onExplore,
  onClaim,
  onBuildResource,
  onBuildCivic,
  onUpgradeRoad,
  onUpgradeCapital,
  onRecruitUnit,
  onToggleMoveMode,
  onSplitArmy,
  onMergeArmies,
  onAssignHero,
  onSendHeroToDungeon,
  onOpenDungeonEvent,
  onQuickSendArmyToZone,
}) => {
  if (!zoneId || !state.zones[zoneId]) return null;
  const zone = state.zones[zoneId];
  const biomeCfg = BIOME_INFO[zone.biome];
  const raceDef = RACES[state.race];
  const raceUnits = getRaceUnits(state.race);
  const capZone = state.zones[state.capitalZoneId];

  const zoneArmies = Object.values(state.armies).filter(
    (a) => a.zoneId === zone.id && countUnits(a.units) > 0
  );
  const playerArmiesHere = zoneArmies.filter((a) => a.owner === 'player');
  const enemyArmiesHere = zoneArmies.filter((a) => a.owner !== 'player');
  const activeBattle = state.battles[zone.id];

  const canExplore =
    zone.status === 'unexplored' &&
    zone.neighbors.some((nId) => state.zones[nId]?.status !== 'unexplored');
  const exploreCost = getExploreCost(state);

  const adjacentToClaimed = zone.neighbors.some((nId) => state.zones[nId]?.status === 'claimed');
  const canClaim =
    (zone.status === 'explored' || zone.status === 'seceded') &&
    adjacentToClaimed &&
    !zone.staticMonster &&
    enemyArmiesHere.length === 0;
  const claimCost = getClaimCost(state);

  const availableHeroesForDungeon = Object.values(state.heroes).filter(
    (h) => h.status !== 'dungeon'
  );

  // Allowed resource building options for this province
  const resourceOptions: ResourceBuildingType[] = [];
  if (biomeCfg.allowedResource) {
    resourceOptions.push(biomeCfg.allowedResource);
  }
  if (zone.biome === 'plains' && !resourceOptions.includes('livestock')) {
    resourceOptions.push('livestock');
  }
  if (zone.biome === 'forest' && state.race === 'elves') {
    resourceOptions.push('grove');
  }

  return (
    <aside className="zone-panel" aria-label={`Inspection de ${zone.name}`}>
      <div className="panel-header">
        <div>
          <span className="biome-pill">
            {biomeCfg.emoji} {biomeCfg.name} •{' '}
            {zone.status === 'claimed'
              ? 'Domaine Royal'
              : zone.status === 'seceded'
                ? 'Sécession Rebelle !'
                : zone.status === 'explored'
                  ? 'Terre Sauvage'
                  : 'Inexploré'}
          </span>
          <h2>{zone.name}</h2>
        </div>
        <button type="button" className="close-panel-btn" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>

      <div className="panel-scroll">
        {/* LIVE BATTLE BANNER */}
        {activeBattle && (
          <div className="card alert-battle">
            <div className="card-title">
              ⚔️ Bataille Tactique en cours — Round {activeBattle.round} (
              {activeBattle.phase === 'ranged' ? 'Salve à distance' : 'Choc & Mêlée'})
            </div>
            <p className="small-muted">{activeBattle.lastSummary}</p>
          </div>
        )}

        {/* UNEXPLORED */}
        {zone.status === 'unexplored' && (
          <div className="card">
            <p className="small-muted">
              Ces terres sont enveloppées de brume. Envoyez des éclaireurs pour découvrir ses ressources, ses monstres ou d’antiques donjons.
            </p>
            {canExplore ? (
              <button
                type="button"
                className="primary-btn full-btn"
                disabled={state.resources.intendance < exploreCost}
                onClick={() => onExplore(zone.id)}
              >
                🧭 Éclairer la région ({exploreCost} ⚡ Intendance)
              </button>
            ) : (
              <p className="warn-text">Éclairez d’abord une région adjacente.</p>
            )}
          </div>
        )}

        {/* STATIC MONSTER */}
        {zone.status !== 'unexplored' && zone.staticMonster && (
          <div className="card danger-card">
            <img
              src="/assets/events/threat-monster.jpg"
              alt={zone.staticMonster.name}
              className="card-banner-img"
              width={320}
              height={140}
            />
            <div className="card-title">🐉 {zone.staticMonster.name}</div>
            <p className="small-muted">{zone.staticMonster.description}</p>
            <div className="unit-tags">
              {Object.entries(zone.staticMonster.units).map(([uId, cnt]) =>
                cnt > 0 ? (
                  <span key={uId} className="unit-tag enemy-tag">
                    {UNIT_DEFINITIONS[uId]?.badgeEmoji} {cnt}× {UNIT_DEFINITIONS[uId]?.name}
                  </span>
                ) : null
              )}
            </div>
            <p className="reward-line">
              Récompense : <strong>+{zone.staticMonster.rewardGold} 🪙 Or</strong>,{' '}
              <strong>+{zone.staticMonster.rewardIron} ⛏️ Fer</strong> & Prestige Clergé/Noblesse
            </p>
            {playerArmiesHere.length === 0 && (
              <button
                type="button"
                className="action-btn full-btn"
                onClick={() => onQuickSendArmyToZone(zone.id)}
              >
                ⚔️ Envoyer l’Armée la plus proche purger la zone
              </button>
            )}
          </div>
        )}

        {/* DUNGEON SITE */}
        {zone.status !== 'unexplored' && zone.dungeon && (
          <div className="card epic-card">
            <img
              src="/assets/events/dungeon-crypt.jpg"
              alt={zone.dungeon.name}
              className="card-banner-img"
              width={320}
              height={140}
            />
            <div className="card-title">
              🗝️ {zone.dungeon.name} ({'★'.repeat(zone.dungeon.stars)})
            </div>
            {zone.dungeon.corrupted && !zone.dungeon.cleared && (
              <p className="warn-text">
                🕯️ Lieu profané : irrite le Clergé (-11) tant qu’il n’est pas purifié !
              </p>
            )}
            {zone.dungeon.cleared ? (
              <p className="ok-text">✅ Donjon exploré et purifié par vos Héros !</p>
            ) : zone.dungeon.pendingEvent ? (
              <button
                type="button"
                className="primary-btn full-btn pulse-btn"
                onClick={() => onOpenDungeonEvent(zone.id)}
              >
                ❗ Décision d’Expédition (Palier {zone.dungeon.stage}/{zone.dungeon.maxStages})
              </button>
            ) : zone.dungeon.activeHeroId ? (
              <div>
                <p className="small-muted">
                  <strong>{state.heroes[zone.dungeon.activeHeroId]?.name}</strong> explore le Palier{' '}
                  {zone.dungeon.stage}/{zone.dungeon.maxStages} ({Math.round(zone.dungeon.progress)}%)
                </p>
                <div className="progress-bar">
                  <div style={{ width: `${zone.dungeon.progress}%` }} />
                </div>
              </div>
            ) : (
              <div className="dungeon-hero-picker">
                <p className="small-muted">
                  Seul un Héros peut explorer ces couloirs pour y trouver Or et Reliques :
                </p>
                {availableHeroesForDungeon.length === 0 ? (
                  <p className="warn-text">Aucun Héros libre (recrutez-en à la Taverne !).</p>
                ) : (
                  availableHeroesForDungeon.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className="action-btn full-btn"
                      onClick={() => onSendHeroToDungeon(h.id, zone.id)}
                    >
                      🗡️ Envoyer {h.name} (Niv.{h.level}) en expédition
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* CLAIM TERRITORY BUTTON */}
        {(zone.status === 'explored' || zone.status === 'seceded') && (
          <div className="card">
            <div className="card-title">
              {zone.status === 'seceded' ? '🏴 Province en Sécession' : '🚩 Annexion Territoriale'}
            </div>
            <p className="small-muted">{biomeCfg.description}</p>
            {canClaim ? (
              <button
                type="button"
                className="primary-btn full-btn"
                disabled={
                  state.resources.intendance < claimCost.intendance ||
                  state.resources.wood < claimCost.wood ||
                  state.resources.gold < claimCost.gold
                }
                onClick={() => onClaim(zone.id)}
              >
                🚩 Revendiquer ({claimCost.intendance}⚡ • {claimCost.wood}🪵 • {claimCost.gold}🪙)
              </button>
            ) : !adjacentToClaimed ? (
              <p className="warn-text">Doit être adjacente à une province déjà sous votre contrôle.</p>
            ) : (
              <p className="warn-text">
                Éliminez d’abord les Monstres ou Troupes hostiles occupant cette région !
              </p>
            )}
          </div>
        )}

        {/* CLAIMED PROVINCE DEVELOPMENT (REBEL INC + AFTER INC VISIBLE UPGRADES!) */}
        {zone.status === 'claimed' && zone.biome !== 'capital' && (
          <>
            {/* 1. Roads */}
            <div className="card">
              <div className="card-title">🛤️ Réseau Routier Local</div>
              <p className="small-muted">
                État actuel :{' '}
                <strong>
                  {zone.roadLevel === 0
                    ? 'Sentier boueux'
                    : zone.roadLevel === 1
                      ? 'Route Empierrée'
                      : 'Grande Chaussée Royale'}
                </strong>
                {zone.fortHp > 0 && ` • Rempart ${Math.round(zone.fortHp)}/${zone.maxFortHp} PV`}
              </p>
              {zone.roadLevel < 2 && (() => {
                const nextLvl = (zone.roadLevel + 1) as 1 | 2;
                const rCfg = ROAD_UPGRADES[nextLvl];
                const disc = 1 - raceDef.bonuses.roadCostDiscount;
                const cW = Math.round(rCfg.cost.wood * disc);
                const cI = Math.round(rCfg.cost.iron * disc);
                const cG = Math.round(rCfg.cost.gold * disc);
                const cInt = Math.max(4, Math.round(rCfg.cost.intendance * disc));
                return (
                  <button
                    type="button"
                    className="action-btn full-btn"
                    disabled={
                      state.resources.wood < cW ||
                      state.resources.iron < cI ||
                      state.resources.gold < cG ||
                      state.resources.intendance < cInt
                    }
                    onClick={() => onUpgradeRoad(zone.id)}
                  >
                    {rCfg.emoji} Bâtir {rCfg.name} ({cInt}⚡ {cW}🪵 {cI > 0 ? `${cI}⛏️ ` : ''}
                    {cG}🪙)
                    <small className="btn-sub">{rCfg.description}</small>
                  </button>
                );
              })()}
            </div>

            {/* 2. Resource Exploitation */}
            <div className="card">
              <div className="card-title">🌾 Exploitation du Territoire</div>
              {resourceOptions.map((rType) => {
                const cfg = RESOURCE_BUILDINGS[rType];
                const curLvl = zone.resourceBuilding?.type === rType ? zone.resourceBuilding.level : 0;
                if (zone.resourceBuilding && zone.resourceBuilding.type !== rType) return null;
                if (curLvl >= 3) {
                  return (
                    <div key={rType} className="built-pill">
                      {cfg.emoji} {cfg.name} — <strong>Niveau Max (3/3)</strong>
                    </div>
                  );
                }
                const mult = curLvl === 0 ? 1 : curLvl === 1 ? 1.55 : 2.2;
                const cW = Math.round(cfg.baseCost.wood * mult);
                const cI = Math.round((cfg.baseCost.iron + (curLvl > 0 ? 6 * curLvl : 0)) * mult);
                const cG = Math.round(cfg.baseCost.gold * mult);
                const cInt = Math.round(cfg.baseCost.intendance * (curLvl === 0 ? 1 : 1.15));

                return (
                  <button
                    key={rType}
                    type="button"
                    className="action-btn full-btn"
                    disabled={
                      state.resources.wood < cW ||
                      state.resources.iron < cI ||
                      state.resources.gold < cG ||
                      state.resources.intendance < cInt
                    }
                    onClick={() => onBuildResource(zone.id, rType)}
                  >
                    {cfg.emoji} {curLvl === 0 ? `Construire ${cfg.name}` : `Améliorer ${cfg.name} → Niv.${curLvl + 1}`}{' '}
                    ({cInt}⚡ {cW}🪵 {cI > 0 ? `${cI}⛏️ ` : ''}{cG}🪙)
                    <small className="btn-sub">{cfg.description}</small>
                  </button>
                );
              })}
            </div>

            {/* 3. Living Conditions, Estates & Local Defense */}
            <div className="card">
              <div className="card-title">🏘️ Conditions de Vie, Ordres & Défense</div>
              <div className="build-list">
                {(Object.keys(CIVIC_BUILDINGS) as CivicBuildingId[]).map((civId) => {
                  const cfg = CIVIC_BUILDINGS[civId];
                  const built = zone.civicBuildings.includes(civId);
                  if (built) {
                    return (
                      <div key={civId} className="built-pill">
                        {cfg.emoji} {cfg.name} ✓
                      </div>
                    );
                  }
                  const canAfford =
                    state.resources.wood >= cfg.cost.wood &&
                    state.resources.iron >= cfg.cost.iron &&
                    state.resources.gold >= cfg.cost.gold &&
                    state.resources.intendance >= cfg.cost.intendance;

                  return (
                    <button
                      key={civId}
                      type="button"
                      className="action-btn full-btn"
                      disabled={!canAfford}
                      onClick={() => onBuildCivic(zone.id, civId)}
                    >
                      <span>
                        {cfg.emoji} {cfg.name} ({cfg.cost.intendance}⚡ {cfg.cost.wood}🪵{' '}
                        {cfg.cost.iron > 0 ? `${cfg.cost.iron}⛏️ ` : ''}
                        {cfg.cost.gold}🪙)
                      </span>
                      <small className="btn-sub">{cfg.description}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* CAPITAL METROPOLIS MANAGEMENT & UNIT RECRUITMENT */}
        {zone.biome === 'capital' && capZone && (
          <>
            <div className="card">
              <div className="card-title">
                🏰 Quartiers de la Capitale (Remparts {Math.round(capZone.fortHp)}/{capZone.maxFortHp} PV)
              </div>
              <div className="build-list">
                {(Object.keys(CAPITAL_BUILDINGS) as CapitalBuildingId[]).map((bId) => {
                  const cfg = CAPITAL_BUILDINGS[bId];
                  const cur = capZone.capitalBuildings[bId] ?? 0;
                  if (cur >= cfg.maxLevel) {
                    return (
                      <div key={bId} className="built-pill">
                        {cfg.emoji} {cfg.name} — Niv. {cur}/{cfg.maxLevel} ✓
                      </div>
                    );
                  }
                  const mult = cur === 0 ? 1 : cur === 1 ? 1.65 : 2.4;
                  const cW = Math.round(cfg.baseCost.wood * mult);
                  const cI = Math.round(cfg.baseCost.iron * mult);
                  const cG = Math.round(cfg.baseCost.gold * mult);
                  const cInt = Math.round(cfg.baseCost.intendance * (cur === 0 ? 1 : 1.2));
                  const canAfford =
                    state.resources.wood >= cW &&
                    state.resources.iron >= cI &&
                    state.resources.gold >= cG &&
                    state.resources.intendance >= cInt;

                  return (
                    <button
                      key={bId}
                      type="button"
                      className="action-btn full-btn"
                      disabled={!canAfford}
                      onClick={() => onUpgradeCapital(bId)}
                    >
                      <span>
                        {cfg.emoji} {cfg.name} (Niv.{cur}→{cur + 1}) • {cInt}⚡ {cW}🪵 {cI}⛏️ {cG}🪙
                      </span>
                      <small className="btn-sub">{cfg.description}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recruit Stackable Racial & Fantasy Units */}
            <div className="card">
              <div className="card-title">⚔️ Recruter des Unités ({raceDef.name})</div>
              <p className="small-muted">
                Les unités recrutées s’empilent dans la Compagnie stationnée à la Capitale (ou créent une nouvelle Bannière).
              </p>
              <div className="build-list">
                {raceUnits.map((u) => {
                  const reqB = u.requiresBuilding;
                  const locked = reqB ? (capZone.capitalBuildings[reqB] ?? 0) < 1 : false;
                  const cGold = Math.round(u.cost.gold * (state.race === 'orcs' ? 0.85 : 1));
                  const canAfford =
                    !locked &&
                    state.resources.food >= u.cost.food &&
                    state.resources.wood >= u.cost.wood &&
                    state.resources.iron >= u.cost.iron &&
                    state.resources.gold >= cGold;

                  return (
                    <div key={u.id} className={`unit-recruit-row ${locked ? 'locked' : ''}`}>
                      <div className="unit-recruit-info">
                        <strong>
                          {u.badgeEmoji} {u.name}
                        </strong>
                        <span className="unit-stats-line">
                          PV {u.hp} • Mêlée {u.meleeAtk}
                          {u.rangedAtk > 0 ? ` • Tir ${u.rangedAtk}` : ''} • Percée {u.armorPierce} • Vit.{' '}
                          {u.speed}
                        </span>
                        <small className="small-muted">
                          {locked && reqB
                            ? `🔒 Requiert : ${CAPITAL_BUILDINGS[reqB].name}`
                            : u.description}
                        </small>
                      </div>
                      <div className="unit-recruit-btns">
                        <button
                          type="button"
                          className="primary-btn compact-btn"
                          disabled={!canAfford}
                          onClick={() => onRecruitUnit(u.id, selectedArmyId ?? undefined)}
                          title="Ajouter à la pile présente"
                        >
                          +1 ({u.cost.food}🌾 {u.cost.wood > 0 ? `${u.cost.wood}🪵 ` : ''}
                          {u.cost.iron > 0 ? `${u.cost.iron}⛏️ ` : ''}
                          {cGold}🪙)
                        </button>
                        {playerArmiesHere.length > 0 && (
                          <button
                            type="button"
                            className="action-btn compact-btn"
                            disabled={!canAfford}
                            onClick={() => onRecruitUnit(u.id, 'new')}
                            title="Former une nouvelle Bannière séparée"
                          >
                            + Nouv. Pile
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* STACKABLE ARMIES IN THIS ZONE */}
        {(playerArmiesHere.length > 0 || enemyArmiesHere.length > 0) && (
          <div className="card">
            <div className="card-title">🚩 Armées & Piles d’Unités sur place</div>

            {playerArmiesHere.map((army) => {
              const isMoveActive = orderMoveModeArmyId === army.id;
              const hero = army.heroId ? state.heroes[army.heroId] : null;
              const otherPlayerArmy = playerArmiesHere.find((a) => a.id !== army.id);

              return (
                <div
                  key={army.id}
                  className={`army-stack-box ${selectedArmyId === army.id ? 'selected' : ''}`}
                >
                  <div className="army-stack-header">
                    <strong>🛡️ {army.name}</strong>
                    <span className="power-badge">Puissance {computeArmyPower(army, state)}</span>
                  </div>

                  <div className="unit-tags">
                    {Object.entries(army.units).map(([uId, cnt]) =>
                      cnt > 0 ? (
                        <span key={uId} className="unit-tag">
                          {UNIT_DEFINITIONS[uId]?.badgeEmoji} <strong>{cnt}×</strong>{' '}
                          {UNIT_DEFINITIONS[uId]?.name}
                        </span>
                      ) : null
                    )}
                  </div>

                  {/* Hero Commander Selector */}
                  <div className="hero-assign-row">
                    <label htmlFor={`hero_sel_${army.id}`}>Commandant :</label>
                    <select
                      id={`hero_sel_${army.id}`}
                      value={army.heroId ?? ''}
                      onChange={(e) => onAssignHero(e.target.value || hero?.id || '', e.target.value ? army.id : null)}
                    >
                      <option value="">— Aucun Héros —</option>
                      {Object.values(state.heroes)
                        .filter((h) => h.status !== 'dungeon')
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            👑 {h.name} (Niv.{h.level} • +{Math.round(h.armyAtkAura * 100)}% ATQ)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="army-actions-row">
                    <button
                      type="button"
                      className={`primary-btn compact-btn ${isMoveActive ? 'active-move' : ''}`}
                      onClick={() => onToggleMoveMode(isMoveActive ? null : army.id)}
                    >
                      {isMoveActive ? '✕ Annuler ordre' : '🚩 Déplacer la pile'}
                    </button>
                    {countUnits(army.units) >= 2 && (
                      <button
                        type="button"
                        className="action-btn compact-btn"
                        onClick={() => onSplitArmy(army.id)}
                      >
                        ➗ Diviser en 2
                      </button>
                    )}
                    {otherPlayerArmy && (
                      <button
                        type="button"
                        className="action-btn compact-btn"
                        onClick={() => onMergeArmies(army.id, otherPlayerArmy.id)}
                      >
                        🔗 Fusionner
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {enemyArmiesHere.map((ea) => (
              <div key={ea.id} className="army-stack-box enemy-box">
                <div className="army-stack-header">
                  <strong>💀 {ea.name}</strong>
                  <span className="power-badge danger">Puissance {computeArmyPower(ea, state)}</span>
                </div>
                <div className="unit-tags">
                  {Object.entries(ea.units).map(([uId, cnt]) =>
                    cnt > 0 ? (
                      <span key={uId} className="unit-tag enemy-tag">
                        {UNIT_DEFINITIONS[uId]?.badgeEmoji} <strong>{cnt}×</strong>{' '}
                        {UNIT_DEFINITIONS[uId]?.name}
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
