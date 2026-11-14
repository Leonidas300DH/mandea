import React, { useEffect, useMemo, useState } from 'react';
import { AdvisorBanner, computeAdvisorStep } from './components/AdvisorBanner';
import {
  AuthorityCrisisModal,
  DungeonEventModal,
  EstatesCouncilModal,
  HowToPlayModal,
  NewGameModal,
  TavernHeroesModal,
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
import { GameState, Point, RaceId } from './types/game';

const STORAGE_KEY = 'mandea_save_v2';

function createDemoShowcaseState(mode: string): GameState {
  let st = createInitialGameState('humans', 734219, 'Mandea-la-Claire');
  if (mode !== 'rich') return st;

  // Build a rich mid-game showcase with Farms, Barn, Lumber, Mine, Roads & Civic sprites visible!
  st = {
    ...st,
    resources: {
      ...st.resources,
      intendance: 85,
      food: 240,
      wood: 220,
      iron: 160,
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
      resources: { ...st.resources, intendance: 85, wood: 260, iron: 180, gold: 340 },
    };
    const resType = BIOME_INFO[nz.biome].allowedResource;
    if (resType) {
      st = actionBuildOrUpgradeResource(st, nId, resType);
      st = {
        ...st,
        resources: { ...st.resources, intendance: 85, wood: 260, iron: 180, gold: 340 },
      };
    }
    st = actionUpgradeRoad(st, nId);
  }
  if (capNeighbors[0]) {
    st = {
      ...st,
      resources: { ...st.resources, intendance: 85, wood: 260, iron: 180, gold: 340 },
    };
    st = actionBuildCivic(st, capNeighbors[0], 'wells');
  }
  if (capNeighbors[1]) {
    st = {
      ...st,
      resources: { ...st.resources, intendance: 85, wood: 260, iron: 180, gold: 340 },
    };
    st = actionBuildCivic(st, capNeighbors[1], 'market');
  }
  st = {
    ...st,
    resources: { ...st.resources, intendance: 68, wood: 145, iron: 82, gold: 190 },
  };
  st = actionUpgradeCapital(st, 'cathedral');
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
      if (demoParam) {
        return createDemoShowcaseState(demoParam);
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GameState;
        if (parsed && parsed.zones && parsed.capitalZoneId) {
          return parsed;
        }
      }
    } catch {
      // Ignore corrupt save
    }
    return createInitialGameState('humans', 734219);
  });

  const [showNewGameModal, setShowNewGameModal] = useState<boolean>(() => {
    if (demoParam) return false;
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [hasChosenInitialKingdom, setHasChosenInitialKingdom] = useState<boolean>(() => {
    if (demoParam) return true;
    return Boolean(localStorage.getItem(STORAGE_KEY));
  });

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(() =>
    demoParam === 'rich' ? gameState.zones[gameState.capitalZoneId]?.neighbors[0] ?? null : null
  );
  const [selectedArmyId, setSelectedArmyId] = useState<string | null>(null);
  const [orderMoveModeArmyId, setOrderMoveModeArmyId] = useState<string | null>(null);
  const [defaultCapTab, setDefaultCapTab] = useState<'build' | 'recruit' | 'armies' | undefined>(
    undefined
  );

  const [estatesModalOpen, setEstatesModalOpen] = useState<boolean>(demoParam === 'council');
  const [tavernModalOpen, setTavernModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [activeDungeonModalZoneId, setActiveDungeonModalZoneId] = useState<string | null>(null);

  // Comfortable initial zoom framing the whole island & starter ring cleanly!
  const [zoom, setZoom] = useState<number>(0.96);
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
    const zoneWithEvent = gameState.zoneOrder.find(
      (zId) => Boolean(gameState.zones[zId]?.dungeon?.pendingEvent)
    );
    if (zoneWithEvent) {
      setActiveDungeonModalZoneId(zoneWithEvent);
    }
  }, [gameState.zones, gameState.zoneOrder, activeDungeonModalZoneId]);

  const advisorStep = useMemo(() => computeAdvisorStep(gameState), [gameState]);

  const handleStartNewGame = (race: RaceId, seed: number, kingdomName: string) => {
    const fresh = createInitialGameState(race, seed, kingdomName);
    setGameState(fresh);
    setSelectedZoneId(null);
    setSelectedArmyId(Object.keys(fresh.armies)[0] ?? null);
    setOrderMoveModeArmyId(null);
    setZoom(1.16);
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

  return (
    <div className={`app-shell season-${gameState.season}`}>
      <TopHud
        state={gameState}
        onSetSpeed={(s) => setGameState((prev) => ({ ...prev, speed: s }))}
        onOpenEstates={() => setEstatesModalOpen(true)}
        onOpenTavern={() => setTavernModalOpen(true)}
        onOpenHelp={() => setHelpModalOpen(true)}
        onOpenNewGame={() => setShowNewGameModal(true)}
      />

      <main className="game-stage">
        <WorldMap
          state={gameState}
          selectedZoneId={selectedZoneId}
          selectedArmyId={selectedArmyId}
          orderMoveModeArmyId={orderMoveModeArmyId}
          advisorHighlightZoneId={advisorStep.targetZoneId}
          zoom={zoom}
          pan={pan}
          onChangeZoom={setZoom}
          onChangePan={setPan}
          onSelectZone={(zId) => {
            setDefaultCapTab(undefined);
            setSelectedZoneId(zId);
          }}
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
          onOpenDungeonEvent={(zId) => setActiveDungeonModalZoneId(zId)}
        />

        {/* Top-Left Step-by-Step Regent Advisor */}
        <AdvisorBanner
          step={advisorStep}
          onFocusZone={(zId) => {
            if (zId === gameState.capitalZoneId && advisorStep.stepNum === 5) {
              setDefaultCapTab('recruit');
            } else {
              setDefaultCapTab(undefined);
            }
            setSelectedZoneId(zId);
            if (gameState.zones[zId]?.dungeon?.pendingEvent) {
              setActiveDungeonModalZoneId(zId);
            }
          }}
          onOpenHelp={() => setHelpModalOpen(true)}
        />

        {/* Bottom-Left Controls: Compact Chronicle + Map Camera Pill */}
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
              title="Centrer et inspecter la Capitale"
              aria-label="Centrer sur la Capitale"
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoom(0.96);
                setSelectedZoneId(gameState.capitalZoneId);
              }}
            >
              🏰 Capitale
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

        <ZonePanel
          state={gameState}
          zoneId={selectedZoneId}
          selectedArmyId={selectedArmyId}
          orderMoveModeArmyId={orderMoveModeArmyId}
          defaultCapitalTab={defaultCapTab}
          onClose={() => setSelectedZoneId(null)}
          onExplore={(zId) => setGameState((prev) => actionExploreZone(prev, zId))}
          onClaim={(zId) => setGameState((prev) => actionClaimZone(prev, zId))}
          onBuildResource={(zId, t) =>
            setGameState((prev) => actionBuildOrUpgradeResource(prev, zId, t))
          }
          onBuildCivic={(zId, c) => setGameState((prev) => actionBuildCivic(prev, zId, c))}
          onUpgradeRoad={(zId) => setGameState((prev) => actionUpgradeRoad(prev, zId))}
          onUpgradeCapital={(bId) => setGameState((prev) => actionUpgradeCapital(prev, bId))}
          onRecruitUnit={(uId, target) =>
            setGameState((prev) => actionRecruitUnit(prev, uId, target))
          }
          onToggleMoveMode={(aId) => setOrderMoveModeArmyId(aId)}
          onSplitArmy={(aId) => setGameState((prev) => actionSplitHalfArmy(prev, aId))}
          onMergeArmies={(sId, dId) => setGameState((prev) => actionMergeArmies(prev, sId, dId))}
          onAssignHero={(hId, aId) => setGameState((prev) => actionAssignHeroToArmy(prev, hId, aId))}
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

      <EstatesCouncilModal
        open={estatesModalOpen}
        state={gameState}
        onClose={() => setEstatesModalOpen(false)}
        onSetTax={(est, tx) => setGameState((prev) => actionSetTaxLevel(prev, est, tx))}
        onAppease={(est) => setGameState((prev) => actionAppeaseEstate(prev, est))}
        onStartFestivities={() => setGameState((prev) => actionStartFestivities(prev))}
      />

      <TavernHeroesModal
        open={tavernModalOpen}
        state={gameState}
        onClose={() => setTavernModalOpen(false)}
        onRecruitHero={(hId) => setGameState((prev) => actionRecruitHero(prev, hId))}
        onSelectZone={(zId) => setSelectedZoneId(zId)}
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
          onDecision={(dec) => setGameState((prev) => actionResolveAuthorityCrisis(prev, dec))}
          onRestart={() => {
            localStorage.removeItem(STORAGE_KEY);
            setShowNewGameModal(true);
          }}
        />
      )}
    </div>
  );
};
