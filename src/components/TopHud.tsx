import React, { useEffect, useRef } from 'react';
import { SEASONS } from '../data/buildings';
import { RACES } from '../data/races';
import { EstateId, GameSpeed, GameState } from '../types/game';

interface TopHudProps {
  state: GameState;
  onSetSpeed: (s: GameSpeed) => void;
  onOpenEstates: () => void;
  onOpenTavern: () => void;
  onOpenNewGame: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenterCapital: () => void;
}

const SPEEDS: { value: GameSpeed; label: string; title: string }[] = [
  { value: 0, label: '⏸', title: 'Pause tactique' },
  { value: 0.5, label: '×½', title: 'Ralenti (x0.5)' },
  { value: 1, label: '×1', title: 'Vitesse normale (x1)' },
  { value: 2, label: '×2', title: 'Rapide (x2)' },
  { value: 4, label: '×4', title: 'Accéléré (x4)' },
];

export const TopHud: React.FC<TopHudProps> = ({
  state,
  onSetSpeed,
  onOpenEstates,
  onOpenTavern,
  onOpenNewGame,
  onZoomIn,
  onZoomOut,
  onCenterCapital,
}) => {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const seasonCfg = SEASONS[state.season];
  const raceDef = RACES[state.race];

  // Fallback roving tabindex when native focusgroup is unsupported (per modern-web-guidance `toolbar`)
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar || 'focusGroup' in HTMLElement.prototype) return;

    const getItems = () =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>('button[type="button"]'));

    const initItems = getItems();
    initItems.forEach((b, i) => {
      b.tabIndex = i === 0 ? 0 : -1;
    });

    const onFocusIn = (e: FocusEvent) => {
      const items = getItems();
      const target = e.target as HTMLButtonElement;
      if (items.includes(target)) {
        items.forEach((b) => {
          b.tabIndex = b === target ? 0 : -1;
        });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const items = getItems();
      if (items.length === 0) return;
      const activeIdx = Math.max(
        0,
        items.findIndex((b) => b === document.activeElement)
      );
      const rtl = getComputedStyle(bar).direction === 'rtl';
      const steps: Record<string, number> = {
        ArrowRight: rtl ? -1 : 1,
        ArrowLeft: rtl ? 1 : -1,
      };

      if (e.key in steps) {
        e.preventDefault();
        const nextIdx = (activeIdx + steps[e.key] + items.length) % items.length;
        items[nextIdx]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      }
    };

    bar.addEventListener('focusin', onFocusIn);
    bar.addEventListener('keydown', onKeyDown);
    return () => {
      bar.removeEventListener('focusin', onFocusIn);
      bar.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const formatRate = (r: number) => (r >= 0 ? `+${r.toFixed(1)}` : r.toFixed(1));

  const supportedCount = (['peuple', 'noblesse', 'clerge'] as EstateId[]).filter(
    (id) => !state.estates[id].inDisgrace
  ).length;

  const pendingDungeonCount = state.zoneOrder.filter(
    (id) => Boolean(state.zones[id]?.dungeon?.pendingEvent)
  ).length;

  return (
    <header className="top-hud">
      {/* Left: Faction Crest + Year & Season */}
      <div className="hud-section hud-kingdom">
        <span
          className="race-dot"
          style={{ backgroundColor: raceDef.primaryColor, borderColor: raceDef.secondaryColor }}
          title={raceDef.name}
        />
        <div className="season-block" title={seasonCfg.summaryEffects.join(' • ')}>
          <div className="season-title">
            <span>{seasonCfg.emoji}</span>
            <strong>{seasonCfg.name}</strong>
            <span className="year-tag">An {state.year}</span>
          </div>
          <div className="season-progress-track">
            <div
              className="season-progress-fill"
              style={{ width: `${Math.min(100, state.seasonProgress)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Center-Left: Core Resources */}
      <div className="hud-section hud-resources">
        <div className="res-chip" title="Intendance : permet d’explorer, revendiquer et construire">
          <span className="res-icon">⚡</span>
          <div>
            <div className="res-val">
              {Math.floor(state.resources.intendance)}
              <small>/{state.resources.maxIntendance}</small>
            </div>
            <div className="res-rate pos">+{state.rates.intendance}/s</div>
          </div>
        </div>

        <div className="res-chip" title="Vivres : nourrit la population et entretient vos troupes">
          <span className="res-icon">🌾</span>
          <div>
            <div className="res-val">{Math.floor(state.resources.food)}</div>
            <div className={`res-rate ${state.rates.food < 0 ? 'neg' : 'pos'}`}>
              {formatRate(state.rates.food)}/s
            </div>
          </div>
        </div>

        <div
          className={`res-chip ${state.season === 'winter' ? 'winter-alert' : ''}`}
          title="Bois : constructions + chauffage vital durant l’Hiver !"
        >
          <span className="res-icon">🪵</span>
          <div>
            <div className="res-val">{Math.floor(state.resources.wood)}</div>
            <div className={`res-rate ${state.rates.wood < 0 ? 'neg' : 'pos'}`}>
              {formatRate(state.rates.wood)}/s
            </div>
          </div>
        </div>

        <div className="res-chip" title="Fer & Pierre : remparts, armures et arbalètes">
          <span className="res-icon">⛏️</span>
          <div>
            <div className="res-val">{Math.floor(state.resources.iron)}</div>
            <div className="res-rate pos">+{state.rates.iron.toFixed(1)}/s</div>
          </div>
        </div>

        <div className="res-chip" title="Or : impôts, marchés, recrutement d’élite et Héros">
          <span className="res-icon">🪙</span>
          <div>
            <div className="res-val">{Math.floor(state.resources.gold)}</div>
            <div className={`res-rate ${state.rates.gold < 0 ? 'neg' : 'pos'}`}>
              {formatRate(state.rates.gold)}/s
            </div>
          </div>
        </div>

        <div className="res-chip" title="Habitants du Royaume">
          <span className="res-icon">👥</span>
          <div>
            <div className="res-val">
              {Math.floor(state.resources.population)}
              <small>/{state.resources.maxPopulation}</small>
            </div>
            {state.concessionsCount > 0 && (
              <div className="res-rate neg" title="Surcoût permanent des Chartes concédées">
                +{state.concessionsCount * 15}% conso
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center-Right: The 3 Estates + Royal Authority Button */}
      <button
        type="button"
        className={`hud-estates-btn ${supportedCount < 2 ? 'critical-pulse' : ''}`}
        onClick={onOpenEstates}
        title="Ouvrir le Conseil des Trois Ordres, la Fiscalité et les Festivités"
      >
        <div className="authority-pill">
          <span>👑 Autorité {Math.round(state.authority)}%</span>
          {state.festivitiesTimer > 0 && <span className="fest-tag">🎉 Fête</span>}
        </div>
        <div className="estates-mini-bars">
          {(
            [
              { id: 'peuple', icon: '🌾', short: 'Peuple' },
              { id: 'noblesse', icon: '⚜️', short: 'Nobles' },
              { id: 'clerge', icon: '⛪', short: 'Clergé' },
            ] as const
          ).map((item) => {
            const est = state.estates[item.id];
            const val = Math.round(est.satisfaction);
            return (
              <div
                key={item.id}
                className={`estate-mini ${est.inDisgrace ? 'disgrace' : val < 35 ? 'warn' : 'ok'}`}
              >
                <span>
                  {item.icon} {item.short} <strong>{val}%</strong>
                </span>
                <div className="mini-bar-bg">
                  <div className="mini-bar-fill" style={{ width: `${val}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </button>

      {/* Right: Accessible Game Speed & View Toolbar */}
      <div
        ref={toolbarRef}
        role="toolbar"
        {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
        aria-label="Contrôles du temps et de la carte"
        className="hud-toolbar"
      >
        <div role="group" aria-label="Vitesse de jeu" className="toolbar-group">
          {SPEEDS.map((sp) => (
            <button
              key={sp.value}
              type="button"
              aria-pressed={state.speed === sp.value}
              aria-label={sp.title}
              title={sp.title}
              onClick={() => onSetSpeed(sp.value)}
              className="tb-btn"
            >
              {sp.label}
            </button>
          ))}
        </div>

        <span role="separator" aria-orientation="vertical" className="tb-sep" />

        <div role="group" aria-label="Actions et Caméra" className="toolbar-group">
          <button
            type="button"
            className="tb-btn tb-hero-btn"
            aria-label="Taverne et Héros"
            title="Héros & Taverne"
            onClick={onOpenTavern}
          >
            🗡️ Héros ({Object.keys(state.heroes).length})
            {pendingDungeonCount > 0 && <span className="badge-dot">{pendingDungeonCount}</span>}
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Zoom avant"
            title="Zoom +"
            onClick={onZoomIn}
          >
            +
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Zoom arrière"
            title="Zoom -"
            onClick={onZoomOut}
          >
            −
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Centrer sur la Capitale"
            title="Centrer sur la Capitale"
            onClick={onCenterCapital}
          >
            🏰
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Nouvelle partie"
            title="Nouvelle partie / Changer de Race"
            onClick={onOpenNewGame}
          >
            🔄
          </button>
        </div>
      </div>
    </header>
  );
};
