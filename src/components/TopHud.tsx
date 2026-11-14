import React, { useEffect, useRef } from 'react';
import { SEASONS } from '../data/buildings';
import { RACES } from '../data/races';
import { GameSpeed, GameState } from '../types/game';

interface TopHudProps {
  state: GameState;
  onSetSpeed: (s: GameSpeed) => void;
  onFocusResourceHint: (kind: 'intendance' | 'food' | 'wood' | 'gold' | 'city') => void;
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
  spring: 'Fermes +15% • Explo moins chère',
  summer: 'Fermes +35% • Armées rapides',
  autumn: 'Grandes Moissons (+65%)',
  winter: 'Gel Fermes • Chauffage au Bois',
};

export const TopHud: React.FC<TopHudProps> = ({
  state,
  onSetSpeed,
  onFocusResourceHint,
  onOpenHelp,
  onOpenNewGame,
}) => {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const seasonCfg = SEASONS[state.season];
  const raceDef = RACES[state.race];
  const cityLvl = state.zones[state.capitalZoneId]?.capitalBuildings.palace ?? 1;

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

  return (
    <header className="top-hud">
      {/* 1. Season & Year */}
      <div className="hud-section hud-kingdom" title={seasonCfg.summaryEffects.join(' • ')}>
        <span
          className="race-dot"
          style={{
            backgroundColor: raceDef.primaryColor,
            borderColor: raceDef.secondaryColor,
          }}
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

      {/* 2. Streamlined 4 Resources (Clickable to locate/explain how to get each!) */}
      <div className="hud-section hud-resources">
        <button
          type="button"
          className="res-chip res-chip-btn stamina-chip"
          onClick={() => onFocusResourceHint('intendance')}
          title="⚡ Commandement (comme l’Endurance d’After Inc) : remonte tout seul chaque seconde ! Sert à Explorer, Prendre une zone, Bâtir et Réparer. Cliquez pour agrandir la Cité."
        >
          <span className="res-icon">⚡</span>
          <div className="res-data">
            <span className="res-label">Commandement · Auto</span>
            <div className="res-row">
              <strong className="res-val">
                {Math.floor(state.resources.intendance)}
                <small>/{state.resources.maxIntendance}</small>
              </strong>
              <span className="res-rate pos">+{state.rates.intendance}/s</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="res-chip res-chip-btn"
          onClick={() => onFocusResourceHint('food')}
          title="🌾 Vivres : cliquez pour trouver une Plaine (Ferme) ou un Pâturage (Élevage) sur la carte !"
        >
          <span className="res-icon">🌾</span>
          <div className="res-data">
            <span className="res-label">Vivres · Plaines</span>
            <div className="res-row">
              <strong className="res-val">{Math.floor(state.resources.food)}</strong>
              <span className={`res-rate ${state.rates.food < 0 ? 'neg' : 'pos'}`}>
                {formatRate(state.rates.food)}/s
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`res-chip res-chip-btn ${state.season === 'winter' ? 'winter-alert' : ''}`}
          onClick={() => onFocusResourceHint('wood')}
          title="🪵 Bois : cliquez pour localiser une Forêt (Camp de Bûcherons) sur la carte !"
        >
          <span className="res-icon">🪵</span>
          <div className="res-data">
            <span className="res-label">Bois · Forêts</span>
            <div className="res-row">
              <strong className="res-val">{Math.floor(state.resources.wood)}</strong>
              <span className={`res-rate ${state.rates.wood < 0 ? 'neg' : 'pos'}`}>
                {formatRate(state.rates.wood)}/s
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="res-chip res-chip-btn"
          onClick={() => onFocusResourceHint('gold')}
          title="💰 Or : sert à recruter vos Soldats & Héros ! Vient des Impôts et des Mines d’Or (Collines). Cliquez pour voir une Colline."
        >
          <span className="res-icon">💰</span>
          <div className="res-data">
            <span className="res-label">Or · Impôts & Mines</span>
            <div className="res-row">
              <strong className="res-val">{Math.floor(state.resources.gold)}</strong>
              <span className={`res-rate ${state.rates.gold < 0 ? 'neg' : 'pos'}`}>
                {formatRate(state.rates.gold)}/s
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          className="res-chip res-chip-btn"
          onClick={() => onFocusResourceHint('city')}
          title="Niveau de votre Cité et Population : cliquez pour ouvrir votre Cité et l’agrandir !"
        >
          <span className="res-icon">🏰</span>
          <div className="res-data">
            <span className="res-label">Cité Niv.{cityLvl}</span>
            <div className="res-row">
              <strong className="res-val">
                {Math.floor(state.resources.population)}
                <small>/{state.resources.maxPopulation} hab.</small>
              </strong>
            </div>
          </div>
        </button>
      </div>

      {/* 3. Accessible Single-Tab-Stop Toolbar */}
      <div
        ref={toolbarRef}
        role="toolbar"
        {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
        aria-label="Contrôles de vitesse et d’aide"
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

        <div role="group" aria-label="Aide et partie" className="toolbar-group">
          <button
            type="button"
            className="tb-btn tb-help-btn"
            aria-label="Comment jouer"
            title="Guide express illustré"
            onClick={onOpenHelp}
          >
            📖 Comment jouer
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-label="Nouvelle partie"
            title="Nouvelle partie / Changer de Peuple ou de Difficulté"
            onClick={onOpenNewGame}
          >
            🔄
          </button>
        </div>
      </div>
    </header>
  );
};
