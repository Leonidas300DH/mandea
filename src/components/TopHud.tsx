import React, { useEffect, useRef } from 'react';
import { SEASONS } from '../data/buildings';
import { RACES } from '../data/races';
import { EstateId, GameSpeed, GameState } from '../types/game';

interface TopHudProps {
  state: GameState;
  onSetSpeed: (s: GameSpeed) => void;
  onOpenEstates: () => void;
  onOpenTavern: () => void;
  onOpenHelp: () => void;
  onOpenNewGame: () => void;
}

const SPEEDS: { value: GameSpeed; label: string; title: string }[] = [
  { value: 0, label: '⏸', title: 'Pause tactique' },
  { value: 0.5, label: '×½', title: 'Ralenti (x0.5)' },
  { value: 1, label: '×1', title: 'Vitesse normale (x1)' },
  { value: 2, label: '×2', title: 'Rapide (x2)' },
  { value: 4, label: '×4', title: 'Accéléré (x4)' },
];

const SEASON_SHORT_RULE: Record<GameState['season'], string> = {
  spring: 'Fermes +15% • Explo -15%',
  summer: 'Fermes +35% • Armées +18%',
  autumn: 'Moissons +65% • Commerce +15%',
  winter: 'Gel (-80% Fermes) • Brûle du Bois',
};

export const TopHud: React.FC<TopHudProps> = ({
  state,
  onSetSpeed,
  onOpenEstates,
  onOpenTavern,
  onOpenHelp,
  onOpenNewGame,
}) => {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const seasonCfg = SEASONS[state.season];
  const raceDef = RACES[state.race];

  // Roving tabindex fallback when native focusgroup is unsupported (per modern-web-guidance `toolbar`)
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
      {/* 1. Season & Year with plain-French active rule */}
      <div className="hud-section hud-kingdom" title={seasonCfg.summaryEffects.join(' • ')}>
        <span
          className="race-dot"
          style={{ backgroundColor: raceDef.primaryColor, borderColor: raceDef.secondaryColor }}
          title={raceDef.name}
        />
        <div className="season-block">
          <div className="season-title">
            <span>{seasonCfg.emoji}</span>
            <strong>{seasonCfg.name}</strong>
            <span className="year-tag">An {state.year}</span>
          </div>
          <div className="season-sub-rule">{SEASON_SHORT_RULE[state.season]}</div>
          <div className="season-progress-track">
            <div
              className="season-progress-fill"
              style={{ width: `${Math.min(100, state.seasonProgress)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Named, Self-Explanatory Resources */}
      <div className="hud-section hud-resources">
        <div className="res-chip" title="Intendance : se recharge automatiquement, sert à explorer, annexer et bâtir">
          <span className="res-icon">⚡</span>
          <div className="res-data">
            <span className="res-label">Intendance</span>
            <div className="res-row">
              <strong className="res-val">
                {Math.floor(state.resources.intendance)}
                <small>/{state.resources.maxIntendance}</small>
              </strong>
              <span className="res-rate pos">+{state.rates.intendance}/s</span>
            </div>
          </div>
        </div>

        <div className="res-chip" title="Vivres : produits par Fermes & Élevages, nourrissent habitants et armées">
          <span className="res-icon">🌾</span>
          <div className="res-data">
            <span className="res-label">Vivres</span>
            <div className="res-row">
              <strong className="res-val">{Math.floor(state.resources.food)}</strong>
              <span className={`res-rate ${state.rates.food < 0 ? 'neg' : 'pos'}`}>
                {formatRate(state.rates.food)}/s
              </span>
            </div>
          </div>
        </div>

        <div
          className={`res-chip ${state.season === 'winter' ? 'winter-alert' : ''}`}
          title="Bois : produit en Forêt, sert aux constructions et au chauffage en Hiver"
        >
          <span className="res-icon">🪵</span>
          <div className="res-data">
            <span className="res-label">Bois</span>
            <div className="res-row">
              <strong className="res-val">{Math.floor(state.resources.wood)}</strong>
              <span className={`res-rate ${state.rates.wood < 0 ? 'neg' : 'pos'}`}>
                {formatRate(state.rates.wood)}/s
              </span>
            </div>
          </div>
        </div>

        <div className="res-chip" title="Fer & Pierre : extraits dans les Collines, servent aux armes et remparts">
          <span className="res-icon">⛏️</span>
          <div className="res-data">
            <span className="res-label">Fer</span>
            <div className="res-row">
              <strong className="res-val">{Math.floor(state.resources.iron)}</strong>
              <span className="res-rate pos">+{state.rates.iron.toFixed(1)}/s</span>
            </div>
          </div>
        </div>

        <div className="res-chip" title="Or : impôts, marchés, recrutement militaire et Héros">
          <span className="res-icon">💰</span>
          <div className="res-data">
            <span className="res-label">Or</span>
            <div className="res-row">
              <strong className="res-val">{Math.floor(state.resources.gold)}</strong>
              <span className={`res-rate ${state.rates.gold < 0 ? 'neg' : 'pos'}`}>
                {formatRate(state.rates.gold)}/s
              </span>
            </div>
          </div>
        </div>

        <div className="res-chip" title="Habitants du Royaume">
          <span className="res-icon">👥</span>
          <div className="res-data">
            <span className="res-label">Habitants</span>
            <div className="res-row">
              <strong className="res-val">
                {Math.floor(state.resources.population)}
                <small>/{state.resources.maxPopulation}</small>
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Three Estates & Royal Authority Button */}
      <button
        type="button"
        className={`hud-estates-btn ${supportedCount < 2 ? 'critical-pulse' : ''}`}
        onClick={onOpenEstates}
        title="Ouvrir le Conseil des Trois Ordres (Impôts, Festivités et Loyauté)"
      >
        <div className="authority-pill">
          <span className="auth-label">Autorité</span>
          <strong>👑 {Math.round(state.authority)}%</strong>
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
                <span className="est-mini-head">
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

      {/* 4. Accessible Single-Tab-Stop Toolbar */}
      <div
        ref={toolbarRef}
        role="toolbar"
        {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
        aria-label="Contrôles du temps et du royaume"
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

        <div role="group" aria-label="Menus du Royaume" className="toolbar-group">
          <button
            type="button"
            className="tb-btn tb-hero-btn"
            aria-label="Héros et Taverne"
            title="Gérer vos Héros et en recruter à la Taverne"
            onClick={onOpenTavern}
          >
            🗡️ Héros ({Object.keys(state.heroes).length})
            {pendingDungeonCount > 0 && <span className="badge-dot">{pendingDungeonCount}</span>}
          </button>
          <button
            type="button"
            className="tb-btn tb-help-btn"
            aria-label="Guide de jeu"
            title="Comment jouer (Guide express)"
            onClick={onOpenHelp}
          >
            ❓ Aide
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Nouvelle partie"
            title="Nouvelle partie / Changer de Peuple"
            onClick={onOpenNewGame}
          >
            🔄
          </button>
        </div>
      </div>
    </header>
  );
};
