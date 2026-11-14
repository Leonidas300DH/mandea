import React from 'react';
import { CapitalBuildingId, CivicBuildingId, ResourceBuildingType, Season } from '../types/game';
import { SEASONS } from '../data/buildings';

interface TreeProps {
  x: number;
  y: number;
  season: Season;
  variant?: number;
  scale?: number;
}

export const PixelTree: React.FC<TreeProps> = ({ x, y, season, variant = 0, scale = 1 }) => {
  const pal = SEASONS[season].palette;
  const leafMain = variant % 3 === 0 ? pal.treeCanopyAlt : pal.treeCanopy;
  const snowTop = season === 'winter';

  return (
    <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)}) scale(${scale})`} shapeRendering="crispEdges">
      {/* Shadow */}
      <rect x="-6" y="4" width="12" height="3" fill="rgba(0,0,0,0.18)" />
      {/* Trunk */}
      <rect x="-2" y="-2" width="4" height="7" fill="#6b4423" />
      {/* Pixel Canopy */}
      <rect x="-7" y="-8" width="14" height="7" fill={leafMain} />
      <rect x="-5" y="-12" width="10" height="5" fill={leafMain} />
      <rect x="-3" y="-15" width="6" height="4" fill={leafMain} />
      {/* Highlight */}
      <rect x="-4" y="-11" width="4" height="3" fill="rgba(255,255,255,0.22)" />
      {snowTop && (
        <>
          <rect x="-5" y="-13" width="10" height="2" fill="#ffffff" />
          <rect x="-3" y="-16" width="6" height="2" fill="#ffffff" />
          <rect x="-7" y="-9" width="14" height="2" fill="#f1f5f9" />
        </>
      )}
    </g>
  );
};

export const PixelMountain: React.FC<{ x: number; y: number; season: Season; scale?: number }> = ({
  x,
  y,
  season,
  scale = 1,
}) => {
  const isWinter = season === 'winter';
  return (
    <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)}) scale(${scale})`} shapeRendering="crispEdges">
      <rect x="-14" y="2" width="28" height="4" fill="#475569" />
      <rect x="-12" y="-3" width="24" height="6" fill="#64748b" />
      <rect x="-9" y="-8" width="18" height="6" fill="#64748b" />
      <rect x="-6" y="-13" width="12" height="6" fill="#94a3b8" />
      <rect x="-3" y="-17" width="6" height="5" fill="#f8fafc" />
      {isWinter && <rect x="-8" y="-11" width="16" height="5" fill="#f8fafc" />}
    </g>
  );
};

export const PixelResourceBuilding: React.FC<{
  x: number;
  y: number;
  type: ResourceBuildingType;
  level: 1 | 2 | 3;
  season: Season;
  primaryColor: string;
}> = ({ x, y, type, level, season, primaryColor }) => {
  const cropColor = SEASONS[season].palette.cropColor;
  const isWinter = season === 'winter';

  if (type === 'farm') {
    return (
      <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
        {/* Tilled Pixel Crop Rows! Visibly change with seasons */}
        <rect x="-26" y="4" width="52" height="14" fill="#5c4033" />
        {[-23, -17, -11, -5, 1, 7, 13, 19].map((rx) => (
          <rect
            key={rx}
            x={rx}
            y={season === 'summer' || season === 'autumn' ? 2 : 5}
            width="4"
            height={season === 'summer' || season === 'autumn' ? 14 : 10}
            fill={cropColor}
          />
        ))}
        {/* Farmhouse */}
        <rect x="-18" y="-8" width="14" height="11" fill="#fef3c7" />
        <rect x="-20" y="-12" width="18" height="5" fill={isWinter ? '#f8fafc' : '#b45309'} />
        <rect x="-13" y="-3" width="4" height="6" fill="#78350f" />
        {/* Level 2+: Pixel Windmill! */}
        {level >= 2 && (
          <g transform="translate(8, -6)">
            <rect x="-5" y="-8" width="10" height="16" fill="#f8fafc" />
            <rect x="-6" y="-12" width="12" height="4" fill="#dc2626" />
            {/* Windmill Sails */}
            <rect x="-13" y="-9" width="26" height="2" fill="#fde047" />
            <rect x="-1" y="-20" width="2" height="24" fill="#fde047" />
            <rect x="-2" y="-9" width="4" height="4" fill={primaryColor} />
          </g>
        )}
        {/* Level 3: Golden Silo / Granary */}
        {level >= 3 && (
          <g transform="translate(-28, -5)">
            <rect x="0" y="-6" width="8" height="14" fill="#f59e0b" />
            <rect x="-1" y="-9" width="10" height="4" fill="#991b1b" />
          </g>
        )}
      </g>
    );
  }

  if (type === 'livestock') {
    return (
      <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
        {/* Wooden Fence Paddock */}
        <rect x="-24" y="2" width="48" height="14" fill="rgba(132, 204, 22, 0.3)" />
        <rect x="-24" y="2" width="48" height="2" fill="#92400e" />
        <rect x="-24" y="14" width="48" height="2" fill="#92400e" />
        <rect x="-24" y="2" width="2" height="14" fill="#92400e" />
        <rect x="22" y="2" width="2" height="14" fill="#92400e" />
        {/* Red Timber Barn */}
        <rect x="-18" y="-9" width="16" height="12" fill="#dc2626" />
        <rect x="-20" y="-13" width="20" height="5" fill={isWinter ? '#f8fafc' : '#7f1d1d'} />
        <rect x="-13" y="-4" width="6" height="7" fill="#fef3c7" />
        {/* Cute Pixel Sheep & Cattle inside paddock */}
        <rect x="2" y="6" width="6" height="4" fill="#ffffff" />
        <rect x="7" y="7" width="2" height="2" fill="#1e293b" />
        <rect x="13" y="9" width="6" height="4" fill="#ffffff" />
        {level >= 2 && (
          <>
            <rect x="-14" y="7" width="7" height="5" fill="#92400e" />
            <rect x="4" y="-7" width="14" height="9" fill="#b45309" />
            <rect x="3" y="-10" width="16" height="3" fill="#78350f" />
          </>
        )}
        {level >= 3 && <rect x="-4" y="8" width="6" height="4" fill="#fde047" />}
      </g>
    );
  }

  if (type === 'lumber' || type === 'grove') {
    return (
      <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
        {/* Log Cabin */}
        <rect x="-16" y="-6" width="15" height="11" fill="#92400e" />
        <rect x="-18" y="-10" width="19" height="5" fill={isWinter ? '#f1f5f9' : '#15803d'} />
        {/* Stacked Logs */}
        <rect x="3" y="0" width="14" height="4" fill="#b45309" />
        <rect x="5" y="-4" width="10" height="4" fill="#d97706" />
        {level >= 2 && (
          <g transform="translate(10, -8)">
            {/* Sawmill Wheel */}
            <rect x="0" y="-4" width="10" height="10" fill="#cbd5e1" />
            <rect x="3" y="-1" width="4" height="4" fill="#475569" />
          </g>
        )}
        {level >= 3 && <rect x="-24" y="-2" width="7" height="7" fill="#a16207" />}
      </g>
    );
  }

  // Mine
  return (
    <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
      {/* Rocky Mound & Mine Entrance */}
      <rect x="-18" y="-10" width="22" height="16" fill="#64748b" />
      <rect x="-14" y="-14" width="14" height="5" fill={isWinter ? '#f8fafc' : '#94a3b8'} />
      <rect x="-11" y="-4" width="8" height="10" fill="#0f172a" />
      <rect x="-13" y="-6" width="12" height="2" fill="#92400e" />
      {/* Ore Cart */}
      <rect x="7" y="-1" width="10" height="6" fill="#334155" />
      <rect x="8" y="-3" width="8" height="3" fill="#fbbf24" />
      {level >= 2 && (
        <g transform="translate(10, -11)">
          {/* Forge Chimney */}
          <rect x="0" y="0" width="7" height="10" fill="#475569" />
          <rect x="1" y="-3" width="5" height="3" fill="#f97316" />
        </g>
      )}
      {level >= 3 && <rect x="-25" y="-4" width="7" height="10" fill="#38bdf8" />}
    </g>
  );
};

export const PixelCivicBadge: React.FC<{
  civicId: CivicBuildingId;
  x: number;
  y: number;
  season: Season;
  primaryColor: string;
}> = ({ civicId, x, y, season, primaryColor }) => {
  const isWinter = season === 'winter';

  switch (civicId) {
    case 'wells':
      return (
        <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
          {/* Cottage + Stone Well */}
          <rect x="-10" y="-4" width="10" height="8" fill="#fde68a" />
          <rect x="-11" y="-7" width="12" height="4" fill={isWinter ? '#f8fafc' : '#ea580c'} />
          <rect x="3" y="-2" width="7" height="6" fill="#94a3b8" />
          <rect x="2" y="-6" width="9" height="3" fill="#2563eb" />
          {isWinter && <rect x="-8" y="-11" width="3" height="4" fill="rgba(255,255,255,0.75)" />}
        </g>
      );
    case 'market':
      return (
        <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
          {/* Colorful Market Tent */}
          <rect x="-9" y="-2" width="18" height="7" fill="#fef3c7" />
          <rect x="-10" y="-7" width="7" height="5" fill="#ef4444" />
          <rect x="-3" y="-7" width="6" height="5" fill="#ffffff" />
          <rect x="3" y="-7" width="7" height="5" fill="#f59e0b" />
        </g>
      );
    case 'chapel':
      return (
        <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
          {/* Steepled Pixel Chapel */}
          <rect x="-7" y="-5" width="14" height="10" fill="#f1f5f9" />
          <rect x="-8" y="-8" width="16" height="4" fill="#3b82f6" />
          <rect x="-3" y="-14" width="6" height="7" fill="#e2e8f0" />
          <rect x="-1" y="-18" width="2" height="5" fill="#fbbf24" />
          <rect x="-3" y="-16" width="6" height="2" fill="#fbbf24" />
        </g>
      );
    case 'manor':
      return (
        <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
          {/* Two-Story Noble Manor + Pennant */}
          <rect x="-9" y="-7" width="18" height="12" fill="#e2e8f0" />
          <rect x="-10" y="-11" width="20" height="4" fill="#7c2d12" />
          <rect x="-1" y="-17" width="2" height="6" fill="#475569" />
          <rect x="1" y="-17" width="7" height="4" fill={primaryColor} />
        </g>
      );
    case 'watchtower':
      return (
        <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
          {/* Tall Pixel Watchtower */}
          <rect x="-5" y="-12" width="10" height="18" fill="#94a3b8" />
          <rect x="-7" y="-16" width="14" height="5" fill="#475569" />
          <rect x="-7" y="-18" width="3" height="2" fill="#cbd5e1" />
          <rect x="-1" y="-18" width="3" height="2" fill="#cbd5e1" />
          <rect x="4" y="-18" width="3" height="2" fill="#cbd5e1" />
          <rect x="-2" y="-15" width="4" height="3" fill="#fbbf24" />
        </g>
      );
    case 'fort':
      return (
        <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
          {/* Crenellated Stone Bastion */}
          <rect x="-14" y="-6" width="28" height="11" fill="#64748b" />
          <rect x="-16" y="-10" width="8" height="15" fill="#475569" />
          <rect x="8" y="-10" width="8" height="15" fill="#475569" />
          <rect x="-4" y="-1" width="8" height="6" fill="#78350f" />
        </g>
      );
  }
};

export const PixelCapitalComplex: React.FC<{
  x: number;
  y: number;
  buildings: Record<CapitalBuildingId, number>;
  season: Season;
  primaryColor: string;
  secondaryColor: string;
}> = ({ x, y, buildings, season, primaryColor, secondaryColor }) => {
  const wallsLvl = buildings.walls ?? 1;
  const palaceLvl = buildings.palace ?? 1;
  const isWinter = season === 'winter';

  return (
    <g transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`} shapeRendering="crispEdges">
      {/* Outer Fortification Ring (Walls Lv 1 = Palisade, Lv 2 = Stone Walls, Lv 3 = Grand Citadel) */}
      {wallsLvl >= 1 && (
        <g>
          <rect
            x="-44"
            y="14"
            width="88"
            height={wallsLvl >= 2 ? 10 : 7}
            fill={wallsLvl === 1 ? '#92400e' : wallsLvl === 2 ? '#64748b' : '#e2e8f0'}
          />
          {/* Corner Bastion Towers */}
          <rect
            x="-48"
            y="4"
            width="12"
            height="20"
            fill={wallsLvl === 1 ? '#78350f' : wallsLvl === 2 ? '#475569' : '#cbd5e1'}
          />
          <rect
            x="36"
            y="4"
            width="12"
            height="20"
            fill={wallsLvl === 1 ? '#78350f' : wallsLvl === 2 ? '#475569' : '#cbd5e1'}
          />
          {wallsLvl >= 3 && (
            <>
              <rect x="-49" y="0" width="14" height="5" fill={primaryColor} />
              <rect x="35" y="0" width="14" height="5" fill={primaryColor} />
            </>
          )}
          {/* Main Gate */}
          <rect x="-6" y="16" width="12" height="8" fill="#451a03" />
        </g>
      )}

      {/* Cathedral (Left Rear) */}
      {(buildings.cathedral ?? 0) > 0 && (
        <g transform="translate(-28, -8)">
          <rect x="-8" y="-8" width="16" height="18" fill="#f8fafc" />
          <rect x="-9" y="-13" width="18" height="5" fill="#3b82f6" />
          <rect x="-3" y="-21" width="6" height="9" fill="#e2e8f0" />
          <rect x="-1" y="-26" width="2" height="6" fill="#fbbf24" />
        </g>
      )}

      {/* Arcane Menagerie / Fantasy Spire (Right Rear) */}
      {(buildings.menagerie ?? 0) > 0 && (
        <g transform="translate(28, -10)">
          <rect x="-6" y="-10" width="12" height="20" fill="#4c1d95" />
          <rect x="-8" y="-15" width="16" height="6" fill="#7c3aed" />
          <rect x="-3" y="-21" width="6" height="6" fill="#38bdf8" />
        </g>
      )}

      {/* Central Royal Keep / Palace (Scales Lv 1 -> 3!) */}
      <g>
        <rect x="-18" y="-14" width="36" height="28" fill="#f1f5f9" />
        <rect x="-20" y="-19" width="40" height="6" fill={isWinter ? '#ffffff' : primaryColor} />
        {/* Central Keep Spire */}
        <rect x="-9" y={-24 - palaceLvl * 4} width="18" height={12 + palaceLvl * 4} fill="#ffffff" />
        <rect x="-11" y={-28 - palaceLvl * 4} width="22" height="5" fill={primaryColor} />
        {/* Royal Flag */}
        <rect x="-1" y={-37 - palaceLvl * 4} width="2" height="10" fill="#475569" />
        <rect x="1" y={-37 - palaceLvl * 4} width="11" height="6" fill={secondaryColor} />
        {/* Keep Archway */}
        <rect x="-5" y="2" width="10" height="12" fill="#78350f" />
      </g>

      {/* Grand Market Stalls (Front Left) */}
      {(buildings.grand_market ?? 0) > 0 && (
        <g transform="translate(-24, 6)">
          <rect x="-8" y="-2" width="16" height="6" fill="#fef3c7" />
          <rect x="-9" y="-6" width="9" height="4" fill="#ef4444" />
          <rect x="0" y="-6" width="9" height="4" fill="#fbbf24" />
        </g>
      )}

      {/* Barracks & Tavern (Front Right) */}
      {(buildings.barracks ?? 0) > 0 && (
        <g transform="translate(22, 5)">
          <rect x="-8" y="-4" width="15" height="9" fill="#cbd5e1" />
          <rect x="-9" y="-7" width="17" height="4" fill="#dc2626" />
        </g>
      )}
    </g>
  );
};
