import React, { useEffect, useMemo, useState } from 'react';
import {
  AdvisorBanner,
  getHighlightedGoalZoneId,
} from './components/AdvisorBanner';
import {
  ArmyAndHeroesModal,
  AuthorityCrisisModal,
  DungeonEventModal,
  EstatesCouncilModal,
  HowToPlayModal,
  NewGameModal,
} from './components/GameModals';
import { TopHud } from './components/TopHud';
import { WorldMap } from './components/WorldMap';
import { ZonePanel } from './components/ZonePanel';
import { BIOME_INFO, SEASONS } from './data/buildings';
import {
  actionAppeaseEstate,
  actionAssignHeroToArmy,
  actionBuildCivic,
  actionBuildOrUpgradeResource,
  actionClaimZone,
  actionExploreZone,
  actionMergeArmies,
  actionMoveArmy,
  actionRecruitHero,
  actionRecruitUnit,
  actionRepairZone,
  actionResolveAuthorityCrisis,
  actionResolveDungeonChoice,
  actionSendHeroToDungeon,
  actionSetTaxLevel,
  actionSplitHalfArmy,
  actionStartFestivities,
  actionUpgradeCapital,
  actionUpgradeRoad,
  countUnits,
  createInitialGameState,
  stepSimulation,
} from './engine/simulation';
import { DifficultyPace, GameState, Point, RaceId, Zone } from './types/game';

const STORAGE_KEY = 'mandea_save_v3';

function createDemoShowcaseState(mode: string): GameState {
  let st = createInitialGameState('humans', 734219, 'Mandea-la-Claire', 'normal');
  if (mode === 'start' || mode === 'army') return st;

  st = {
    ...st,
    resources: {
      ...st.resources,
      intendance: 60,
      maxIntendance: 75,
      food: 240,
      wood: 220,
      gold: 310,
      population: 68,
      maxPopulation: 95,
    },
  };
  const capNeighbors = st.zones[st.capitalZoneId]?.neighbors ?? [];
  for (const nId of capNeighbors.slice(0, 4)) {
    const nz = st.zones[nId];
    if (!nz || nz.staticMonster) continue;
    st = actionClaimZone(st, nId);
    st = {
      ...st,
      resources: { ...st.resources, intendance: 60, wood: 260, gold: 340 },
    };
    const resType = BIOME_INFO[nz.biome].allowedResource;
    if (resType) {
      st = actionBuildOrUpgradeResource(st, nId, resType);
      st = {
        ...st,
        resources: { ...st.resources, intendance: 60, wood: 260, gold: 340 },
      };
    }
    st = actionUpgradeRoad(st, nId);
  }
  if (capNeighbors[0]) {
    st = {
      ...st,
      resources: { ...st.resources, intendance: 60, wood: 260, gold: 340 },
    };
    st = actionBuildCivic(st, capNeighbors[0], 'wells');
  }
  if (capNeighbors[1]) {
    st = {
      ...st,
      resources: { ...st.resources, intendance: 60, wood: 260, gold: 340 },
    };
    st = actionBuildCivic(st, capNeighbors[1], 'market');
  }
  st = {
    ...st,
    resources: { ...st.resources, intendance: 54, wood: 145, gold: 210 },
  };
  st = actionUpgradeCapital(st, 'palace');
  st = {
    ...st,
    resources: { ...st.resources, intendance: 42, wood: 120, gold: 195 },
  };
  st = actionUpgradeCapital(st, 'cathedral');

  if (mode === 'pillaged' && capNeighbors[0] && st.zones[capNeighbors[0]]) {
    st = {
      ...st,
      zones: {
        ...st.zones,
        [capNeighbors[0]]: {
          ...st.zones[capNeighbors[0]],
          pillagedTimer: 65,
        },
      },
    };
  }

  return stepSimulation(st, 0.2);
}

export const App: React.FC = () => {
  const demoParam = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('demo');
  }, []);

  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      localStorage.removeItem('mandea_save_v1');
      localStorage.removeItem('mandea_save_v2');
      if (demoParam) {
        return createDemoShowcaseState(demoParam);
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GameState;
        if (
          parsed &&
          parsed.zones &&
          parsed.capitalZoneId &&
          typeof parsed.goalChapter === 'number'
        ) {
          return parsed;
        }
      }
    } catch {
      // Ignore corrupt save
    }
    return createInitialGameState('humans', 734219, undefined, 'normal');
  });

  const [showNewGameModal, setShowNewGameModal] = useState<boolean>(() => {
    if (demoParam) return false;
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [hasChosenInitialKingdom, setHasChosenInitialKingdom] = useState<boolean>(() => {
    if (demoParam) return true;
    return Boolean(localStorage.getItem(STORAGE_KEY));
  });

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(() => {
    if (demoParam === 'rich' || demoParam === 'pillaged') {
      return gameState.zones[gameState.capitalZoneId]?.neighbors[0] ?? null;
    }
    return null;
  });
  const [selectedArmyId, setSelectedArmyId] = useState<string | null>(
    () => Object.keys(gameState.armies)[0] ?? null
  );
  const [orderMoveModeArmyId, setOrderMoveModeArmyId] = useState<string | null>(null);
  const [resourceHintToast, setResourceHintToast] = useState<string | null>(null);

  const [armyModalOpen, setArmyModalOpen] = useState<boolean>(demoParam === 'army');
  const [estatesModalOpen, setEstatesModalOpen] = useState<boolean>(demoParam === 'council');
  const [helpModalOpen, setHelpModalOpen] = useState<boolean>(false);
  const [activeDungeonModalZoneId, setActiveDungeonModalZoneId] = useState<string | null>(null);

  const [zoom, setZoom] = useState<number>(1.04);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  // Main real-time simulation loop
  useEffect(() => {
    if (showNewGameModal) return;
    let lastTime = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setGameState((prev) => stepSimulation(prev, dt));
    }, 150);
    return () => window.clearInterval(id);
  }, [showNewGameModal]);

  // Periodic localStorage autosave
  useEffect(() => {
    if (!hasChosenInitialKingdom || gameState.gameOver || demoParam) return;
    const saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
      } catch {
        // Ignore quota errors
      }
    }, 1200);
    return () => window.clearTimeout(saveTimer);
  }, [gameState.totalTicks, hasChosenInitialKingdom, gameState.gameOver, demoParam]);

  // Auto-surface Dungeon Event modal when a Hero triggers a choice
  useEffect(() => {
    if (activeDungeonModalZoneId) return;
    const zoneWithEvent = gameState.zoneOrder.find((zId) =>
      Boolean(gameState.zones[zId]?.dungeon?.pendingEvent)
    );
    if (zoneWithEvent) {
      setActiveDungeonModalZoneId(zoneWithEvent);
    }
  }, [gameState.zones, gameState.zoneOrder, activeDungeonModalZoneId]);

  // Auto-hide resource hint toast
  useEffect(() => {
    if (!resourceHintToast) return;
    const t = window.setTimeout(() => setResourceHintToast(null), 5500);
    return () => window.clearTimeout(t);
  }, [resourceHintToast]);

  const advisorHighlightZoneId = useMemo(
    () => getHighlightedGoalZoneId(gameState),
    [gameState]
  );

  const handleStartNewGame = (
    race: RaceId,
    seed: number,
    kingdomName: string,
    pace: DifficultyPace
  ) => {
    const fresh = createInitialGameState(race, seed, kingdomName, pace);
    setGameState(fresh);
    setSelectedZoneId(null);
    setSelectedArmyId(Object.keys(fresh.armies)[0] ?? null);
    setOrderMoveModeArmyId(null);
    setZoom(1.06);
    setPan({ x: 0, y: 0 });
    setHasChosenInitialKingdom(true);
    setShowNewGameModal(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // Ignore
    }
  };

  const handleQuickSendArmyToZone = (destZoneId: string) => {
    const playerArmies = Object.values(gameState.armies).filter(
      (a) => a.owner === 'player' && countUnits(a.units) > 0
    );
    if (playerArmies.length === 0) return;
    playerArmies.sort((a, b) => countUnits(b.units) - countUnits(a.units));
    setGameState((prev) => actionMoveArmy(prev, playerArmies[0].id, destZoneId));
    setOrderMoveModeArmyId(null);
  };

  const findBestZoneForBiomes = (biomes: Zone['biome'][]): string | null => {
    const unbuiltClaimed = gameState.zoneOrder.find(
      (id) =>
        biomes.includes(gameState.zones[id]?.biome) &&
        gameState.zones[id]?.status === 'claimed' &&
        !gameState.zones[id]?.resourceBuilding
    );
    if (unbuiltClaimed) return unbuiltClaimed;

    const exploredAdj = gameState.zoneOrder.find(
      (id) =>
        biomes.includes(gameState.zones[id]?.biome) &&
        gameState.zones[id]?.status === 'explored' &&
        !gameState.zones[id]?.staticMonster &&
        gameState.zones[id]?.neighbors.some(
          (n) => gameState.zones[n]?.status === 'claimed'
        )
    );
    if (exploredAdj) return exploredAdj;

    return (
      gameState.zoneOrder.find(
        (id) =>
          biomes.includes(gameState.zones[id]?.biome) &&
          gameState.zones[id]?.status !== 'unexplored'
      ) ?? null
    );
  };

  const handleFocusResourceHint = (
    kind: 'intendance' | 'food' | 'wood' | 'gold' | 'city'
  ) => {
    if (kind === 'intendance' || kind === 'city') {
      setSelectedZoneId(gameState.capitalZoneId);
      setResourceHintToast(
        '⚡ Commandement : se recharge tout seul chaque seconde ! Agrandissez votre Cité pour en gagner plus vite.'
      );
      return;
    }
    if (kind === 'food') {
      const zId = findBestZoneForBiomes(['plains', 'pasture']);
      if (zId) setSelectedZoneId(zId);
      setResourceHintToast(
        '🌾 Comment avoir des Vivres : prenez une Plaine (Ferme) ou un Pâturage (Élevage qui produit même l’Hiver) !'
      );
      return;
    }
    if (kind === 'wood') {
      const zId = findBestZoneForBiomes(['forest']);
      if (zId) setSelectedZoneId(zId);
      setResourceHintToast(
        '🪵 Comment avoir du Bois : prenez une Forêt et bâtissez un Camp de Bûcherons (coûte 0 Bois au Niv. 1 !).'
      );
      return;
    }
    const zId = findBestZoneForBiomes(['hills', 'ruins']) ?? gameState.capitalZoneId;
    setSelectedZoneId(zId);
    setResourceHintToast(
      '💰 Comment avoir de l’Or : vos Impôts en rapportent automatiquement, et vous pouvez bâtir des Mines d’Or dans les Collines ou explorer des Donjons !'
    );
  };

  const cityLvl = gameState.zones[gameState.capitalZoneId]?.capitalBuildings.palace ?? 1;
  const totalSoldiers = Object.values(gameState.armies)
    .filter((a) => a.owner === 'player')
    .reduce((sum, a) => sum + countUnits(a.units), 0);
  const anyDisgrace =
    gameState.estates.peuple.inDisgrace ||
    gameState.estates.noblesse.inDisgrace ||
    gameState.estates.clerge.inDisgrace;
  const hasHeroAlert =
    gameState.zoneOrder.some((id) => Boolean(gameState.zones[id]?.dungeon?.pendingEvent)) ||
    (gameState.tavernPool.length > 0 && gameState.resources.gold >= 60);

  return (
    <div className={`app-shell season-${gameState.season}`}>
      <TopHud
        state={gameState}
        onSetSpeed={(s) => setGameState((prev) => ({ ...prev, speed: s }))}
        onFocusResourceHint={handleFocusResourceHint}
        onOpenHelp={() => setHelpModalOpen(true)}
        onOpenNewGame={() => setShowNewGameModal(true)}
      />

      <main className="game-stage">
        {resourceHintToast && (
          <div className="resource-hint-toast" role="status">
            <span>{resourceHintToast}</span>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setResourceHintToast(null)}
              aria-label="Fermer l’astuce"
            >
              ✕
            </button>
          </div>
        )}

        <WorldMap
          state={gameState}
          selectedZoneId={selectedZoneId}
          selectedArmyId={selectedArmyId}
          orderMoveModeArmyId={orderMoveModeArmyId}
          advisorHighlightZoneId={advisorHighlightZoneId}
          zoom={zoom}
          pan={pan}
          onChangeZoom={setZoom}
          onChangePan={setPan}
          onSelectZone={(zId) => setSelectedZoneId(zId)}
          onExploreZone={(zId) => setGameState((prev) => actionExploreZone(prev, zId))}
          onRepairZone={(zId) => setGameState((prev) => actionRepairZone(prev, zId))}
          onSelectArmy={(aId, zId) => {
            const clicked = gameState.armies[aId];
            setSelectedArmyId(aId);
            setSelectedZoneId(zId);
            if (clicked?.owner === 'player') {
              setOrderMoveModeArmyId((prev) => (prev === aId ? null : aId));
            }
          }}
          onOrderArmyMove={(armyId, destZoneId) => {
            setGameState((prev) => actionMoveArmy(prev, armyId, destZoneId));
            setOrderMoveModeArmyId(null);
            setSelectedZoneId(destZoneId);
          }}
          onCancelMoveMode={() => setOrderMoveModeArmyId(null)}
          onOpenDungeonEvent={(zId) => setActiveDungeonModalZoneId(zId)}
        />

        {/* Top-Left After Inc Goals Checklist + Urgent Live Alerts */}
        <AdvisorBanner
          state={gameState}
          onFocusZone={(zId) => setSelectedZoneId(zId)}
          onRepairZone={(zId) => setGameState((prev) => actionRepairZone(prev, zId))}
          onOpenDungeon={(zId) => setActiveDungeonModalZoneId(zId)}
          onOpenCity={() => setSelectedZoneId(gameState.capitalZoneId)}
          onOpenArmyModal={() => setArmyModalOpen(true)}
          onOpenEstatesModal={() => setEstatesModalOpen(true)}
        />

        {/* Bottom-Left Compact Journal + Camera Controls */}
        <div className="bottom-left-bar">
          <details className="chronicle-drawer">
            <summary>
              📜 Journal ({SEASONS[gameState.season].emoji} {SEASONS[gameState.season].name})
            </summary>
            <ul className="chronicle-list">
              {gameState.logs.slice(0, 6).map((lg) => (
                <li key={lg.id} className={`log-${lg.type}`}>
                  <span className="log-meta">An {lg.year}</span> {lg.text}
                </li>
              ))}
            </ul>
          </details>

          <div className="camera-pill" role="group" aria-label="Caméra de la carte">
            <button
              type="button"
              className="cam-btn"
              title="Recadrer la carte"
              aria-label="Recadrer la carte"
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoom(1.04);
              }}
            >
              🎯 Carte
            </button>
            <button
              type="button"
              className="cam-btn"
              title="Zoom +"
              aria-label="Zoom avant"
              onClick={() => setZoom((z) => Math.min(2.25, +(z + 0.18).toFixed(2)))}
            >
              +
            </button>
            <button
              type="button"
              className="cam-btn"
              title="Zoom −"
              aria-label="Zoom arrière"
              onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.18).toFixed(2)))}
            >
              −
            </button>
          </div>
        </div>

        {/* SIGNATURE AFTER INC BOTTOM ACTION DOCK */}
        <nav className="after-dock" aria-label="Commandes principales du Royaume">
          <button
            type="button"
            className={`dock-btn ${
              selectedZoneId === gameState.capitalZoneId ? 'active' : ''
            }`}
            onClick={() => {
              setSelectedZoneId((prev) =>
                prev === gameState.capitalZoneId ? null : gameState.capitalZoneId
              );
            }}
          >
            <span className="dock-emoji">🏰</span>
            <div className="dock-text">
              <strong>Ma Cité (Niv. {cityLvl})</strong>
              <small>Agrandir & Bâtiments</small>
            </div>
          </button>

          <button
            type="button"
            className="dock-btn dock-army-btn"
            onClick={() => setArmyModalOpen(true)}
          >
            <span className="dock-emoji">⚔️</span>
            <div className="dock-text">
              <strong>Armée & Héros ({totalSoldiers})</strong>
              <small>Recruter des Unités (💰 Or)</small>
            </div>
            {hasHeroAlert && <span className="dock-badge">!</span>}
          </button>

          <button
            type="button"
            className={`dock-btn ${
              anyDisgrace || gameState.authority < 35 ? 'dock-danger-pulse' : ''
            }`}
            onClick={() => setEstatesModalOpen(true)}
          >
            <span className="dock-emoji">👑</span>
            <div className="dock-text">
              <strong>
                Les 3 Ordres · Autorité {Math.round(gameState.authority)}%
              </strong>
              <small>
                🌾 {Math.round(gameState.estates.peuple.satisfaction)}% · ⚜️{' '}
                {Math.round(gameState.estates.noblesse.satisfaction)}% · ⛪{' '}
                {Math.round(gameState.estates.clerge.satisfaction)}%
              </small>
            </div>
          </button>
        </nav>

        <ZonePanel
          state={gameState}
          zoneId={selectedZoneId}
          selectedArmyId={selectedArmyId}
          orderMoveModeArmyId={orderMoveModeArmyId}
          onClose={() => setSelectedZoneId(null)}
          onExplore={(zId) => setGameState((prev) => actionExploreZone(prev, zId))}
          onClaim={(zId) => setGameState((prev) => actionClaimZone(prev, zId))}
          onRepair={(zId) => setGameState((prev) => actionRepairZone(prev, zId))}
          onBuildResource={(zId, t) =>
            setGameState((prev) => actionBuildOrUpgradeResource(prev, zId, t))
          }
          onBuildCivic={(zId, c) =>
            setGameState((prev) => actionBuildCivic(prev, zId, c))
          }
          onUpgradeRoad={(zId) => setGameState((prev) => actionUpgradeRoad(prev, zId))}
          onUpgradeCapital={(bId) =>
            setGameState((prev) => actionUpgradeCapital(prev, bId))
          }
          onOpenArmyModal={() => setArmyModalOpen(true)}
          onToggleMoveMode={(aId) => setOrderMoveModeArmyId(aId)}
          onSplitArmy={(aId) => setGameState((prev) => actionSplitHalfArmy(prev, aId))}
          onMergeArmies={(sId, dId) =>
            setGameState((prev) => actionMergeArmies(prev, sId, dId))
          }
          onAssignHero={(hId, aId) =>
            setGameState((prev) => actionAssignHeroToArmy(prev, hId, aId))
          }
          onSendHeroToDungeon={(hId, zId) =>
            setGameState((prev) => actionSendHeroToDungeon(prev, hId, zId))
          }
          onOpenDungeonEvent={(zId) => setActiveDungeonModalZoneId(zId)}
          onQuickSendArmyToZone={handleQuickSendArmyToZone}
        />
      </main>

      <NewGameModal
        open={showNewGameModal}
        canDismiss={hasChosenInitialKingdom}
        onClose={() => setShowNewGameModal(false)}
        onStartGame={handleStartNewGame}
      />

      <ArmyAndHeroesModal
        open={armyModalOpen}
        state={gameState}
        onClose={() => setArmyModalOpen(false)}
        onRecruitUnit={(uId, target) =>
          setGameState((prev) => actionRecruitUnit(prev, uId, target))
        }
        onRecruitHero={(hId) => setGameState((prev) => actionRecruitHero(prev, hId))}
        onAssignHero={(hId, aId) =>
          setGameState((prev) => actionAssignHeroToArmy(prev, hId, aId))
        }
        onSplitArmy={(aId) => setGameState((prev) => actionSplitHalfArmy(prev, aId))}
        onStartMoveArmyOnMap={(aId) => {
          setSelectedArmyId(aId);
          setOrderMoveModeArmyId(aId);
        }}
        onSendHeroToDungeon={(hId, zId) =>
          setGameState((prev) => actionSendHeroToDungeon(prev, hId, zId))
        }
        onOpenCityPanel={() => setSelectedZoneId(gameState.capitalZoneId)}
        onSelectZone={(zId) => setSelectedZoneId(zId)}
      />

      <EstatesCouncilModal
        open={estatesModalOpen}
        state={gameState}
        onClose={() => setEstatesModalOpen(false)}
        onSetTax={(est, tx) =>
          setGameState((prev) => actionSetTaxLevel(prev, est, tx))
        }
        onAppease={(est) => setGameState((prev) => actionAppeaseEstate(prev, est))}
        onStartFestivities={() =>
          setGameState((prev) => actionStartFestivities(prev))
        }
      />

      <HowToPlayModal open={helpModalOpen} onClose={() => setHelpModalOpen(false)} />

      <DungeonEventModal
        open={Boolean(activeDungeonModalZoneId)}
        zoneId={activeDungeonModalZoneId}
        state={gameState}
        onClose={() => setActiveDungeonModalZoneId(null)}
        onChoose={(zId, optId) => {
          setGameState((prev) => actionResolveDungeonChoice(prev, zId, optId));
          setActiveDungeonModalZoneId(null);
        }}
      />

      {(gameState.pendingAuthorityCrisis || gameState.gameOver) && (
        <AuthorityCrisisModal
          state={gameState}
          onDecision={(dec) =>
            setGameState((prev) => actionResolveAuthorityCrisis(prev, dec))
          }
          onRestart={() => {
            localStorage.removeItem(STORAGE_KEY);
            setShowNewGameModal(true);
          }}
        />
      )}
    </div>
  );
};
