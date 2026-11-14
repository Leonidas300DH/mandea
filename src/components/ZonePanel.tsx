import React, { useEffect, useState } from 'react';
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
  defaultCapitalTab?: 'build' | 'recruit' | 'armies';
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
  manor: '/assets/sprites/fort.png',
  watchtower: '/assets/sprites/fort.png',
  fort: '/assets/sprites/fort.png',
};

const CostChips: React.FC<{
  state: GameState;
  intendance?: number;
  food?: number;
  wood?: number;
  iron?: number;
  gold?: number;
}> = ({ state, intendance = 0, food = 0, wood = 0, iron = 0, gold = 0 }) => {
  const items: { icon: string; name: string; need: number; have: number }[] = [];
  if (intendance > 0)
    items.push({ icon: '⚡', name: 'Intendance', need: intendance, have: state.resources.intendance });
  if (food > 0)
    items.push({ icon: '🌾', name: 'Vivres', need: food, have: state.resources.food });
  if (wood > 0)
    items.push({ icon: '🪵', name: 'Bois', need: wood, have: state.resources.wood });
  if (iron > 0)
    items.push({ icon: '⛏️', name: 'Fer', need: iron, have: state.resources.iron });
  if (gold > 0)
    items.push({ icon: '💰', name: 'Or', need: gold, have: state.resources.gold });

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

export const ZonePanel: React.FC<ZonePanelProps> = ({
  state,
  zoneId,
  selectedArmyId,
  orderMoveModeArmyId,
  defaultCapitalTab,
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
  const [capTab, setCapTab] = useState<'build' | 'recruit' | 'armies'>('build');
  const [provTab, setProvTab] = useState<'develop' | 'troops'>('develop');

  useEffect(() => {
    if (defaultCapitalTab) {
      setCapTab(defaultCapitalTab);
    }
  }, [defaultCapitalTab]);

  // If user clicks an army on the map, automatically switch to the Armies tab so they see it immediately!
  useEffect(() => {
    if (!selectedArmyId || !zoneId) return;
    const army = state.armies[selectedArmyId];
    if (army && army.zoneId === zoneId) {
      if (zoneId === state.capitalZoneId) setCapTab('armies');
      else setProvTab('troops');
    }
  }, [selectedArmyId, zoneId, state.armies, state.capitalZoneId]);

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
  const anyPlayerArmyAnywhere = Object.values(state.armies).some(
    (a) => a.owner === 'player' && countUnits(a.units) > 0
  );
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
    <div className="panel-section">
      {playerArmiesHere.length === 0 && enemyArmiesHere.length === 0 ? (
        <div className="empty-state-box">
          <p className="small-muted">Aucune compagnie militaire stationnée dans cette province.</p>
          {anyPlayerArmyAnywhere && zone.status !== 'unexplored' && (
            <button
              type="button"
              className="action-btn full-btn"
              onClick={() => onQuickSendArmyToZone(zone.id)}
            >
              🚩 Faire venir mon Armée dans cette province
            </button>
          )}
        </div>
      ) : (
        <>
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
        </>
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
              {dng.name} <span className="gold-stars">{'★'.repeat(dng.stars)}</span>
            </div>
            <p className="small-muted">
              Donjon antique à explorer avec un Héros pour gagner Or et Reliques.
            </p>
          </div>
        </div>
        {dng.corrupted && !dng.cleared && (
          <p className="warn-text">
            🕯️ Lieu profané : mécontente le Clergé (-11) tant qu’il n’est pas purifié.
          </p>
        )}
        {dng.cleared ? (
          <p className="ok-text">✅ Donjon purifié et exploré !</p>
        ) : dng.pendingEvent ? (
          <button
            type="button"
            className="primary-btn full-btn"
            onClick={() => onOpenDungeonEvent(zone.id)}
          >
            ❗ Choisir l’action du Héros (Palier {dng.stage}/{dng.maxStages})
          </button>
        ) : dng.activeHeroId ? (
          <div>
            <p className="small-muted">
              <strong>{state.heroes[dng.activeHeroId]?.name}</strong> explore le Palier {dng.stage}/
              {dng.maxStages} ({Math.round(dng.progress)}%)
            </p>
            <div className="progress-bar">
              <div style={{ width: `${dng.progress}%` }} />
            </div>
          </div>
        ) : availableHeroesForDungeon.length === 0 ? (
          <p className="warn-text">Aucun Héros libre (recrutez-en via le bouton Héros en haut).</p>
        ) : (
          <div className="build-list">
            {availableHeroesForDungeon.map((h) => (
              <button
                key={h.id}
                type="button"
                className="primary-btn full-btn"
                onClick={() => onSendHeroToDungeon(h.id, zone.id)}
              >
                <span>🗡️ Envoyer {h.name} (Niv.{h.level}) dans le Donjon</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="zone-panel" aria-label={`Province ${zone.name}`}>
      <div className="panel-header">
        <div>
          <span
            className={`status-tag status-${zone.status}`}
          >
            {zone.status === 'claimed'
              ? '👑 Domaine Royal'
              : zone.status === 'seceded'
                ? '🏴 Sécession'
                : zone.status === 'explored'
                  ? '🌿 Terre Sauvage'
                  : '☁️ Terres Brumeuses'}
          </span>
          <h2>
            {biomeCfg.emoji} {zone.name}
          </h2>
          <div className="biome-sub">{biomeCfg.name}</div>
        </div>
        <button type="button" className="close-panel-btn" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>

      {/* TABS FOR CAPITAL OR CLAIMED PROVINCE */}
      {zone.biome === 'capital' && (
        <div className="panel-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={capTab === 'build'}
            className={`panel-tab ${capTab === 'build' ? 'active' : ''}`}
            onClick={() => setCapTab('build')}
          >
            🏛️ Bâtir
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={capTab === 'recruit'}
            className={`panel-tab ${capTab === 'recruit' ? 'active' : ''}`}
            onClick={() => setCapTab('recruit')}
          >
            ⚔️ Recruter
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={capTab === 'armies'}
            className={`panel-tab ${capTab === 'armies' ? 'active' : ''}`}
            onClick={() => setCapTab('armies')}
          >
            🚩 Armées ({playerArmiesHere.length})
          </button>
        </div>
      )}

      {zone.status === 'claimed' && zone.biome !== 'capital' && (
        <div className="panel-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={provTab === 'develop'}
            className={`panel-tab ${provTab === 'develop' ? 'active' : ''}`}
            onClick={() => setProvTab('develop')}
          >
            🏗️ Aménager
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={provTab === 'troops'}
            className={`panel-tab ${provTab === 'troops' ? 'active' : ''}`}
            onClick={() => setProvTab('troops')}
          >
            🚩 Troupes & Lieux ({zoneArmies.length + (zone.dungeon ? 1 : 0)})
          </button>
        </div>
      )}

      <div className="panel-scroll">
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
            <p className="small-muted">
              Envoyez vos éclaireurs dissiper les brumes pour révéler les ressources, Donjons ou Monstres de cette province.
            </p>
            {canExplore ? (
              <button
                type="button"
                className="primary-btn full-btn"
                disabled={state.resources.intendance < exploreCost}
                onClick={() => onExplore(zone.id)}
              >
                <div className="btn-top-line">
                  <span>🧭 Explorer cette province</span>
                  <CostChips state={state} intendance={exploreCost} />
                </div>
              </button>
            ) : (
              <p className="warn-text">Explorez d’abord une province voisine déjà visible.</p>
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
                    <p className="small-muted">{zone.staticMonster.description}</p>
                  </div>
                </div>
                <p className="reward-line">
                  Butin : <strong>+{zone.staticMonster.rewardGold} 💰 Or</strong> &{' '}
                  <strong>+{zone.staticMonster.rewardIron} ⛏️ Fer</strong>
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

            {renderDungeonBlock()}

            <div className="card">
              <div className="card-title">🚩 Annexer au Royaume</div>
              <p className="small-muted">{biomeCfg.description}</p>
              {biomeCfg.allowedResource && (
                <div className="potential-box">
                  <img
                    src={RES_SPRITES[biomeCfg.allowedResource]}
                    alt=""
                    className="mini-sprite-icon"
                  />
                  <span>
                    Permet de bâtir :{' '}
                    <strong>{RESOURCE_BUILDINGS[biomeCfg.allowedResource].name}</strong>
                  </span>
                </div>
              )}

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
                  <div className="btn-top-line">
                    <span>🚩 Annexer la province</span>
                    <CostChips
                      state={state}
                      intendance={claimCost.intendance}
                      wood={claimCost.wood}
                      gold={claimCost.gold}
                    />
                  </div>
                </button>
              ) : !adjacentToClaimed ? (
                <p className="warn-text">
                  Doit toucher une province déjà rattachée à votre Royaume.
                </p>
              ) : (
                <p className="warn-text">
                  Chassez d’abord le Monstre ou les ennemis présents sur place !
                </p>
              )}
            </div>

            {renderArmiesBlock()}
          </>
        )}

        {/* 3. CLAIMED PROVINCE VIEW */}
        {zone.status === 'claimed' && zone.biome !== 'capital' && provTab === 'develop' && (
          <>
            {/* Primary Resource Exploitation */}
            <div className="card">
              <div className="card-title">🌾 Exploitation Principale</div>
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
                            {cfg.name} — <strong>Niveau Max (★★★)</strong>
                          </span>
                        </div>
                      );
                    }

                    const mult = curLvl === 0 ? 1 : curLvl === 1 ? 1.55 : 2.2;
                    const cW = Math.round(cfg.baseCost.wood * mult);
                    const cI = Math.round(
                      (cfg.baseCost.iron + (curLvl > 0 ? 6 * curLvl : 0)) * mult
                    );
                    const cG = Math.round(cfg.baseCost.gold * mult);
                    const cInt = Math.round(cfg.baseCost.intendance * (curLvl === 0 ? 1 : 1.15));
                    const canAfford =
                      state.resources.wood >= cW &&
                      state.resources.iron >= cI &&
                      state.resources.gold >= cG &&
                      state.resources.intendance >= cInt;

                    return (
                      <div key={rType} className="visual-build-card">
                        <div className="landmark-card-row">
                          <img src={RES_SPRITES[rType]} alt="" className="card-sprite-thumb" />
                          <div>
                            <strong>
                              {cfg.name} {curLvl > 0 && `(Niv.${curLvl}/3)`}
                            </strong>
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
                              {curLvl === 0 ? `Construire` : `Améliorer → Niv.${curLvl + 1}`}
                            </span>
                            <CostChips
                              state={state}
                              intendance={cInt}
                              wood={cW}
                              iron={cI}
                              gold={cG}
                            />
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Roads */}
            <div className="card">
              <div className="card-title">🛤️ Routes & Logistique</div>
              <p className="small-muted">
                Actuel :{' '}
                <strong>
                  {zone.roadLevel === 0
                    ? 'Sentier de terre'
                    : zone.roadLevel === 1
                      ? 'Route Empierrée (+45% vit., +12% prod.)'
                      : 'Grande Chaussée Royale (+90% vit., +25% prod.)'}
                </strong>
              </p>
              {zone.roadLevel < 2 && (() => {
                const nextLvl = (zone.roadLevel + 1) as 1 | 2;
                const rCfg = ROAD_UPGRADES[nextLvl];
                const disc = 1 - raceDef.bonuses.roadCostDiscount;
                const cW = Math.round(rCfg.cost.wood * disc);
                const cI = Math.round(rCfg.cost.iron * disc);
                const cG = Math.round(rCfg.cost.gold * disc);
                const cInt = Math.max(4, Math.round(rCfg.cost.intendance * disc));
                const canAfford =
                  state.resources.wood >= cW &&
                  state.resources.iron >= cI &&
                  state.resources.gold >= cG &&
                  state.resources.intendance >= cInt;

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
                      <CostChips state={state} intendance={cInt} wood={cW} iron={cI} gold={cG} />
                    </div>
                    <small className="btn-sub">{rCfg.description}</small>
                  </button>
                );
              })()}
            </div>

            {/* Local Civic & Defense Buildings */}
            <div className="card">
              <div className="card-title">🏘️ Aménagements de la Province</div>
              <div className="build-list">
                {(Object.keys(CIVIC_BUILDINGS) as CivicBuildingId[]).map((civId) => {
                  const cfg = CIVIC_BUILDINGS[civId];
                  const built = zone.civicBuildings.includes(civId);
                  if (built) {
                    return (
                      <div key={civId} className="built-pill">
                        <img src={CIVIC_SPRITES[civId]} alt="" className="mini-sprite-icon" />
                        <span>{cfg.name} ✓</span>
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
                      <div className="btn-top-line">
                        <span className="with-thumb">
                          <img src={CIVIC_SPRITES[civId]} alt="" className="mini-sprite-icon" />
                          {cfg.name}
                        </span>
                        <CostChips
                          state={state}
                          intendance={cfg.cost.intendance}
                          wood={cfg.cost.wood}
                          iron={cfg.cost.iron}
                          gold={cfg.cost.gold}
                        />
                      </div>
                      <small className="btn-sub">{cfg.description}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            {zone.dungeon && renderDungeonBlock()}
          </>
        )}

        {zone.status === 'claimed' && zone.biome !== 'capital' && provTab === 'troops' && (
          <>
            {renderDungeonBlock()}
            {renderArmiesBlock()}
          </>
        )}

        {/* 4. CAPITAL METROPOLIS VIEW (3 CLEAN TABS) */}
        {zone.biome === 'capital' && capZone && capTab === 'build' && (
          <div className="card">
            <div className="card-title">
              🏰 Quartiers de la Capitale (Remparts {Math.round(capZone.fortHp)}/
              {capZone.maxFortHp} PV)
            </div>
            <div className="build-list">
              {(Object.keys(CAPITAL_BUILDINGS) as CapitalBuildingId[]).map((bId) => {
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
                    <div className="btn-top-line">
                      <span>
                        {cfg.emoji} {cfg.name} <small>(Niv.{cur}→{cur + 1})</small>
                      </span>
                      <CostChips
                        state={state}
                        intendance={cInt}
                        wood={cW}
                        iron={cI}
                        gold={cG}
                      />
                    </div>
                    <small className="btn-sub">{cfg.description}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {zone.biome === 'capital' && capZone && capTab === 'recruit' && (
          <div className="card">
            <div className="card-title">⚔️ Recrutement Militaire ({raceDef.name})</div>
            <p className="small-muted">
              Les soldats recrutés rejoignent votre Compagnie à la Capitale. Combinez infanterie, tireurs et unités fantastiques !
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
                      <div className="unit-head-line">
                        <strong>
                          {u.badgeEmoji} {u.name}
                        </strong>
                        <span className="unit-stats-line">
                          PV {u.hp} • ATQ {u.meleeAtk}
                          {u.rangedAtk > 0 ? ` • Tir ${u.rangedAtk}` : ''}
                        </span>
                      </div>
                      <small className="small-muted">
                        {locked && reqB
                          ? `🔒 Construisez d’abord « ${CAPITAL_BUILDINGS[reqB].name} » (onglet Bâtir)`
                          : u.description}
                      </small>
                    </div>
                    {!locked && (
                      <div className="unit-recruit-btns">
                        <button
                          type="button"
                          className="primary-btn full-btn"
                          disabled={!canAfford}
                          onClick={() => onRecruitUnit(u.id, selectedArmyId ?? undefined)}
                        >
                          <div className="btn-top-line">
                            <span>+ Recruter dans l’Armée</span>
                            <CostChips
                              state={state}
                              food={u.cost.food}
                              wood={u.cost.wood}
                              iron={u.cost.iron}
                              gold={cGold}
                            />
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {zone.biome === 'capital' && capTab === 'armies' && renderArmiesBlock()}
      </div>
    </aside>
  );
};
