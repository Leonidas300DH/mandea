import React, { useEffect, useState } from 'react';
import {
  AuthorityCrisisModal,
  DungeonEventModal,
  EstatesCouncilModal,
  NewGameModal,
  TavernHeroesModal,
} from './components/GameModals';
import { TopHud } from './components/TopHud';
import { WorldMap } from './components/WorldMap';
import { ZonePanel } from './components/ZonePanel';
import { SEASONS } from './data/buildings';
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

const STORAGE_KEY = 'mandea_save_v1';

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
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
    return createInitialGameState('humans', 428192);
  });

  const [showNewGameModal, setShowNewGameModal] = useState<boolean>(() => {
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [hasChosenInitialKingdom, setHasChosenInitialKingdom] = useState<boolean>(() => {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  });

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(() => gameState.capitalZoneId);
  const [selectedArmyId, setSelectedArmyId] = useState<string | null>(null);
  const [orderMoveModeArmyId, setOrderMoveModeArmyId] = useState<string | null>(null);

  const [estatesModalOpen, setEstatesModalOpen] = useState(false);
  const [tavernModalOpen, setTavernModalOpen] = useState(false);
  const [activeDungeonModalZoneId, setActiveDungeonModalZoneId] = useState<string | null>(null);

  const [zoom, setZoom] = useState<number>(1.05);
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
    if (!hasChosenInitialKingdom || gameState.gameOver) return;
    const saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
      } catch {
        // Ignore quota errors
      }
    }, 1200);
    return () => window.clearTimeout(saveTimer);
  }, [gameState.totalTicks, hasChosenInitialKingdom, gameState.gameOver]);

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

  const handleStartNewGame = (race: RaceId, seed: number, kingdomName: string) => {
    const fresh = createInitialGameState(race, seed, kingdomName);
    setGameState(fresh);
    setSelectedZoneId(fresh.capitalZoneId);
    setSelectedArmyId(Object.keys(fresh.armies)[0] ?? null);
    setOrderMoveModeArmyId(null);
    setZoom(1.08);
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
  };

  return (
    <div className={`app-shell season-${gameState.season}`}>
      <TopHud
        state={gameState}
        onSetSpeed={(s) => setGameState((prev) => ({ ...prev, speed: s }))}
        onOpenEstates={() => setEstatesModalOpen(true)}
        onOpenTavern={() => setTavernModalOpen(true)}
        onOpenNewGame={() => setShowNewGameModal(true)}
        onZoomIn={() => setZoom((z) => Math.min(2.35, +(z + 0.18).toFixed(2)))}
        onZoomOut={() => setZoom((z) => Math.max(0.58, +(z - 0.18).toFixed(2)))}
        onCenterCapital={() => {
          setPan({ x: 0, y: 0 });
          setZoom(1.1);
          setSelectedZoneId(gameState.capitalZoneId);
        }}
      />

      <main className="game-stage">
        <WorldMap
          state={gameState}
          selectedZoneId={selectedZoneId}
          selectedArmyId={selectedArmyId}
          orderMoveModeArmyId={orderMoveModeArmyId}
          zoom={zoom}
          pan={pan}
          onChangeZoom={setZoom}
          onChangePan={setPan}
          onSelectZone={(zId) => setSelectedZoneId(zId)}
          onSelectArmy={(aId, zId) => {
            setSelectedArmyId(aId);
            setSelectedZoneId(zId);
          }}
          onOrderArmyMove={(armyId, destZoneId) => {
            setGameState((prev) => actionMoveArmy(prev, armyId, destZoneId));
            setOrderMoveModeArmyId(null);
            setSelectedZoneId(destZoneId);
          }}
          onOpenDungeonEvent={(zId) => setActiveDungeonModalZoneId(zId)}
        />

        {/* Compact Bottom-Left Chronicle Log */}
        <details className="chronicle-drawer" open>
          <summary>
            📜 Chronique de {gameState.kingdomName} ({SEASONS[gameState.season].emoji}{' '}
            {SEASONS[gameState.season].subtitle})
          </summary>
          <ul className="chronicle-list">
            {gameState.logs.slice(0, 6).map((lg) => (
              <li key={lg.id} className={`log-${lg.type}`}>
                <span className="log-meta">An {lg.year}</span> {lg.text}
              </li>
            ))}
          </ul>
        </details>

        <ZonePanel
          state={gameState}
          zoneId={selectedZoneId}
          selectedArmyId={selectedArmyId}
          orderMoveModeArmyId={orderMoveModeArmyId}
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
