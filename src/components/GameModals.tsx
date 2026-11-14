import React, { useEffect, useId, useRef, useState } from 'react';
import { CAPITAL_BUILDINGS } from '../data/buildings';
import { getRaceUnits, RACES, UNIT_DEFINITIONS } from '../data/races';
import {
  computeArmyPower,
  countUnits,
  getUnitGoldCost,
} from '../engine/simulation';
import {
  DifficultyPace,
  EstateId,
  GameState,
  RaceId,
  TaxLevel,
} from '../types/game';

interface NativeModalProps {
  open: boolean;
  onClose?: () => void;
  title: string;
  closedBy?: 'any' | 'closerequest' | 'none';
  wide?: boolean;
  children: React.ReactNode;
}

/**
 * Native `<dialog>` modal following modern-web-guidance `dialog` & `light-dismiss-a-dialog`:
 * - Opened strictly via `showModal()` (no redundant `role="dialog"` or `aria-modal`)
 * - Uses `closedby` declaratively + bounding-rect fallback for browsers without `closedBy`
 * - Resets `dialog.returnValue = ''` on close
 */
export const NativeModal: React.FC<NativeModalProps> = ({
  open,
  onClose,
  title,
  closedBy = 'any',
  wide = false,
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose?.();
    };

    const handleCancel = (e: Event) => {
      if (closedBy === 'none') {
        e.preventDefault();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

    let cleanupFallback: (() => void) | undefined;
    if (closedBy === 'any' && !('closedBy' in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
      cleanupFallback = () => dialog.removeEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
      cleanupFallback?.();
    };
  }, [closedBy, onClose]);

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: closedBy } as Record<string, string>)}
      aria-labelledby={titleId}
      className={`mandea-dialog ${wide ? 'wide-dialog' : ''}`}
    >
      <div className="dialog-inner">
        <div className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          {closedBy !== 'none' && (
            <form method="dialog">
              <button
                type="submit"
                className="dialog-close-btn"
                aria-label="Fermer la fenêtre"
              >
                ✕
              </button>
            </form>
          )}
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  );
};

// ==================== 1. NEW GAME / RACE & PACE PICKER MODAL ====================

const PACE_OPTIONS: { id: DifficultyPace; label: string; desc: string }[] = [
  {
    id: 'peaceful',
    label: '🌿 Paisible',
    desc: 'Très peu d’attaques : idéal pour bâtir et explorer tranquillement.',
  },
  {
    id: 'normal',
    label: '⚖️ Équilibré (After Inc)',
    desc: '1re année 100 % paisible, puis raids espacés et annoncés à l’avance.',
  },
  {
    id: 'intense',
    label: '🔥 Intense',
    desc: 'Pression militaire plus soutenue pour les vétérans.',
  },
];

export const NewGameModal: React.FC<{
  open: boolean;
  canDismiss: boolean;
  onClose: () => void;
  onStartGame: (
    race: RaceId,
    seed: number,
    kingdomName: string,
    pace: DifficultyPace
  ) => void;
}> = ({ open, canDismiss, onClose, onStartGame }) => {
  const [selectedRace, setSelectedRace] = useState<RaceId>('humans');
  const [pace, setPace] = useState<DifficultyPace>('normal');
  const [seed, setSeed] = useState<number>(
    () => Math.floor(Math.random() * 900000) + 100000
  );
  const [kingdomName, setKingdomName] = useState<string>(RACES.humans.kingdomTitle);

  const handleSelectRace = (r: RaceId) => {
    setSelectedRace(r);
    setKingdomName(RACES[r].kingdomTitle);
  };

  return (
    <NativeModal
      open={open}
      onClose={canDismiss ? onClose : undefined}
      closedBy={canDismiss ? 'any' : 'none'}
      title="⚔️ MANDEA — Fonder votre Cité Médiévale-Fantastique"
      wide
    >
      <p className="dialog-lead">
        Inspiré d’<strong>After Inc</strong> : dépensez votre <strong>⚡ Commandement</strong> pour explorer et prendre les territoires voisins, produisez <strong>🌾 Vivres, 🪵 Bois et 💰 Or</strong> au fil des 4 saisons, recrutez <strong>Armées & Héros</strong> et gardez le soutien d’au moins <strong>2 Ordres sur 3</strong> !
      </p>

      <div className="race-grid">
        {(Object.keys(RACES) as RaceId[]).map((rId) => {
          const r = RACES[rId];
          const active = selectedRace === rId;
          return (
            <button
              key={rId}
              type="button"
              className={`race-card ${active ? 'selected' : ''}`}
              onClick={() => handleSelectRace(rId)}
            >
              <img
                src={r.bannerImage}
                alt={r.name}
                width={260}
                height={260}
                className="race-card-img"
              />
              <div className="race-card-content">
                <h3>{r.name}</h3>
                <span className="race-subtitle">{r.kingdomTitle}</span>
                <p>{r.description}</p>
                <ul>
                  {r.perks.map((pk, idx) => (
                    <li key={idx}>{pk}</li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>

      {/* Pace / Threat Frequency Selector */}
      <div className="pace-picker-box">
        <span className="pace-picker-title">Rythme des menaces ennemies :</span>
        <div className="pace-btns-row">
          {PACE_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pace-btn ${pace === p.id ? 'active' : ''}`}
              onClick={() => setPace(p.id)}
            >
              <strong>{p.label}</strong>
              <small>{p.desc}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="new-game-controls">
        <label className="field-group">
          <span>Nom de votre Cité :</span>
          <input
            type="text"
            value={kingdomName}
            onChange={(e) => setKingdomName(e.target.value)}
            maxLength={32}
          />
        </label>
        <label className="field-group">
          <span>Graine de la Carte :</span>
          <div className="seed-row">
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 1)}
            />
            <button
              type="button"
              className="action-btn compact-btn"
              onClick={() => setSeed(Math.floor(Math.random() * 900000) + 100000)}
            >
              🎲 Aléatoire
            </button>
          </div>
        </label>
        <button
          type="button"
          className="primary-btn start-kingdom-btn"
          autoFocus
          onClick={() => onStartGame(selectedRace, seed, kingdomName, pace)}
        >
          🏰 Fonder {kingdomName || RACES[selectedRace].kingdomTitle}
        </button>
      </div>
    </NativeModal>
  );
};

// ==================== 2. UNIFIED ARMY & HEROES RECRUITMENT MODAL ====================

export const ArmyAndHeroesModal: React.FC<{
  open: boolean;
  state: GameState;
  onClose: () => void;
  onRecruitUnit: (unitId: string, targetArmyId?: string | 'new') => void;
  onRecruitHero: (heroId: string) => void;
  onAssignHero: (heroId: string, armyId: string | null) => void;
  onSplitArmy: (armyId: string) => void;
  onStartMoveArmyOnMap: (armyId: string) => void;
  onSendHeroToDungeon: (heroId: string, zoneId: string) => void;
  onOpenCityPanel: () => void;
  onSelectZone: (zoneId: string) => void;
}> = ({
  open,
  state,
  onClose,
  onRecruitUnit,
  onRecruitHero,
  onAssignHero,
  onSplitArmy,
  onStartMoveArmyOnMap,
  onSendHeroToDungeon,
  onOpenCityPanel,
  onSelectZone,
}) => {
  const raceDef = RACES[state.race];
  const raceUnits = getRaceUnits(state.race);
  const capZone = state.zones[state.capitalZoneId];
  const playerArmies = Object.values(state.armies).filter(
    (a) => a.owner === 'player' && countUnits(a.units) > 0
  );
  const [targetArmyChoice, setTargetArmyChoice] = useState<string>('auto');

  const recruitedHeroes = Object.values(state.heroes);
  const openDungeonZone = state.zoneOrder
    .map((id) => state.zones[id])
    .find(
      (z) =>
        z &&
        z.status !== 'unexplored' &&
        z.dungeon &&
        !z.dungeon.cleared &&
        !z.dungeon.activeHeroId
    );

  const effectiveTarget: string | 'new' | undefined =
    targetArmyChoice === 'new'
      ? 'new'
      : targetArmyChoice !== 'auto' && state.armies[targetArmyChoice]
        ? targetArmyChoice
        : undefined;

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      closedBy="any"
      title={`⚔️ Armée & Héros (${raceDef.name}) — Recruter & Commander`}
      wide
    >
      {/* Top Gold & Target Army Bar */}
      <div className="army-modal-summary">
        <div className="gold-highlight-pill">
          <span>💰 Votre Or disponible :</span>
          <strong>{Math.floor(state.resources.gold)} Or</strong>
          <small>
            ({state.rates.gold >= 0 ? `+${state.rates.gold.toFixed(1)}` : state.rates.gold.toFixed(1)}/s)
          </small>
        </div>

        <label className="army-target-picker">
          <span>Les recrues rejoignent :</span>
          <select
            value={targetArmyChoice}
            onChange={(e) => setTargetArmyChoice(e.target.value)}
          >
            <option value="auto">
              🛡️ Armée principale ({playerArmies[0]?.name ?? 'Nouvelle Armée'})
            </option>
            {playerArmies.map((a) => (
              <option key={a.id} value={a.id}>
                🚩 {a.name} ({state.zones[a.zoneId]?.name ?? 'Carte'})
              </option>
            ))}
            <option value="new">✨ Créer une nouvelle Armée à la Cité</option>
          </select>
        </label>
      </div>

      {/* 1. RECRUIT STACKABLE UNITS (COSTS ONLY GOLD!) */}
      <h3 className="section-sub">1. Recruter des Soldats & Unités Fantastiques (coûte uniquement de l’💰 Or)</h3>
      <div className="recruit-units-grid">
        {raceUnits.map((u) => {
          const reqB = u.requiresBuilding;
          const locked = reqB ? (capZone?.capitalBuildings[reqB] ?? 0) < 1 : false;
          const costGold = getUnitGoldCost(state, u.id);
          const canAfford = !locked && state.resources.gold >= costGold;

          return (
            <div key={u.id} className={`unit-recruit-card ${locked ? 'locked' : ''}`}>
              <div className="unit-card-top">
                <div className="unit-title-group">
                  <span className="unit-big-emoji">{u.badgeEmoji}</span>
                  <div>
                    <strong>{u.name}</strong>
                    <div className="unit-stats-line">
                      ❤️ {u.hp} • ⚔️ {u.meleeAtk}
                      {u.rangedAtk > 0 ? ` • 🏹 ${u.rangedAtk}` : ''} • 🛡️ {u.defense}
                    </div>
                  </div>
                </div>
              </div>

              <p className="unit-desc-text">{u.description}</p>

              {locked && reqB ? (
                <button
                  type="button"
                  className="action-btn full-btn"
                  onClick={() => {
                    onClose();
                    onOpenCityPanel();
                  }}
                >
                  <span>🔒 Construire « {CAPITAL_BUILDINGS[reqB].name} » dans Ma Cité</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-btn full-btn"
                  disabled={!canAfford}
                  onClick={() => onRecruitUnit(u.id, effectiveTarget)}
                >
                  <div className="btn-top-line">
                    <span>+ Recruter 1× {u.name}</span>
                    <span className={`cost-chip ${!canAfford ? 'missing' : 'ok'}`}>
                      💰 {costGold} Or
                    </span>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. YOUR ACTIVE ARMIES */}
      <h3 className="section-sub">2. Vos Armées en campagne ({playerArmies.length})</h3>
      {playerArmies.length === 0 ? (
        <p className="small-muted">
          Vous n’avez aucune armée active : recrutez un soldat ci-dessus pour former une nouvelle compagnie à votre Cité !
        </p>
      ) : (
        <div className="heroes-grid">
          {playerArmies.map((army) => {
            const zName = state.zones[army.zoneId]?.name ?? 'En marche';
            return (
              <div key={army.id} className="army-stack-box">
                <div className="army-stack-header">
                  <div className="army-title-wrap">
                    <img
                      src="/assets/sprites/army_player.png"
                      alt=""
                      className="mini-sprite-icon"
                    />
                    <div>
                      <strong>{army.name}</strong>
                      <div className="small-muted" style={{ margin: 0 }}>
                        📍 {zName}
                      </div>
                    </div>
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
                  <label htmlFor={`modal_hero_${army.id}`}>Commandant :</label>
                  <select
                    id={`modal_hero_${army.id}`}
                    value={army.heroId ?? ''}
                    onChange={(e) =>
                      onAssignHero(
                        e.target.value || army.heroId || '',
                        e.target.value ? army.id : null
                      )
                    }
                  >
                    <option value="">— Aucun Héros —</option>
                    {recruitedHeroes
                      .filter((h) => h.status !== 'dungeon')
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          👑 {h.name} (Niv.{h.level})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="army-actions-row">
                  <button
                    type="button"
                    className="primary-btn compact-btn"
                    onClick={() => {
                      onClose();
                      onStartMoveArmyOnMap(army.id);
                    }}
                  >
                    🚩 Déplacer sur la carte
                  </button>
                  {countUnits(army.units) >= 2 && (
                    <button
                      type="button"
                      className="action-btn compact-btn"
                      onClick={() => onSplitArmy(army.id)}
                    >
                      ➗ Diviser en 2
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. HEROES & TAVERN */}
      <h3 className="section-sub">
        3. Vos Héros ({recruitedHeroes.length}) & Taverne (pour commander vos Armées ou explorer les 🗝️ Donjons)
      </h3>
      <div className="heroes-grid">
        {recruitedHeroes.map((h) => (
          <div key={h.id} className="hero-card">
            <img src={h.portrait} alt={h.name} width={72} height={72} className="hero-avatar" />
            <div className="hero-info">
              <strong>
                {h.name} <span className="lvl-pill">Niv. {h.level}</span>
              </strong>
              <span className="small-muted">{h.title}</span>
              <div className="hero-stats">
                ❤️ {Math.round(h.hp)}/{h.maxHp} • Aura +{Math.round(h.armyAtkAura * 100)}% ATQ
              </div>
              {h.relics.length > 0 && (
                <div className="hero-relics">
                  {h.relics.map((r, idx) => (
                    <span key={`${r.id}_${idx}`} className="relic-chip" title={r.description}>
                      {r.icon} {r.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="hero-status-line">
                {h.status === 'dungeon' && h.assignedId ? (
                  <button
                    type="button"
                    className="action-btn compact-btn"
                    onClick={() => {
                      onClose();
                      onSelectZone(h.assignedId!);
                    }}
                  >
                    🗝️ Explore {state.zones[h.assignedId]?.name} — Voir
                  </button>
                ) : openDungeonZone?.dungeon ? (
                  <button
                    type="button"
                    className="primary-btn compact-btn"
                    onClick={() => {
                      onSendHeroToDungeon(h.id, openDungeonZone.id);
                      onClose();
                      onSelectZone(openDungeonZone.id);
                    }}
                  >
                    🗝️ Explorer {openDungeonZone.dungeon.name}
                  </button>
                ) : h.status === 'army' && h.assignedId ? (
                  <span className="ok-text">
                    🚩 Commande {state.armies[h.assignedId]?.name}
                  </span>
                ) : (
                  <span className="ok-text">✓ Prêt à la Cité</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {state.tavernPool.map((h) => {
          const canBuyHero = state.resources.gold >= 60;
          return (
            <div key={h.id} className="hero-card tavern-offer-card">
              <img src={h.portrait} alt={h.name} width={72} height={72} className="hero-avatar" />
              <div className="hero-info">
                <strong>🍺 {h.name}</strong>
                <span className="small-muted">{h.title}</span>
                <p className="small-muted" style={{ margin: '2px 0 6px' }}>
                  {h.lore}
                </p>
                <button
                  type="button"
                  className="primary-btn compact-btn"
                  disabled={!canBuyHero}
                  onClick={() => onRecruitHero(h.id)}
                >
                  + Recruter ce Héros (💰 60 Or)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </NativeModal>
  );
};

// ==================== 3. THREE ESTATES, TAXES & FESTIVITIES MODAL ====================

const TAX_OPTIONS: { id: TaxLevel; label: string; desc: string }[] = [
  { id: 'exempt', label: 'Exempté', desc: '0 Or • +18 Satisfaction' },
  { id: 'low', label: 'Faible', desc: 'Impôt réduit • +9 Satisfaction' },
  { id: 'normal', label: 'Normal', desc: 'Impôt équilibré • +0' },
  { id: 'high', label: 'Élevé', desc: 'Impôt lourd (+65% Or) • -22 Satisfaction' },
];

export const EstatesCouncilModal: React.FC<{
  open: boolean;
  state: GameState;
  onClose: () => void;
  onSetTax: (estateId: EstateId, tax: TaxLevel) => void;
  onAppease: (estateId: EstateId) => void;
  onStartFestivities: () => void;
}> = ({ open, state, onClose, onSetTax, onAppease, onStartFestivities }) => {
  const raceDef = RACES[state.race];
  const anyDisgrace =
    state.estates.peuple.inDisgrace ||
    state.estates.noblesse.inDisgrace ||
    state.estates.clerge.inDisgrace;

  const estateMeta: Record<
    EstateId,
    {
      icon: string;
      disgraceTitle: string;
      disgraceDesc: string;
      appeaseLabel: string;
      canAfford: boolean;
    }
  > = {
    peuple: {
      icon: '🌾',
      disgraceTitle: 'Révolte des Serfs (< 20%)',
      disgraceDesc:
        'Production réduite et apparition de Bandes de Rebelles qui attaquent vos terres et votre Capitale.',
      appeaseLabel: '🍞 Distribuer des Vivres (30 🌾 Vivres → +15 Satisfaction)',
      canAfford: state.resources.food >= 30,
    },
    noblesse: {
      icon: '⚜️',
      disgraceTitle: 'Sécession Féodale (< 20%)',
      disgraceDesc:
        'Un territoire développé fait sécession et lève une armée rebelle contre vous.',
      appeaseLabel: '🍷 Présents & Titres (40 💰 Or → +15 Satisfaction)',
      canAfford: state.resources.gold >= 40,
    },
    clerge: {
      icon: '⛪',
      disgraceTitle: 'Schisme & Anathème (< 20%)',
      disgraceDesc:
        'Fait baisser le moral des autres Ordres et attire des Zélotes près des lieux anciens.',
      appeaseLabel: '🕯️ Offrandes au Sanctuaire (35 💰 Or → +15 Satisfaction)',
      canAfford: state.resources.gold >= 35,
    },
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      closedBy="any"
      title="👑 Les 3 Ordres du Royaume, Impôts & Festivités"
      wide
    >
      <div className="council-banner">
        <img
          src={anyDisgrace ? '/assets/events/crisis-revolt.jpg' : '/assets/events/festivities.jpg'}
          alt="Conseil des Trois Ordres"
          width={640}
          height={180}
          className="council-banner-img"
        />
        <div className="authority-summary-box">
          <div>
            <h3>
              👑 Autorité Royale : <strong>{Math.round(state.authority)} / 100</strong>{' '}
              <small>
                ({state.authorityDelta >= 0 ? `+${state.authorityDelta}` : state.authorityDelta}/s)
              </small>
            </h3>
            <p className="small-muted">
              Gardez le soutien d’au moins <strong>2 Ordres sur 3 (au-dessus de 20 %)</strong> ! Si votre Autorité baisse, organisez des <strong>Festivités</strong>. Si elle tombe à 0, vous pourrez acheter la loyauté (mais vos sujets consommeront plus de façon définitive).
              {state.concessionsCount > 0 && (
                <strong className="warn-inline">
                  {' '}
                  • Loyauté achetée : {state.concessionsCount}× (+{state.concessionsCount * 12}% conso permanente)
                </strong>
              )}
            </p>
          </div>
          <button
            type="button"
            className="primary-btn"
            disabled={
              state.festivitiesTimer > 0 ||
              state.resources.gold < 30 ||
              state.resources.food < 25
            }
            onClick={onStartFestivities}
          >
            {state.festivitiesTimer > 0
              ? `🎉 Festivités en cours (${Math.ceil(state.festivitiesTimer)}s)`
              : '🎉 Organiser des Festivités (30 💰 Or • 25 🌾 Vivres → +12 Autorité)'}
          </button>
        </div>
      </div>

      <div className="estates-grid">
        {(['peuple', 'noblesse', 'clerge'] as EstateId[]).map((id) => {
          const est = state.estates[id];
          const meta = estateMeta[id];
          const val = Math.round(est.satisfaction);
          return (
            <div key={id} className={`estate-card ${est.inDisgrace ? 'in-disgrace' : ''}`}>
              <div className="estate-card-head">
                <strong>
                  {meta.icon} {raceDef.estateLabels[id]}
                </strong>
                <span className={`sat-badge ${est.inDisgrace ? 'bad' : val >= 70 ? 'good' : ''}`}>
                  {val}% (cible {Math.round(est.targetSatisfaction)}%)
                </span>
              </div>

              <div className="sat-bar-track">
                <div className="disgrace-threshold" title="Seuil de Disgrâce (20%)" />
                <div
                  className={`sat-bar-fill ${est.inDisgrace ? 'bad' : val >= 70 ? 'good' : 'mid'}`}
                  style={{ width: `${val}%` }}
                />
              </div>

              {/* Tax Selector */}
              <div className="tax-selector">
                <span className="tax-label">Niveau d’impôt (moins d’impôts = plus contents) :</span>
                <div className="tax-btns">
                  {TAX_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`tax-btn ${est.taxLevel === t.id ? 'active' : ''}`}
                      title={t.desc}
                      onClick={() => onSetTax(id, t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="action-btn full-btn"
                disabled={!meta.canAfford}
                onClick={() => onAppease(id)}
              >
                {meta.appeaseLabel}
              </button>

              <details className="factors-details">
                <summary>Pourquoi ce niveau de satisfaction ?</summary>
                <ul>
                  {est.factors.map((f, i) => (
                    <li key={i}>
                      <span>{f.label}</span>
                      <strong className={f.delta >= 0 ? 'pos' : 'neg'}>
                        {f.delta >= 0 ? `+${f.delta}` : f.delta}
                      </strong>
                    </li>
                  ))}
                </ul>
                <p className="disgrace-note">
                  <strong>{meta.disgraceTitle} :</strong> {meta.disgraceDesc}
                </p>
              </details>
            </div>
          );
        })}
      </div>
    </NativeModal>
  );
};

// ==================== 4. DUNGEON CHOICE MODAL ====================

export const DungeonEventModal: React.FC<{
  open: boolean;
  zoneId: string | null;
  state: GameState;
  onClose: () => void;
  onChoose: (zoneId: string, optionId: string) => void;
}> = ({ open, zoneId, state, onClose, onChoose }) => {
  const zone = zoneId ? state.zones[zoneId] : null;
  const dng = zone?.dungeon;
  const ev = dng?.pendingEvent;
  const hero = dng?.activeHeroId ? state.heroes[dng.activeHeroId] : null;

  return (
    <NativeModal
      open={Boolean(open && zone && dng && ev)}
      onClose={onClose}
      closedBy="closerequest"
      title={ev?.title ?? 'Expédition de Donjon'}
    >
      {zone && dng && ev && (
        <div>
          <img
            src="/assets/events/dungeon-crypt.jpg"
            alt={dng.name}
            width={520}
            height={220}
            className="card-banner-img"
          />
          {hero && (
            <p className="hero-expedition-tag">
              👑 <strong>{hero.name}</strong> (Niv.{hero.level} • ❤️ {Math.round(hero.hp)}/{hero.maxHp}) — Salle{' '}
              {dng.stage}/{dng.maxStages}
            </p>
          )}
          <p className="dialog-lead">{ev.description}</p>
          <div className="build-list">
            {ev.options.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                className={idx === 0 ? 'primary-btn full-btn' : 'action-btn full-btn'}
                autoFocus={idx === 0}
                onClick={() => onChoose(zone.id, opt.id)}
              >
                <strong>{opt.label}</strong>
                <small className="btn-sub">{opt.description}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </NativeModal>
  );
};

// ==================== 5. AUTHORITY = 0 CRISIS ("ACHETER LA LOYAUTÉ") & GAME OVER ====================

export const AuthorityCrisisModal: React.FC<{
  state: GameState;
  onDecision: (choice: 'buy_loyalty' | 'abdicate') => void;
  onRestart: () => void;
}> = ({ state, onDecision, onRestart }) => {
  if (state.gameOver) {
    return (
      <NativeModal open={true} closedBy="none" title="💀 Chute du Royaume">
        <img
          src="/assets/events/threat-invasion.jpg"
          alt="Chute de la cité"
          width={520}
          height={220}
          className="card-banner-img"
        />
        <p className="dialog-lead">{state.gameOverReason}</p>
        <p className="small-muted">
          Vous avez régné jusqu’à l’<strong>An {state.year}</strong> avec{' '}
          <strong>
            {state.zoneOrder.filter((id) => state.zones[id]?.status === 'claimed').length} territoires
          </strong>{' '}
          sous votre bannière.
        </p>
        <button type="button" className="primary-btn full-btn" autoFocus onClick={onRestart}>
          🔄 Fonder une Nouvelle Cité
        </button>
      </NativeModal>
    );
  }

  return (
    <NativeModal
      open={state.pendingAuthorityCrisis}
      closedBy="none"
      title="⚠️ CRISE DE COURONNE — Autorité Royale tombée à 0 !"
    >
      <img
        src="/assets/events/crisis-revolt.jpg"
        alt="Crise de Couronne"
        width={520}
        height={220}
        className="card-banner-img"
      />
      <p className="dialog-lead">
        Vous n’êtes plus soutenu par au moins 2 Ordres sur 3 ! Pour sauver votre trône, vous pouvez acheter leur loyauté au prix de privilèges permanents.
      </p>
      <div className="build-list">
        <button
          type="button"
          className="primary-btn full-btn"
          autoFocus
          onClick={() => onDecision('buy_loyalty')}
        >
          <strong>📜 Acheter la Loyauté (+50 Autorité & apaise les 3 Ordres)</strong>
          <small className="btn-sub">
            Augmente définitivement la consommation de ressources de vos sujets de +12 % (total : +
            {(state.concessionsCount + 1) * 12} %).
          </small>
        </button>
        <button
          type="button"
          className="action-btn full-btn"
          onClick={() => onDecision('abdicate')}
        >
          <strong>🏳️ Abdiquer et recommencer une partie</strong>
          <small className="btn-sub">Accepter la fin de votre règne.</small>
        </button>
      </div>
    </NativeModal>
  );
};

// ==================== 6. ILLUSTRATED QUICK-START GUIDE MODAL ====================

export const HowToPlayModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  return (
    <NativeModal
      open={open}
      onClose={onClose}
      closedBy="any"
      title="📖 Comment jouer à Mandea (en 30 secondes)"
      wide
    >
      <div className="guide-grid">
        <div className="guide-card">
          <img src="/assets/sprites/farm.png" alt="Ferme" className="guide-sprite" />
          <h3>1. 4 Ressources très claires</h3>
          <p>
            <strong>⚡ Commandement</strong> remonte tout seul chaque seconde !<br />
            <strong>🌾 Vivres</strong> = Fermes (Plaines) & Élevages (Pâturages).<br />
            <strong>🪵 Bois</strong> = Camp de bûcherons (Forêts).<br />
            <strong>💰 Or</strong> = Impôts de la Cité & Mines d’Or (Collines).
          </p>
        </div>

        <div className="guide-card">
          <img src="/assets/sprites/lumber.png" alt="Camp de bûcherons" className="guide-sprite" />
          <h3>2. Explorer, Bâtir & Réparer (🔨)</h3>
          <p>
            Cliquez sur <strong>🔍 Explorer</strong> dans la brume, puis prenez les zones voisines avec votre ⚡. Si un raid pille une terre, cliquez simplement sur le bouton orange <strong>🔨 Réparer (⚡6)</strong> directement sur la carte !
          </p>
        </div>

        <div className="guide-card">
          <img src="/assets/sprites/army_player.png" alt="Armée" className="guide-sprite" />
          <h3>3. Recruter & Déplacer l’Armée</h3>
          <p>
            Cliquez sur le gros bouton <strong>⚔️ Armée & Héros</strong> en bas de l’écran pour recruter Milice, Archers, Chevaliers et Héros avec votre <strong>💰 Or</strong>. Pour bouger : cliquez sur votre Chevalier sur la carte puis sur la zone cible !
          </p>
        </div>

        <div className="guide-card">
          <img src="/assets/sprites/chapel.png" alt="Chapelle" className="guide-sprite" />
          <h3>4. Saisons & Les 3 Ordres</h3>
          <p>
            En <strong>❄️ Hiver</strong>, les fermes gèlent et la Cité brûle du <strong>🪵 Bois</strong> (les Élevages produisent toujours !). Gardez au moins <strong>2 Ordres sur 3</strong> au-dessus de 20 % via <strong>👑 Les 3 Ordres</strong> en bas.
          </p>
        </div>
      </div>
    </NativeModal>
  );
};
