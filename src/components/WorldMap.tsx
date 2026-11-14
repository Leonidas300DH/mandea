import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BIOME_INFO } from '../data/buildings';
import { MAP_HEIGHT, MAP_WIDTH } from '../engine/mapGenerator';
import {
  buildStaticMapCache,
  PIXEL_H,
  PIXEL_W,
  renderPixelTerrainToImageData,
} from '../engine/pixelTerrain';
import {
  countUnits,
  getExploreCost,
  getRepairCost,
} from '../engine/simulation';
import {
  Army,
  CivicBuildingId,
  GameState,
  Point,
  ResourceBuildingType,
  Zone,
} from '../types/game';

interface WorldMapProps {
  state: GameState;
  selectedZoneId: string | null;
  selectedArmyId: string | null;
  orderMoveModeArmyId: string | null;
  advisorHighlightZoneId: string | null;
  zoom: number;
  pan: Point;
  onChangeZoom: (z: number) => void;
  onChangePan: (p: Point) => void;
  onSelectZone: (zoneId: string) => void;
  onExploreZone: (zoneId: string) => void;
  onRepairZone: (zoneId: string) => void;
  onSelectArmy: (armyId: string, zoneId: string) => void;
  onOrderArmyMove: (armyId: string, destZoneId: string) => void;
  onCancelMoveMode: () => void;
  onOpenDungeonEvent: (zoneId: string) => void;
}

const RESOURCE_SPRITES: Record<ResourceBuildingType, string> = {
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

const CIVIC_OFFSETS: Point[] = [
  { x: -56, y: 18 },
  { x: 56, y: 18 },
  { x: -52, y: -28 },
  { x: 52, y: -28 },
];

export const WorldMap: React.FC<WorldMapProps> = ({
  state,
  selectedZoneId,
  selectedArmyId,
  orderMoveModeArmyId,
  advisorHighlightZoneId,
  zoom,
  pan,
  onChangeZoom,
  onChangePan,
  onSelectZone,
  onExploreZone,
  onRepairZone,
  onSelectArmy,
  onOrderArmyMove,
  onCancelMoveMode,
  onOpenDungeonEvent,
}) => {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const dragStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
    moved: false,
  });

  // 1. Precompute static organic pixel terrain cache once per map seed
  const staticCache = useMemo(() => buildStaticMapCache(state), [state.seed]);

  // 2. Signature of visual terrain state so canvas only repaints when season/borders/roads/hover change
  const terrainKey = useMemo(() => {
    const zoneBits = state.zoneOrder
      .map((id) => {
        const z = state.zones[id];
        return `${z.status[0]}${z.roadLevel}`;
      })
      .join('');
    return `${state.seed}|${state.race}|${state.season}|${selectedZoneId ?? ''}|${hoveredZoneId ?? ''}|${orderMoveModeArmyId ? 1 : 0}|${zoneBits}`;
  }, [
    state.seed,
    state.race,
    state.season,
    state.zoneOrder,
    state.zones,
    selectedZoneId,
    hoveredZoneId,
    orderMoveModeArmyId,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(PIXEL_W, PIXEL_H);
    renderPixelTerrainToImageData(
      imgData,
      staticCache,
      state,
      selectedZoneId,
      hoveredZoneId,
      Boolean(orderMoveModeArmyId)
    );
    ctx.putImageData(imgData, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrainKey, staticCache]);

  const getZoneCenter = (zoneId: string): Point => {
    return (
      staticCache.visualCentersWorld[zoneId] ??
      state.zones[zoneId]?.center ?? { x: 800, y: 525 }
    );
  };

  // Map pointer event on viewport -> exact organic pixel cell in `staticCache`
  const pickZoneFromPointer = (clientX: number, clientY: number): Zone | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    if (relX < 0 || relX >= 1 || relY < 0 || relY >= 1) return null;

    const px = Math.min(PIXEL_W - 1, Math.max(0, Math.floor(relX * PIXEL_W)));
    const py = Math.min(PIXEL_H - 1, Math.max(0, Math.floor(relY * PIXEL_H)));
    const idx = py * PIXEL_W + px;
    if (staticCache.isWaterGrid[idx]) return null;

    const zId = staticCache.zoneIds[staticCache.zoneIdxGrid[idx]];
    return state.zones[zId] ?? null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        dragStartRef.current.moved = true;
      }
      onChangePan({
        x: Math.max(-720, Math.min(720, dragStartRef.current.panX + dx)),
        y: Math.max(-480, Math.min(480, dragStartRef.current.panY + dy)),
      });
      return;
    }

    const hit = pickZoneFromPointer(e.clientX, e.clientY);
    const nextHover = hit ? hit.id : null;
    if (nextHover !== hoveredZoneId) {
      setHoveredZoneId(nextHover);
    }
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const handleBoardClick = (e: React.MouseEvent) => {
    if (dragStartRef.current.moved) return;
    const z = pickZoneFromPointer(e.clientX, e.clientY);
    if (!z || z.biome === 'water') {
      if (orderMoveModeArmyId) onCancelMoveMode();
      return;
    }

    if (orderMoveModeArmyId && z.status !== 'unexplored') {
      onOrderArmyMove(orderMoveModeArmyId, z.id);
      return;
    }
    onSelectZone(z.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const activeArmyId = orderMoveModeArmyId ?? selectedArmyId;
    if (!activeArmyId) return;
    const army = state.armies[activeArmyId];
    if (!army || army.owner !== 'player') return;

    const z = pickZoneFromPointer(e.clientX, e.clientY);
    if (z && z.biome !== 'water' && z.status !== 'unexplored') {
      e.preventDefault();
      onOrderArmyMove(activeArmyId, z.id);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const next = Math.max(0.7, Math.min(2.25, +(zoom * factor).toFixed(2)));
    onChangeZoom(next);
  };

  const getArmyPos = (army: Army, indexInZone: number): Point => {
    const curC = getZoneCenter(army.zoneId);
    if (army.path.length > 0 && army.moveProgress > 0) {
      const nextC = getZoneCenter(army.path[0]);
      return {
        x: curC.x + (nextC.x - curC.x) * army.moveProgress,
        y: curC.y + (nextC.y - curC.y) * army.moveProgress,
      };
    }
    const isCap = army.zoneId === state.capitalZoneId;
    if (isCap) {
      const capAngles = [-0.22, -2.85, 0.75, 2.35];
      const ang = capAngles[indexInZone % capAngles.length];
      return {
        x: curC.x + Math.cos(ang) * 76,
        y: curC.y + Math.sin(ang) * 52,
      };
    }
    const baseAngle = army.owner === 'player' ? -0.35 : 2.65;
    const angle = baseAngle + indexInZone * 1.25;
    return {
      x: curC.x + Math.cos(angle) * 48,
      y: curC.y + Math.sin(angle) * 36,
    };
  };

  const armiesList = Object.values(state.armies).filter((a) => countUnits(a.units) > 0);
  const moveArmy = orderMoveModeArmyId ? state.armies[orderMoveModeArmyId] : null;
  const exploreCost = getExploreCost(state);
  const repairCost = getRepairCost();

  return (
    <div
      className={`map-viewport ${
        orderMoveModeArmyId ? 'cursor-crosshair' : dragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        setDragging(false);
        setHoveredZoneId(null);
      }}
      onWheel={handleWheel}
      onClick={handleBoardClick}
      onContextMenu={handleContextMenu}
    >
      <div
        ref={boardRef}
        className="world-board"
        style={{
          width: `${MAP_WIDTH}px`,
          height: `${MAP_HEIGHT}px`,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* 1. True Pixel-Art Organic Terrain Canvas (Strictly NO Hexagons!) */}
        <canvas
          ref={canvasRef}
          width={PIXEL_W}
          height={PIXEL_H}
          className="pixel-terrain-canvas"
        />

        {/* 2. Vector Path Overlay for Marching Arrows & Threat Sonars */}
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="map-vector-overlay"
        >
          {armiesList.map((army) => {
            if (army.path.length === 0) return null;
            const pts: Point[] = [getArmyPos(army, 0)];
            for (const stepZId of army.path) {
              pts.push(getZoneCenter(stepZId));
            }
            const d = pts
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
              .join(' ');
            return (
              <path
                key={`path_${army.id}`}
                d={d}
                fill="none"
                stroke={army.owner === 'player' ? '#fde047' : '#ef4444'}
                strokeWidth={4}
                strokeDasharray="9 6"
                strokeLinecap="round"
              />
            );
          })}

          {/* Raider Advance Warning */}
          {state.raiderWarningZoneId && state.zones[state.raiderWarningZoneId] && (() => {
            const wc = getZoneCenter(state.raiderWarningZoneId);
            return (
              <g transform={`translate(${wc.x}, ${wc.y})`}>
                <circle
                  r="42"
                  fill="rgba(249, 115, 22, 0.2)"
                  stroke="#f97316"
                  strokeWidth="3"
                  className="sonar-pulse"
                />
                <circle r="18" fill="rgba(194, 65, 12, 0.9)" stroke="#fef08a" strokeWidth="2" />
                <text x="0" y="6" textAnchor="middle" fontSize="15">
                  ⚠️
                </text>
              </g>
            );
          })()}

          {/* Invasion Advance Warning */}
          {state.invasionWarningZoneId && state.zones[state.invasionWarningZoneId] && (() => {
            const wc = getZoneCenter(state.invasionWarningZoneId);
            return (
              <g transform={`translate(${wc.x}, ${wc.y})`}>
                <circle
                  r="48"
                  fill="rgba(239, 68, 68, 0.22)"
                  stroke="#ef4444"
                  strokeWidth="3"
                  className="sonar-pulse"
                />
                <circle r="20" fill="rgba(185, 28, 28, 0.9)" stroke="#fef08a" strokeWidth="2" />
                <text x="0" y="6" textAnchor="middle" fontSize="16">
                  📯
                </text>
              </g>
            );
          })()}
        </svg>

        {/* 3. Pixel-Art Landmarks, 1-Click Actions & Clear Resource Labels */}
        {state.zoneOrder.map((zId) => {
          const z = state.zones[zId];
          if (!z || z.biome === 'water') return null;

          const pos = getZoneCenter(z.id);
          const isSelected = selectedZoneId === z.id;
          const isHovered = hoveredZoneId === z.id;
          const isAdvisorTarget = advisorHighlightZoneId === z.id;
          const biomeCfg = BIOME_INFO[z.biome];

          // A. UNEXPLORED FRONTIER -> 1-Click Explore Button right on the fog!
          if (z.status === 'unexplored') {
            const canExplore = z.neighbors.some(
              (nId) => state.zones[nId]?.status !== 'unexplored'
            );
            if (!canExplore) return null;
            const enoughStamina = state.resources.intendance >= exploreCost;

            return (
              <button
                key={z.id}
                type="button"
                className={`map-anchor frontier-explore-btn ${
                  isHovered || isSelected || isAdvisorTarget ? 'expanded' : ''
                } ${!enoughStamina ? 'wait-stamina' : ''}`}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                title={
                  enoughStamina
                    ? `Explorer ce territoire (coûte ⚡ ${exploreCost} Commandement)`
                    : `Attendez ⚡ ${exploreCost} Commandement pour explorer`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (enoughStamina) {
                    onExploreZone(z.id);
                  } else {
                    onSelectZone(z.id);
                  }
                }}
              >
                <span className="compass-orb">🔍</span>
                <span className="frontier-label">
                  Explorer <strong className="frontier-cost">⚡{exploreCost}</strong>
                </span>
              </button>
            );
          }

          // B. CAPITAL CITY
          if (z.biome === 'capital') {
            const cityTier = z.capitalBuildings.palace ?? 1;
            const wallsTier = z.capitalBuildings.walls ?? 1;
            const castleSize = Math.min(146, 106 + (cityTier + wallsTier) * 6);

            return (
              <div
                key={z.id}
                className={`map-anchor zone-landmark ${isSelected ? 'is-selected' : ''}`}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              >
                {orderMoveModeArmyId && <div className="move-target-ring" />}

                {(z.capitalBuildings.grand_market ?? 0) >= 1 && (
                  <img
                    src="/assets/sprites/market.png"
                    alt=""
                    className="pixel-sprite sub-district"
                    style={{ width: '54px', transform: 'translate(-66px, 20px)' }}
                  />
                )}
                {(z.capitalBuildings.cathedral ?? 0) >= 1 && (
                  <img
                    src="/assets/sprites/chapel.png"
                    alt=""
                    className="pixel-sprite sub-district"
                    style={{ width: '52px', transform: 'translate(64px, -12px)' }}
                  />
                )}
                {(z.capitalBuildings.walls ?? 0) >= 2 && (
                  <img
                    src="/assets/sprites/fort.png"
                    alt=""
                    className="pixel-sprite sub-district"
                    style={{ width: '54px', transform: 'translate(-62px, -24px)' }}
                  />
                )}

                <img
                  src="/assets/sprites/capital.png"
                  alt={z.name}
                  className="pixel-sprite main-landmark"
                  style={{ width: `${castleSize}px` }}
                />

                <div className="map-plate capital-plate">
                  <span>
                    🏰 {z.name} · Niv.{cityTier}
                  </span>
                </div>
              </div>
            );
          }

          // C. EXPLORED OR CLAIMED PROVINCE
          const resB = z.resourceBuilding;
          const resSize = resB ? 74 + resB.level * 10 : 0;
          const isPillaged = z.pillagedTimer > 0;

          return (
            <div
              key={z.id}
              className={`map-anchor zone-landmark ${isSelected ? 'is-selected' : ''} ${
                isAdvisorTarget ? 'advisor-pulse' : ''
              }`}
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              {orderMoveModeArmyId && <div className="move-target-ring" />}

              {/* Visible Local Civic Upgrades */}
              {z.status === 'claimed' &&
                z.civicBuildings.map((civId, idx) => {
                  const off = CIVIC_OFFSETS[idx % CIVIC_OFFSETS.length];
                  return (
                    <img
                      key={civId}
                      src={CIVIC_SPRITES[civId]}
                      alt=""
                      className="pixel-sprite civic-sprite"
                      style={{
                        width: '44px',
                        transform: `translate(${off.x}px, ${off.y}px)`,
                      }}
                    />
                  );
                })}

              {/* Primary Resource Exploitation Sprite */}
              {z.status === 'claimed' && resB && (
                <div className="res-sprite-wrap">
                  <img
                    src={RESOURCE_SPRITES[resB.type]}
                    alt=""
                    className={`pixel-sprite main-landmark ${isPillaged ? 'damaged-sprite' : ''}`}
                    style={{ width: `${resSize}px` }}
                  />
                  <span className="level-stars">{'★'.repeat(resB.level)}</span>
                </div>
              )}

              {/* Unimproved Claimed Province Prompt */}
              {z.status === 'claimed' && !resB && !z.dungeon && !isPillaged && (
                <div className="empty-claimed-badge">
                  <span>🏗️ Bâtir ({biomeCfg.emoji})</span>
                </div>
              )}

              {/* Static Territorial Monster Boss Sprite */}
              {z.staticMonster && (
                <div className="monster-wrap">
                  <img
                    src="/assets/sprites/monster.png"
                    alt={z.staticMonster.name}
                    className="pixel-sprite monster-sprite"
                  />
                  <span className="threat-pill">🐉 {z.staticMonster.name.split(' ')[0]}</span>
                </div>
              )}

              {/* Ancient Dungeon Portal Sprite */}
              {z.dungeon && (
                <div
                  className={`dungeon-wrap ${z.dungeon.pendingEvent ? 'has-event' : ''}`}
                  style={{
                    transform: resB ? 'translate(54px, -28px)' : 'translate(0px, -4px)',
                  }}
                  onClick={(e) => {
                    if (z.dungeon?.pendingEvent) {
                      e.stopPropagation();
                      onOpenDungeonEvent(z.id);
                    }
                  }}
                >
                  <img
                    src="/assets/sprites/dungeon.png"
                    alt={z.dungeon.name}
                    className="pixel-sprite dungeon-sprite"
                  />
                  <span className={`dungeon-pill ${z.dungeon.cleared ? 'cleared' : ''}`}>
                    {z.dungeon.cleared
                      ? '✓ Purifié'
                      : `🗝️ Donjon ${'★'.repeat(z.dungeon.stars)}`}
                  </span>
                  {z.dungeon.activeHeroId && !z.dungeon.cleared && (
                    <div className="map-mini-progress">
                      <div style={{ width: `${z.dungeon.progress}%` }} />
                    </div>
                  )}
                  {z.dungeon.pendingEvent && <span className="event-bang">!</span>}
                </div>
              )}

              {/* 1-CLICK REPAIR BUTTON directly on Pillaged Provinces! */}
              {isPillaged && (
                <button
                  type="button"
                  className="pillaged-repair-btn"
                  title="Cliquez pour réparer immédiatement cette province (⚡ 6 Commandement)"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (state.resources.intendance >= repairCost) {
                      onRepairZone(z.id);
                    } else {
                      onSelectZone(z.id);
                    }
                  }}
                >
                  🔥 Pillé — <strong>🔨 Réparer (⚡{repairCost})</strong>
                </button>
              )}

              {/* Province Name / Clear Yield Hint */}
              {isSelected || isHovered || z.status === 'seceded' ? (
                <div
                  className={`map-plate ${
                    z.status === 'claimed'
                      ? 'claimed-plate'
                      : z.status === 'seceded'
                        ? 'seceded-plate'
                        : 'wild-plate'
                  }`}
                >
                  <span>
                    {biomeCfg.emoji} {z.name}
                    {z.status === 'explored' ? ` · ${biomeCfg.mapHint}` : ''}
                  </span>
                </div>
              ) : (
                !resB &&
                !z.staticMonster &&
                !z.dungeon &&
                z.status === 'explored' && (
                  <div
                    className="biome-whisper-chip"
                    title={`${biomeCfg.name} — Cliquez pour prendre ce territoire`}
                  >
                    {biomeCfg.mapHint}
                  </div>
                )
              )}
            </div>
          );
        })}

        {/* 4. Pixel-Art Stackable Army Standees */}
        {armiesList.map((army, idx) => {
          const z = state.zones[army.zoneId];
          if (!z || z.status === 'unexplored') return null;
          const pos = getArmyPos(army, idx % 4);
          const total = countUnits(army.units);
          const isPlayer = army.owner === 'player';
          const isSelected = selectedArmyId === army.id || moveArmy?.id === army.id;

          return (
            <button
              key={army.id}
              type="button"
              className={`map-anchor army-token ${isPlayer ? 'player-army' : 'enemy-army'} ${
                isSelected ? 'selected' : ''
              }`}
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              title={
                isPlayer
                  ? `${army.name} (${total} soldats) — Cliquez pour sélectionner puis cliquez sur une zone pour la déplacer`
                  : `${army.name} (${total} ennemis)`
              }
              onClick={(e) => {
                e.stopPropagation();
                if (orderMoveModeArmyId && !isPlayer) {
                  onOrderArmyMove(orderMoveModeArmyId, army.zoneId);
                  return;
                }
                onSelectArmy(army.id, army.zoneId);
              }}
            >
              <img
                src={
                  isPlayer
                    ? '/assets/sprites/army_player.png'
                    : '/assets/sprites/army_enemy.png'
                }
                alt={army.name}
                className="pixel-sprite army-sprite"
              />
              <span className={`army-count-pill ${isPlayer ? 'ally' : 'foe'}`}>
                {army.heroId ? '👑 ' : isPlayer ? '🛡️ ' : '⚔️ '}
                {total}
              </span>
            </button>
          );
        })}

        {/* 5. Active Tactical Battle Clash Banner */}
        {Object.values(state.battles).map((b) => {
          const pos = getZoneCenter(b.zoneId);
          return (
            <div
              key={`bat_${b.zoneId}`}
              className="map-anchor battle-clash-tag"
              style={{ left: `${pos.x}px`, top: `${pos.y - 54}px` }}
            >
              ⚔️ {b.phase === 'ranged' ? 'Tir à distance' : 'Choc de mêlée'} (R{b.round})
            </div>
          );
        })}
      </div>

      {/* Move-mode instruction bar with Cancel button */}
      {moveArmy && (
        <div className="move-order-banner">
          <span>
            🚩 <strong>{moveArmy.name} prête :</strong> cliquez sur une zone de la carte pour l’y envoyer
          </span>
          <button
            type="button"
            className="move-cancel-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCancelMoveMode();
            }}
          >
            ✕ Annuler
          </button>
        </div>
      )}
    </div>
  );
};
