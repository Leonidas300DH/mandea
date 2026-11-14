import React from 'react';
import {
  BIOME_INFO,
  CAPITAL_BUILDINGS,
  CITY_TIER_NAMES,
  CIVIC_BUILDINGS,
  RESOURCE_BUILDINGS,
  ROAD_UPGRADES,
} from '../data/buildings';
import { RACES, UNIT_DEFINITIONS } from '../data/races';
import {
  computeArmyPower,
  countUnits,
  getCapitalUpgradeCost,
  getClaimCost,
  getExploreCost,
  getRepairCost,
  getResourceBuildCost,
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
  onRepair: (zoneId: string) => void;
  onBuildResource: (zoneId: string, type: ResourceBuildingType) => void;
  onBuildCivic: (zoneId: string, civicId: CivicBuildingId) => void;
  onUpgradeRoad: (zoneId: string) => void;
  onUpgradeCapital: (buildingId: CapitalBuildingId) => void;
  onOpenArmyModal: () => void;
  onToggleMoveMode: (armyId: string | null) => void;
  onSplitArmy: (armyId: string) => void;
  onMergeArmies: (srcId: string, dstId: string) => void;
  onAssignHero: (heroId: string, armyId: string | null) => void;
  onSendHeroToDungeon: (heroId: string, zoneId: string) => void;
  onOpenDungeonEvent: (zoneId: string) => void;
  onQuickSendArmyToZone: (destZoneId: string) => void;
}

const RES_SPRITES: Record<ResourceBuildingType, string> = {
  farm: '/assets/sprites/farm.png',
  livestock: '/assets/sprites/livestock.png',
  lumber: '/assets/sprites/lumber.png',
  mine: '/assets/sprites/mine.png',
  grove: '/assets/sprites/lumber.png',
};

const CIVIC_SPRITES: Record<CivicBuildingId, string> = {
  wells: '/assets/sprites/wells.png',
  market: '/assets/sprites/market.png',
  chapel: '/assets/sprites/chapel.png',
  fort: '/assets/sprites/fort.png',
};

const CostChips: React.FC<{
  state: GameState;
  intendance?: number;
  food?: number;
  wood?: number;
  gold?: number;
}> = ({ state, intendance = 0, food = 0, wood = 0, gold = 0 }) => {
  const items: { icon: string; name: string; need: number; have: number }[] = [];
  if (intendance > 0)
    items.push({
      icon: '⚡',
      name: 'Commandement',
      need: intendance,
      have: state.resources.intendance,
    });
  if (wood > 0)
    items.push({ icon: '🪵', name: 'Bois', need: wood, have: state.resources.wood });
  if (gold > 0)
    items.push({ icon: '💰', name: 'Or', need: gold, have: state.resources.gold });
  if (food > 0)
    items.push({ icon: '🌾', name: 'Vivres', need: food, have: state.resources.food });

  return (
    <span className="cost-row">
      {items.map((it) => {
        const missing = it.have < it.need;
        return (
          <span
            key={it.name}
            className={`cost-chip ${missing ? 'missing' : 'ok'}`}
            title={
              missing
                ? `${it.name} insuffisant (${Math.floor(it.have)}/${it.need})`
                : `${it.need} ${it.name}`
            }
          >
            {it.icon} {it.need}
          </span>
        );
      })}
    </span>
  );
};

const OTHER_CAPITAL_DISTRICTS: CapitalBuildingId[] = [
  'barracks',
  'noble_court',
  'cathedral',
  'grand_market',
  'menagerie',
  'walls',
];

export const ZonePanel: React.FC<ZonePanelProps> = ({
  state,
  zoneId,
  selectedArmyId,
  orderMoveModeArmyId,
  onClose,
  onExplore,
  onClaim,
  onRepair,
  onBuildResource,
  onBuildCivic,
  onUpgradeRoad,
  onUpgradeCapital,
  onOpenArmyModal,
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
  const capZone = state.zones[state.capitalZoneId];

  const zoneArmies = Object.values(state.armies).filter(
    (a) => a.zoneId === zone.id && countUnits(a.units) > 0
  );
  const playerArmiesHere = zoneArmies.filter((a) => a.owner === 'player');
  const enemyArmiesHere = zoneArmies.filter((a) => a.owner !== 'player');
  const anyPlayerArmyAnywhere = Object.values(state.armies).some(
    (a) => a.owner === 'player' && countUnits(a.units) > 0
  );
  const activeBattle = state.battles[zone.id];

  const canExplore =
    zone.status === 'unexplored' &&
    zone.neighbors.some((nId) => state.zones[nId]?.status !== 'unexplored');
  const exploreCost = getExploreCost(state);
  const repairCost = getRepairCost();

  const adjacentToClaimed = zone.neighbors.some(
    (nId) => state.zones[nId]?.status === 'claimed'
  );
  const canClaim =
    (zone.status === 'explored' || zone.status === 'seceded') &&
    adjacentToClaimed &&
    !zone.staticMonster &&
    enemyArmiesHere.length === 0;
  const claimCost = getClaimCost(state);

  const availableHeroesForDungeon = Object.values(state.heroes).filter(
    (h) => h.status !== 'dungeon'
  );

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

  const renderArmiesBlock = () => (
    <div className="card">
      <div className="card-title">🚩 Armée dans ce territoire</div>
      {playerArmiesHere.length === 0 && enemyArmiesHere.length === 0 ? (
        <div className="empty-state-box">
          <p className="small-muted">Aucune troupe présente ici.</p>
          {anyPlayerArmyAnywhere && zone.status !== 'unexplored' && (
            <button
              type="button"
              className="action-btn full-btn"
              onClick={() => onQuickSendArmyToZone(zone.id)}
            >
              🛡️ Faire venir mon Armée ici
            </button>
          )}
        </div>
      ) : (
        <div className="build-list">
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
                  <div className="army-title-wrap">
                    <img
                      src="/assets/sprites/army_player.png"
                      alt=""
                      className="mini-sprite-icon"
                    />
                    <strong>{army.name}</strong>
                  </div>
                  <span className="power-badge">⚔️ {computeArmyPower(army, state)}</span>
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

                <div className="hero-assign-row">
                  <label htmlFor={`hero_sel_${army.id}`}>Héros :</label>
                  <select
                    id={`hero_sel_${army.id}`}
                    value={army.heroId ?? ''}
                    onChange={(e) =>
                      onAssignHero(
                        e.target.value || hero?.id || '',
                        e.target.value ? army.id : null
                      )
                    }
                  >
                    <option value="">— Sans commandant —</option>
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
                    {isMoveActive ? '✕ Annuler déplacement' : '🚩 Déplacer sur la carte'}
                  </button>
                  {countUnits(army.units) >= 2 && (
                    <button
                      type="button"
                      className="action-btn compact-btn"
                      onClick={() => onSplitArmy(army.id)}
                    >
                      ➗ Diviser
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
                <div className="army-title-wrap">
                  <img
                    src="/assets/sprites/army_enemy.png"
                    alt=""
                    className="mini-sprite-icon"
                  />
                  <strong>{ea.name}</strong>
                </div>
                <span className="power-badge danger">⚔️ {computeArmyPower(ea, state)}</span>
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
              {playerArmiesHere.length === 0 && anyPlayerArmyAnywhere && (
                <button
                  type="button"
                  className="primary-btn full-btn"
                  onClick={() => onQuickSendArmyToZone(zone.id)}
                >
                  ⚔️ Envoyer mon Armée les intercepter !
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDungeonBlock = () => {
    if (zone.status === 'unexplored' || !zone.dungeon) return null;
    const dng = zone.dungeon;
    return (
      <div className="card epic-card">
        <div className="landmark-card-row">
          <img src="/assets/sprites/dungeon.png" alt="" className="card-sprite-thumb" />
          <div>
            <div className="card-title">
              🗝️ {dng.name} <span className="gold-stars">{'★'.repeat(dng.stars)}</span>
            </div>
            <p className="small-muted">
              Envoyez un Héros explorer ce Donjon pour rapporter beaucoup d’💰 Or et des Reliques.
            </p>
          </div>
        </div>
        {dng.corrupted && !dng.cleared && (
          <p className="warn-text">
            🕯️ Lieu profané : mécontente le Clergé (-8) tant qu’il n’est pas purifié.
          </p>
        )}
        {dng.cleared ? (
          <p className="ok-text">✅ Donjon entièrement exploré et purifié !</p>
        ) : dng.pendingEvent ? (
          <button
            type="button"
            className="primary-btn full-btn"
            onClick={() => onOpenDungeonEvent(zone.id)}
          >
            ❗ Choisir l’action du Héros (Salle {dng.stage}/{dng.maxStages})
          </button>
        ) : dng.activeHeroId ? (
          <div>
            <p className="small-muted">
              <strong>{state.heroes[dng.activeHeroId]?.name}</strong> explore la Salle {dng.stage}/
              {dng.maxStages} ({Math.round(dng.progress)}%)
            </p>
            <div className="progress-bar">
              <div style={{ width: `${dng.progress}%` }} />
            </div>
          </div>
        ) : availableHeroesForDungeon.length === 0 ? (
          <button type="button" className="action-btn full-btn" onClick={onOpenArmyModal}>
            🍺 Recruter un Héros dans « ⚔️ Armée & Héros »
          </button>
        ) : (
          <div className="build-list">
            {availableHeroesForDungeon.map((h) => (
              <button
                key={h.id}
                type="button"
                className="primary-btn full-btn"
                onClick={() => onSendHeroToDungeon(h.id, zone.id)}
              >
                <span>🗡️ Envoyer {h.name} (Niv.{h.level}) explorer le Donjon</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="zone-panel" aria-label={`Territoire ${zone.name}`}>
      <div className="panel-header">
        <div>
          <span className={`status-tag status-${zone.status}`}>
            {zone.status === 'claimed'
              ? '👑 Votre Territoire'
              : zone.status === 'seceded'
                ? '🏴 Sécession'
                : zone.status === 'explored'
                  ? '🌿 Terre Sauvage'
                  : '☁️ Brume Inexplorée'}
          </span>
          <h2>
            {biomeCfg.emoji} {zone.name}
          </h2>
          <div className="biome-sub">
            {biomeCfg.name} · <strong>{biomeCfg.mapHint}</strong>
          </div>
        </div>
        <button type="button" className="close-panel-btn" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>

      <div className="panel-scroll">
        {/* TOP PRIORITY: 1-CLICK REPAIR BANNER IF PILLAGED! */}
        {zone.pillagedTimer > 0 && (
          <div className="card repair-priority-card">
            <div className="card-title">🔥 Territoire endommagé par un raid !</div>
            <p className="small-muted">
              Les installations fument encore : la production est suspendue tant que vous ne réparez pas (ou {Math.ceil(zone.pillagedTimer)}s restantes).
            </p>
            <button
              type="button"
              className="primary-btn full-btn repair-big-btn"
              disabled={state.resources.intendance < repairCost}
              onClick={() => onRepair(zone.id)}
            >
              <div className="btn-top-line">
                <span>🔨 Réparer maintenant (relance la production)</span>
                <CostChips state={state} intendance={repairCost} />
              </div>
            </button>
          </div>
        )}

        {/* LIVE BATTLE BANNER */}
        {activeBattle && (
          <div className="card alert-battle">
            <div className="card-title">
              ⚔️ Combat en cours — Round {activeBattle.round} (
              {activeBattle.phase === 'ranged' ? 'Salve de tir' : 'Mêlée'})
            </div>
            <p className="small-muted">{activeBattle.lastSummary}</p>
          </div>
        )}

        {/* 1. UNEXPLORED VIEW */}
        {zone.status === 'unexplored' && (
          <div className="card">
            <div className="card-title">🔍 Explorer ce territoire</div>
            <p className="small-muted">
              Dépensez un peu de ⚡ Commandement (qui se recharge tout seul) pour dissiper la brume et voir ce que produit cette terre.
            </p>
            {canExplore ? (
              <button
                type="button"
                className="primary-btn full-btn"
                disabled={state.resources.intendance < exploreCost}
                onClick={() => onExplore(zone.id)}
              >
                <div className="btn-top-line">
                  <span>🔍 Explorer maintenant</span>
                  <CostChips state={state} intendance={exploreCost} />
                </div>
              </button>
            ) : (
              <p className="warn-text">Explorez d’abord un territoire voisin déjà éclairé.</p>
            )}
          </div>
        )}

        {/* 2. EXPLORED WILD / SECEDED VIEW */}
        {(zone.status === 'explored' || zone.status === 'seceded') && (
          <>
            {zone.staticMonster && (
              <div className="card danger-card">
                <div className="landmark-card-row">
                  <img src="/assets/sprites/monster.png" alt="" className="card-sprite-thumb" />
                  <div>
                    <div className="card-title">🐉 {zone.staticMonster.name}</div>
                    <p className="small-muted">
                      {zone.staticMonster.description} <em>(Reste sur place : n’attaque pas votre Cité.)</em>
                    </p>
                  </div>
                </div>
                <p className="reward-line">
                  Butin de victoire : <strong>+{zone.staticMonster.rewardGold} 💰 Or</strong> &{' '}
                  <strong>+{zone.staticMonster.rewardWood} 🪵 Bois</strong>
                </p>
                {playerArmiesHere.length === 0 && anyPlayerArmyAnywhere && (
                  <button
                    type="button"
                    className="primary-btn full-btn"
                    onClick={() => onQuickSendArmyToZone(zone.id)}
                  >
                    ⚔️ Envoyer mon Armée vaincre ce Monstre
                  </button>
                )}
              </div>
            )}

            <div className="card">
              <div className="card-title">🚩 Prendre ce territoire</div>
              <p className="small-muted">{biomeCfg.description}</p>
              {biomeCfg.allowedResource && (
                <div className="potential-box">
                  <img
                    src={RES_SPRITES[biomeCfg.allowedResource]}
                    alt=""
                    className="mini-sprite-icon"
                  />
                  <span>
                    Bâtiment débloqué :{' '}
                    <strong>{RESOURCE_BUILDINGS[biomeCfg.allowedResource].name}</strong> (
                    {RESOURCE_BUILDINGS[biomeCfg.allowedResource].producesLabel})
                  </span>
                </div>
              )}

              {canClaim ? (
                <button
                  type="button"
                  className="primary-btn full-btn"
                  disabled={state.resources.intendance < claimCost}
                  onClick={() => onClaim(zone.id)}
                >
                  <div className="btn-top-line">
                    <span>🚩 Prendre ce territoire</span>
                    <CostChips state={state} intendance={claimCost} />
                  </div>
                </button>
              ) : !adjacentToClaimed ? (
                <p className="warn-text">
                  Doit toucher un territoire qui vous appartient déjà.
                </p>
              ) : (
                <p className="warn-text">
                  Vainquez d’abord le Monstre ou les ennemis présents ici pour prendre la zone !
                </p>
              )}
            </div>

            {renderDungeonBlock()}
            {renderArmiesBlock()}
          </>
        )}

        {/* 3. CLAIMED PROVINCE VIEW (SINGLE CLEAN VIEW — NO HIDDEN TABS!) */}
        {zone.status === 'claimed' && zone.biome !== 'capital' && (
          <>
            {/* A. Primary Resource Exploitation */}
            <div className="card">
              <div className="card-title">🌾 Ressource Principale du Territoire</div>
              {resourceOptions.length === 0 ? (
                <p className="small-muted">Aucune ressource primaire exploitable ici.</p>
              ) : (
                <div className="build-list">
                  {resourceOptions.map((rType) => {
                    const cfg = RESOURCE_BUILDINGS[rType];
                    const curLvl =
                      zone.resourceBuilding?.type === rType ? zone.resourceBuilding.level : 0;
                    if (zone.resourceBuilding && zone.resourceBuilding.type !== rType) return null;

                    if (curLvl >= 3) {
                      return (
                        <div key={rType} className="built-pill">
                          <img src={RES_SPRITES[rType]} alt="" className="mini-sprite-icon" />
                          <span>
                            {cfg.name} — <strong>Niveau Max (★★★)</strong> ({cfg.producesLabel})
                          </span>
                        </div>
                      );
                    }

                    const cost = getResourceBuildCost(rType, curLvl);
                    const canAfford =
                      state.resources.intendance >= cost.intendance &&
                      state.resources.wood >= cost.wood;

                    return (
                      <div key={rType} className="visual-build-card">
                        <div className="landmark-card-row">
                          <img src={RES_SPRITES[rType]} alt="" className="card-sprite-thumb" />
                          <div>
                            <strong>
                              {cfg.name} {curLvl > 0 && `(Niv.${curLvl}/3)`}
                            </strong>
                            <div className="yield-highlight">{cfg.producesLabel} par niveau</div>
                            <p className="small-muted">{cfg.description}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="primary-btn full-btn"
                          disabled={!canAfford}
                          onClick={() => onBuildResource(zone.id, rType)}
                        >
                          <div className="btn-top-line">
                            <span>
                              {curLvl === 0
                                ? `Construire ${cfg.name}`
                                : `Améliorer → Niveau ${curLvl + 1}`}
                            </span>
                            <CostChips
                              state={state}
                              intendance={cost.intendance}
                              wood={cost.wood}
                            />
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* B. Roads */}
            <div className="card">
              <div className="card-title">🛤️ Routes & Conditions de Circulation</div>
              <p className="small-muted">
                État actuel :{' '}
                <strong>
                  {zone.roadLevel === 0
                    ? 'Sentier de terre'
                    : zone.roadLevel === 1
                      ? 'Route Empierrée (+45% vitesse, +15% prod.)'
                      : 'Grande Chaussée Pavée (+90% vitesse, +30% prod.)'}
                </strong>
              </p>
              {zone.roadLevel < 2 && (() => {
                const nextLvl = (zone.roadLevel + 1) as 1 | 2;
                const rCfg = ROAD_UPGRADES[nextLvl];
                const disc = 1 - raceDef.bonuses.roadCostDiscount;
                const cW = Math.round(rCfg.cost.wood * disc);
                const cInt = Math.max(4, Math.round(rCfg.cost.intendance * disc));
                const canAfford =
                  state.resources.wood >= cW && state.resources.intendance >= cInt;

                return (
                  <button
                    type="button"
                    className="action-btn full-btn"
                    disabled={!canAfford}
                    onClick={() => onUpgradeRoad(zone.id)}
                  >
                    <div className="btn-top-line">
                      <span>
                        {rCfg.emoji} {rCfg.name}
                      </span>
                      <CostChips state={state} intendance={cInt} wood={cW} />
                    </div>
                    <small className="btn-sub">{rCfg.description}</small>
                  </button>
                );
              })()}
            </div>

            {/* C. Local Territory Improvements */}
            <div className="card">
              <div className="card-title">🏘️ Améliorations du Territoire</div>
              <div className="build-list">
                {(Object.keys(CIVIC_BUILDINGS) as CivicBuildingId[]).map((civId) => {
                  const cfg = CIVIC_BUILDINGS[civId];
                  const built = zone.civicBuildings.includes(civId);
                  if (built) {
                    return (
                      <div key={civId} className="built-pill">
                        <img src={CIVIC_SPRITES[civId]} alt="" className="mini-sprite-icon" />
                        <span>
                          {cfg.name} ✓ <small>({cfg.benefitTag})</small>
                        </span>
                      </div>
                    );
                  }
                  const canAfford =
                    state.resources.wood >= cfg.cost.wood &&
                    state.resources.intendance >= cfg.cost.intendance;

                  return (
                    <button
                      key={civId}
                      type="button"
                      className="action-btn full-btn"
                      disabled={!canAfford}
                      onClick={() => onBuildCivic(zone.id, civId)}
                    >
                      <div className="btn-top-line">
                        <span className="with-thumb">
                          <img src={CIVIC_SPRITES[civId]} alt="" className="mini-sprite-icon" />
                          <span>
                            {cfg.name} <em className="benefit-chip">{cfg.benefitTag}</em>
                          </span>
                        </span>
                        <CostChips
                          state={state}
                          intendance={cfg.cost.intendance}
                          wood={cfg.cost.wood}
                        />
                      </div>
                      <small className="btn-sub">{cfg.description}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            {zone.dungeon && renderDungeonBlock()}
            {renderArmiesBlock()}
          </>
        )}

        {/* 4. CAPITAL CITY VIEW (CLEAR AFTER INC SETTLEMENT UPGRADE + DISTRICTS) */}
        {zone.biome === 'capital' && capZone && (() => {
          const cityLvl = capZone.capitalBuildings.palace ?? 1;
          const palaceCfg = CAPITAL_BUILDINGS.palace;
          const palaceCost = getCapitalUpgradeCost('palace', cityLvl);
          const canUpgradeCity =
            cityLvl < palaceCfg.maxLevel &&
            state.resources.intendance >= palaceCost.intendance &&
            state.resources.wood >= palaceCost.wood;

          return (
            <>
              {/* Featured After Inc City Tier Card */}
              <div className="card city-tier-card">
                <div className="landmark-card-row">
                  <img src="/assets/sprites/capital.png" alt="" className="card-sprite-thumb" />
                  <div>
                    <div className="card-title">
                      🏰 {CITY_TIER_NAMES[cityLvl] ?? `Cité Niveau ${cityLvl}`}
                    </div>
                    <p className="small-muted">
                      Remparts : <strong>{Math.round(capZone.fortHp)}/{capZone.maxFortHp} PV</strong> • Population :{' '}
                      <strong>
                        {Math.floor(state.resources.population)}/{state.resources.maxPopulation}
                      </strong>
                    </p>
                  </div>
                </div>
                <p className="small-muted">{palaceCfg.description}</p>
                {cityLvl < palaceCfg.maxLevel ? (
                  <button
                    type="button"
                    className="primary-btn full-btn"
                    disabled={!canUpgradeCity}
                    onClick={() => onUpgradeCapital('palace')}
                  >
                    <div className="btn-top-line">
                      <span>
                        🏰 Agrandir la Cité → Niveau {cityLvl + 1}
                      </span>
                      <CostChips
                        state={state}
                        intendance={palaceCost.intendance}
                        wood={palaceCost.wood}
                      />
                    </div>
                    <small className="btn-sub">{palaceCfg.benefitTag}</small>
                  </button>
                ) : (
                  <div className="built-pill">
                    🏰 Métropole Légendaire atteinte (Niveau Maximum 5/5) ✓
                  </div>
                )}
              </div>

              {/* 1-Click Shortcut to Unit & Hero Recruitment */}
              <div className="card">
                <div className="card-title">⚔️ Recrutement Militaire & Héros</div>
                <p className="small-muted">
                  Recrutez vos Milices, Fantassins, Archers, Chevaliers, Unités Fantastiques et Héros avec votre 💰 Or !
                </p>
                <button
                  type="button"
                  className="primary-btn full-btn"
                  onClick={onOpenArmyModal}
                >
                  <span>⚔️ Ouvrir « Armée & Héros » (Recruter des troupes)</span>
                </button>
              </div>

              {/* Specialized Capital Districts */}
              <div className="card">
                <div className="card-title">🏛️ Quartiers de votre Cité</div>
                <div className="build-list">
                  {OTHER_CAPITAL_DISTRICTS.map((bId) => {
                    const cfg = CAPITAL_BUILDINGS[bId];
                    const cur = capZone.capitalBuildings[bId] ?? 0;
                    if (cur >= cfg.maxLevel) {
                      return (
                        <div key={bId} className="built-pill">
                          <span>
                            {cfg.emoji} {cfg.name} — Niv. {cur}/{cfg.maxLevel} ✓
                          </span>
                        </div>
                      );
                    }
                    const cost = getCapitalUpgradeCost(bId, cur);
                    const canAfford =
                      state.resources.intendance >= cost.intendance &&
                      state.resources.wood >= cost.wood;

                    return (
                      <button
                        key={bId}
                        type="button"
                        className="action-btn full-btn"
                        disabled={!canAfford}
                        onClick={() => onUpgradeCapital(bId)}
                      >
                        <div className="btn-top-line">
                          <span>
                            {cfg.emoji} {cfg.name}{' '}
                            <small>
                              (Niv.{cur}→{cur + 1})
                            </small>{' '}
                            <em className="benefit-chip">{cfg.benefitTag}</em>
                          </span>
                          <CostChips
                            state={state}
                            intendance={cost.intendance}
                            wood={cost.wood}
                          />
                        </div>
                        <small className="btn-sub">{cfg.description}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              {renderArmiesBlock()}
            </>
          );
        })()}
      </div>
    </aside>
  );
};
