import React, { useMemo, useRef, useState } from 'react';
import { SEASONS } from '../data/buildings';
import { RACES } from '../data/races';
import { createRng, MAP_HEIGHT, MAP_WIDTH } from '../engine/mapGenerator';
import { countUnits } from '../engine/simulation';
import { Army, BiomeType, GameState, Point, Zone } from '../types/game';
import {
  PixelCapitalComplex,
  PixelCivicBadge,
  PixelMountain,
  PixelResourceBuilding,
  PixelTree,
} from './PixelSprites';

interface WorldMapProps {
  state: GameState;
  selectedZoneId: string | null;
  selectedArmyId: string | null;
  orderMoveModeArmyId: string | null;
  zoom: number;
  pan: Point;
  onChangeZoom: (z: number) => void;
  onChangePan: (p: Point) => void;
  onSelectZone: (zoneId: string) => void;
  onSelectArmy: (armyId: string, zoneId: string) => void;
  onOrderArmyMove: (armyId: string, destZoneId: string) => void;
  onOpenDungeonEvent: (zoneId: string) => void;
}

const CIVIC_OFFSETS: Point[] = [
  { x: -30, y: -18 },
  { x: 30, y: -18 },
  { x: -34, y: 14 },
  { x: 34, y: 14 },
  { x: 0, y: -30 },
  { x: 0, y: 28 },
];

export const WorldMap: React.FC<WorldMapProps> = ({
  state,
  selectedZoneId,
  selectedArmyId,
  orderMoveModeArmyId,
  zoom,
  pan,
  onChangeZoom,
  onChangePan,
  onSelectZone,
  onSelectArmy,
  onOrderArmyMove,
  onOpenDungeonEvent,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
    moved: false,
  });

  const seasonCfg = SEASONS[state.season];
  const pal = seasonCfg.palette;
  const raceDef = RACES[state.race];

  const getBiomeFill = (biome: BiomeType): string => {
    switch (biome) {
      case 'capital':
        return pal.capitalFill;
      case 'plains':
        return pal.plainsFill;
      case 'pasture':
        return pal.pastureFill;
      case 'forest':
        return pal.forestFill;
      case 'hills':
        return pal.hillsFill;
      case 'marsh':
        return pal.marshFill;
      case 'ruins':
        return pal.ruinsFill;
      case 'water':
        return pal.waterShallow;
    }
  };

  // Precompute deterministic nature props per zone
  const natureDecor = useMemo(() => {
    const map: Record<string, { trees: { x: number; y: number; v: number }[]; peaks: { x: number; y: number }[] }> = {};
    for (const zId of state.zoneOrder) {
      const z = state.zones[zId];
      if (!z || z.biome === 'water' || z.biome === 'capital') continue;
      const rng = createRng(z.decorSeed);
      const trees: { x: number; y: number; v: number }[] = [];
      const peaks: { x: number; y: number }[] = [];

      const treeCount = z.biome === 'forest' ? 9 : z.biome === 'pasture' || z.biome === 'marsh' ? 3 : 2;
      for (let i = 0; i < treeCount; i++) {
        const angle = (i / treeCount) * Math.PI * 2 + rng() * 0.6;
        const rad = 24 + rng() * 28;
        trees.push({
          x: z.center.x + Math.cos(angle) * rad,
          y: z.center.y + Math.sin(angle) * rad * 0.82,
          v: i,
        });
      }

      if (z.biome === 'hills') {
        for (let i = 0; i < 3; i++) {
          const angle = i * 2.1 + 0.4;
          peaks.push({
            x: z.center.x + Math.cos(angle) * 28,
            y: z.center.y + Math.sin(angle) * 20,
          });
        }
      }
      map[zId] = { trees, peaks };
    }
    return map;
  }, [state.seed, state.zoneOrder, state.zones]);

  // Visible Road Connections between adjacent roaded/claimed zones
  const roadLinks = useMemo(() => {
    const links: { key: string; from: Point; mid: Point; to: Point; level: 1 | 2 }[] = [];
    const seen = new Set<string>();
    for (const zId of state.zoneOrder) {
      const z = state.zones[zId];
      if (!z || z.status !== 'claimed' || z.roadLevel === 0) continue;
      for (const nId of z.neighbors) {
        const nz = state.zones[nId];
        if (!nz || nz.status !== 'claimed') continue;
        const pairKey = zId < nId ? `${zId}-${nId}` : `${nId}-${zId}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const maxRoad = Math.max(z.roadLevel, nz.roadLevel) as 1 | 2;
        const mx = (z.center.x + nz.center.x) * 0.5 + ((z.decorSeed % 17) - 8);
        const my = (z.center.y + nz.center.y) * 0.5 + (((z.decorSeed >> 3) % 17) - 8);
        links.push({
          key: pairKey,
          from: z.center,
          mid: { x: mx, y: my },
          to: nz.center,
          level: maxRoad,
        });
      }
    }
    return links;
  }, [state.zoneOrder, state.zones]);

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
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 5) {
      dragStartRef.current.moved = true;
    }
    onChangePan({
      x: Math.max(-750, Math.min(750, dragStartRef.current.panX + dx)),
      y: Math.max(-520, Math.min(520, dragStartRef.current.panY + dy)),
    });
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const next = Math.max(0.58, Math.min(2.35, +(zoom * factor).toFixed(2)));
    onChangeZoom(next);
  };

  const handleZoneClick = (zone: Zone) => {
    if (dragStartRef.current.moved) return;
    if (zone.biome === 'water') return;

    if (orderMoveModeArmyId && zone.status !== 'unexplored') {
      onOrderArmyMove(orderMoveModeArmyId, zone.id);
      return;
    }
    onSelectZone(zone.id);
  };

  // Compute interpolated army screen position on map
  const getArmyPos = (army: Army, indexInZone: number): Point => {
    const curZ = state.zones[army.zoneId];
    if (!curZ) return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    if (army.path.length > 0 && army.moveProgress > 0) {
      const nextZ = state.zones[army.path[0]];
      if (nextZ) {
        return {
          x: curZ.center.x + (nextZ.center.x - curZ.center.x) * army.moveProgress,
          y: curZ.center.y + (nextZ.center.y - curZ.center.y) * army.moveProgress,
        };
      }
    }
    const offsetAngle = indexInZone * 1.9 + (army.owner === 'player' ? -0.7 : 0.8);
    const offsetDist = army.zoneId === state.capitalZoneId ? 38 : 22;
    return {
      x: curZ.center.x + Math.cos(offsetAngle) * offsetDist,
      y: curZ.center.y + Math.sin(offsetAngle) * offsetDist - 8,
    };
  };

  const armiesList = Object.values(state.armies).filter((a) => countUnits(a.units) > 0);
  const selectedMoveArmy = orderMoveModeArmyId ? state.armies[orderMoveModeArmyId] : null;

  return (
    <div
      ref={containerRef}
      className={`map-viewport ${orderMoveModeArmyId ? 'cursor-crosshair' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="world-svg"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <defs>
          <pattern id="fogPattern" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill={pal.fogFill} />
            <rect x="0" y="0" width="4" height="4" fill="rgba(120, 95, 60, 0.08)" />
            <rect x="8" y="8" width="4" height="4" fill="rgba(120, 95, 60, 0.08)" />
          </pattern>
          <pattern id="waterRipples" width="32" height="16" patternUnits="userSpaceOnUse">
            <rect width="32" height="16" fill={pal.waterDeep} />
            <rect x="4" y="4" width="10" height="2" fill="rgba(255,255,255,0.16)" />
            <rect x="18" y="11" width="8" height="2" fill="rgba(255,255,255,0.12)" />
          </pattern>
        </defs>

        {/* Deep Ocean Backdrop */}
        <rect x="-400" y="-400" width={MAP_WIDTH + 800} height={MAP_HEIGHT + 800} fill="url(#waterRipples)" />

        {/* 1. Organic Territory Polygons */}
        {state.zoneOrder.map((zId) => {
          const z = state.zones[zId];
          if (!z) return null;
          if (z.biome === 'water') {
            return (
              <path
                key={z.id}
                d={z.smoothPath}
                fill="url(#waterRipples)"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            );
          }

          const isSelected = selectedZoneId === z.id;
          const isUnexplored = z.status === 'unexplored';
          const isClaimed = z.status === 'claimed';
          const isSeceded = z.status === 'seceded';
          const canExplore =
            isUnexplored && z.neighbors.some((nId) => state.zones[nId]?.status !== 'unexplored');

          return (
            <g
              key={z.id}
              onClick={() => handleZoneClick(z)}
              className="zone-group"
              style={{ cursor: 'pointer' }}
            >
              {/* Coastal pixel foam outline */}
              {z.isCoastal && (
                <path
                  d={z.smoothPath}
                  fill="none"
                  stroke="#bae6fd"
                  strokeWidth={6}
                  strokeLinejoin="round"
                  opacity={0.65}
                />
              )}

              {/* Base Organic Territory Fill */}
              <path
                d={z.smoothPath}
                fill={isUnexplored ? 'url(#fogPattern)' : getBiomeFill(z.biome)}
                stroke={
                  isSelected
                    ? '#fde047'
                    : isSeceded
                      ? '#9333ea'
                      : isClaimed
                        ? raceDef.borderColor
                        : isUnexplored
                          ? 'rgba(120, 98, 70, 0.38)'
                          : 'rgba(30, 41, 59, 0.42)'
                }
                strokeWidth={isSelected ? 4.5 : isClaimed || isSeceded ? 3.4 : 1.6}
                strokeDasharray={!isClaimed && !isSeceded && !isSelected ? '5 3' : undefined}
                strokeLinejoin="round"
              />

              {/* Subtle Faction Tint on Claimed Territories */}
              {isClaimed && (
                <path d={z.smoothPath} fill={raceDef.territoryTint} pointerEvents="none" />
              )}
              {isSeceded && (
                <path d={z.smoothPath} fill="rgba(147, 51, 234, 0.24)" pointerEvents="none" />
              )}

              {/* Can-Explore Subtle Highlight */}
              {canExplore && (
                <g transform={`translate(${z.center.x}, ${z.center.y})`} pointerEvents="none">
                  <rect
                    x="-28"
                    y="-11"
                    width="56"
                    height="22"
                    rx="4"
                    fill="rgba(30, 41, 59, 0.72)"
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#fef08a"
                    fontSize="10"
                    fontFamily="'Silkscreen', monospace"
                  >
                    EXPLORER
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 2. Meandering Organic Rivers */}
        {state.rivers.map((riv, idx) => {
          const d = riv.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(' ');
          return (
            <g key={`riv_${idx}`} pointerEvents="none">
              <path d={d} fill="none" stroke="#1d4ed8" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke="#67e8f9" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}

        {/* 3. Visible Road Network Connecting Provinces! */}
        {roadLinks.map((lnk) => {
          const d = `M ${lnk.from.x.toFixed(1)} ${lnk.from.y.toFixed(1)} Q ${lnk.mid.x.toFixed(1)} ${lnk.mid.y.toFixed(1)} ${lnk.to.x.toFixed(1)} ${lnk.to.y.toFixed(1)}`;
          return (
            <g key={lnk.key} pointerEvents="none">
              {lnk.level === 2 ? (
                <>
                  {/* Grande Chaussée Pavée Royale */}
                  <path d={d} fill="none" stroke="#475569" strokeWidth={9} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="#fde68a" strokeWidth={5.5} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 6" strokeLinecap="round" />
                </>
              ) : (
                <>
                  {/* Route Empierrée */}
                  <path d={d} fill="none" stroke="#78350f" strokeWidth={6} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="#d6d3d1" strokeWidth={3.2} strokeDasharray="5 4" strokeLinecap="round" />
                </>
              )}
            </g>
          );
        })}

        {/* 4. Nature Pixel Sprites & VISIBLE ZONE IMPROVEMENTS ON SCREEN */}
        {state.zoneOrder.map((zId) => {
          const z = state.zones[zId];
          if (!z || z.biome === 'water' || z.status === 'unexplored') return null;
          const decor = natureDecor[zId];

          return (
            <g key={`props_${z.id}`} pointerEvents="none">
              {/* Mountains & Trees */}
              {decor?.peaks.map((pk, idx) => (
                <PixelMountain key={`pk_${idx}`} x={pk.x} y={pk.y} season={state.season} />
              ))}
              {decor?.trees.map((tr, idx) => {
                // Leave room in the center when buildings are built
                if (z.resourceBuilding && Math.hypot(tr.x - z.center.x, tr.y - z.center.y) < 30) {
                  return null;
                }
                return (
                  <PixelTree
                    key={`tr_${idx}`}
                    x={tr.x}
                    y={tr.y}
                    season={state.season}
                    variant={tr.v}
                  />
                );
              })}

              {/* CAPITAL VISUAL METROPOLIS */}
              {z.biome === 'capital' && (
                <PixelCapitalComplex
                  x={z.center.x}
                  y={z.center.y}
                  buildings={z.capitalBuildings}
                  season={state.season}
                  primaryColor={raceDef.primaryColor}
                  secondaryColor={raceDef.secondaryColor}
                />
              )}

              {/* TERRITORY RESOURCE BUILDING (Farms + Crops, Livestock + Sheep, Lumber + Sawmill, Mine) */}
              {z.resourceBuilding && (
                <PixelResourceBuilding
                  x={z.center.x}
                  y={z.center.y}
                  type={z.resourceBuilding.type}
                  level={z.resourceBuilding.level}
                  season={state.season}
                  primaryColor={raceDef.primaryColor}
                />
              )}

              {/* TERRITORY CIVIC & DEFENSE BUILDINGS (Wells, Market, Chapel, Manor, Watchtower, Fort) */}
              {z.civicBuildings.map((civId, i) => {
                const off = CIVIC_OFFSETS[i % CIVIC_OFFSETS.length];
                return (
                  <PixelCivicBadge
                    key={civId}
                    civicId={civId}
                    x={z.center.x + off.x}
                    y={z.center.y + off.y}
                    season={state.season}
                    primaryColor={raceDef.primaryColor}
                  />
                );
              })}

              {/* Pillaged / Burning Smoke Overlay */}
              {z.pillagedTimer > 0 && (
                <g transform={`translate(${z.center.x}, ${z.center.y - 6})`} shapeRendering="crispEdges">
                  <rect x="-10" y="-6" width="8" height="10" fill="#ef4444" />
                  <rect x="-8" y="-10" width="6" height="6" fill="#f97316" />
                  <rect x="2" y="-4" width="7" height="8" fill="#fbbf24" />
                  <text x="0" y="16" textAnchor="middle" fill="#fee2e2" fontSize="9" fontWeight="bold">
                    🔥 PILLÉ
                  </text>
                </g>
              )}

              {/* Static Territorial Monster Boss! */}
              {z.staticMonster && (
                <g transform={`translate(${z.center.x}, ${z.center.y - 4})`}>
                  <circle r="17" fill="rgba(127, 29, 29, 0.88)" stroke="#fbbf24" strokeWidth="2" />
                  <text x="0" y="5" textAnchor="middle" fontSize="16">
                    {z.staticMonster.kind === 'wyvern' ? '🐉' : z.staticMonster.kind === 'spider_queen' ? '🕷️' : '👹'}
                  </text>
                  <rect x="-26" y="19" width="52" height="12" rx="3" fill="#450a0a" />
                  <text x="0" y="28" textAnchor="middle" fill="#fca5a5" fontSize="8" fontWeight="700">
                    GARDIEN
                  </text>
                </g>
              )}

              {/* Zone Name Plate */}
              <g transform={`translate(${z.center.x}, ${z.center.y + (z.biome === 'capital' ? 38 : 32)})`}>
                <rect
                  x="-52"
                  y="-9"
                  width="104"
                  height="15"
                  rx="3"
                  fill={z.biome === 'capital' ? 'rgba(15, 23, 42, 0.86)' : 'rgba(15, 23, 42, 0.62)'}
                />
                <text
                  x="0"
                  y="2"
                  textAnchor="middle"
                  fill={z.status === 'claimed' ? '#fef08a' : z.status === 'seceded' ? '#e9d5ff' : '#e2e8f0'}
                  fontSize={z.biome === 'capital' ? '10' : '8.5'}
                  fontWeight="700"
                >
                  {z.name}
                </text>
              </g>
            </g>
          );
        })}

        {/* 5. Interactive Dungeon Portals on Map */}
        {state.zoneOrder.map((zId) => {
          const z = state.zones[zId];
          if (!z?.dungeon || z.status === 'unexplored') return null;
          const dng = z.dungeon;
          const px = z.center.x + 28;
          const py = z.center.y - 24;

          return (
            <g
              key={`dng_${z.id}`}
              transform={`translate(${px}, ${py})`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                if (dng.pendingEvent) onOpenDungeonEvent(z.id);
                else onSelectZone(z.id);
              }}
            >
              <rect
                x="-16"
                y="-16"
                width="32"
                height="32"
                rx="5"
                fill={dng.cleared ? '#065f46' : dng.corrupted ? '#581c87' : '#1e293b'}
                stroke={dng.pendingEvent ? '#fde047' : dng.corrupted ? '#c084fc' : '#38bdf8'}
                strokeWidth={dng.pendingEvent ? 3 : 2}
              />
              <text x="0" y="5" textAnchor="middle" fontSize="15">
                {dng.cleared ? '✅' : dng.corrupted ? '🕯️' : '🗝️'}
              </text>
              {!dng.cleared && (
                <text x="0" y="-19" textAnchor="middle" fill="#fde047" fontSize="9" fontWeight="bold">
                  {'★'.repeat(dng.stars)}
                </text>
              )}
              {dng.activeHeroId && !dng.cleared && (
                <rect
                  x="-14"
                  y="18"
                  width={Math.max(4, (28 * dng.progress) / 100)}
                  height="4"
                  fill="#38bdf8"
                />
              )}
              {dng.pendingEvent && (
                <g transform="translate(14, -14)">
                  <circle r="9" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">
                    !
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 6. After Inc Style RED SONAR PULSE for Approaching Invasion! */}
        {state.invasionWarningZoneId && state.zones[state.invasionWarningZoneId] && (
          <g
            transform={`translate(${state.zones[state.invasionWarningZoneId].center.x}, ${state.zones[state.invasionWarningZoneId].center.y})`}
            pointerEvents="none"
          >
            <circle r="38" fill="rgba(239, 68, 68, 0.18)" stroke="#ef4444" strokeWidth="2.5" className="sonar-pulse" />
            <circle r="18" fill="rgba(220, 38, 38, 0.45)" stroke="#fef08a" strokeWidth="2" />
            <text x="0" y="5" textAnchor="middle" fontSize="15">
              📯
            </text>
          </g>
        )}

        {/* 7. Selected Army Path Trajectory */}
        {armiesList.map((army) => {
          if (army.path.length === 0) return null;
          const pts: Point[] = [getArmyPos(army, 0)];
          for (const stepZId of army.path) {
            const sz = state.zones[stepZId];
            if (sz) pts.push(sz.center);
          }
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          return (
            <path
              key={`path_${army.id}`}
              d={d}
              fill="none"
              stroke={army.owner === 'player' ? '#fde047' : '#ef4444'}
              strokeWidth={3}
              strokeDasharray="7 5"
              pointerEvents="none"
            />
          );
        })}

        {/* 8. Stackable Army Banners on Map */}
        {armiesList.map((army, idx) => {
          const z = state.zones[army.zoneId];
          if (!z || z.status === 'unexplored') return null;
          const pos = getArmyPos(army, idx % 4);
          const total = countUnits(army.units);
          const isPlayer = army.owner === 'player';
          const isSelected = selectedArmyId === army.id || selectedMoveArmy?.id === army.id;

          const bannerColor = isPlayer
            ? raceDef.primaryColor
            : army.owner === 'secession_nobles'
              ? '#9333ea'
              : army.owner === 'schism_zealots'
                ? '#6d28d9'
                : army.owner === 'rebel_peasants'
                  ? '#ea580c'
                  : '#dc2626';

          return (
            <g
              key={army.id}
              transform={`translate(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                if (orderMoveModeArmyId && !isPlayer) {
                  onOrderArmyMove(orderMoveModeArmyId, army.zoneId);
                  return;
                }
                onSelectArmy(army.id, army.zoneId);
              }}
            >
              {isSelected && (
                <circle r="22" fill="none" stroke="#fde047" strokeWidth="3" strokeDasharray="4 3" />
              )}
              {/* Pixel Banner Shield */}
              <rect
                x="-16"
                y="-15"
                width="32"
                height="26"
                rx="4"
                fill={bannerColor}
                stroke={isSelected ? '#fde047' : '#f8fafc'}
                strokeWidth={isSelected ? 2.8 : 2}
              />
              <text x="-4" y="2" textAnchor="middle" fontSize="13">
                {isPlayer ? '🛡️' : army.owner === 'invasion' ? '💀' : army.owner === 'raiders' ? '🐺' : '⚔️'}
              </text>
              <text
                x="8"
                y="3"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontFamily="'Silkscreen', monospace"
                fontWeight="700"
              >
                {total}
              </text>
              {army.heroId && (
                <g transform="translate(14, -14)">
                  <circle r="7" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />
                  <text x="0" y="3.5" textAnchor="middle" fontSize="9">
                    👑
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 9. Active Multi-Phase Tactical Battle Overlays */}
        {Object.values(state.battles).map((b) => {
          const z = state.zones[b.zoneId];
          if (!z) return null;
          return (
            <g
              key={`bat_${b.zoneId}`}
              transform={`translate(${z.center.x}, ${z.center.y - 36})`}
              pointerEvents="none"
            >
              <rect
                x="-38"
                y="-13"
                width="76"
                height="22"
                rx="5"
                fill="rgba(153, 27, 27, 0.92)"
                stroke="#fde047"
                strokeWidth="2"
              />
              <text x="0" y="2" textAnchor="middle" fill="#fef08a" fontSize="10" fontWeight="800">
                ⚔️ {b.phase === 'ranged' ? 'SALVE' : 'MÊLÉE'} R{b.round}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Move-mode instruction pill */}
      {selectedMoveArmy && (
        <div className="move-order-banner">
          <span>
            🚩 Sélectionnez une province éclairée sur la carte pour y envoyer{' '}
            <strong>{selectedMoveArmy.name}</strong>
          </span>
        </div>
      )}
    </div>
  );
};
