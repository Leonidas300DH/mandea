import React, { useEffect, useId, useRef, useState } from 'react';
import { RACES } from '../data/races';
import { EstateId, GameState, RaceId, TaxLevel } from '../types/game';

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
 * - Opened strictly via `showModal()` (no `role="dialog"` or `aria-modal` added)
 * - Uses `closedby` declaratively + fallback bounding-rect light-dismiss for browsers without `closedBy`
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

    // Fallback for browsers without `<dialog closedby>` support (e.g. Safari)
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
              <button type="submit" className="dialog-close-btn" aria-label="Fermer la fenêtre">
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

// ==================== 1. NEW GAME / RACE PICKER MODAL ====================

export const NewGameModal: React.FC<{
  open: boolean;
  canDismiss: boolean;
  onClose: () => void;
  onStartGame: (race: RaceId, seed: number, kingdomName: string) => void;
}> = ({ open, canDismiss, onClose, onStartGame }) => {
  const [selectedRace, setSelectedRace] = useState<RaceId>('humans');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 900000) + 100000);
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
      title="⚔️ MANDEA — Fonder un Nouveau Royaume (Bac à Sable)"
      wide
    >
      <p className="dialog-lead">
        Choisissez votre Peuple, étendez vos frontières organiques au rythme des 4 saisons, aménagez vos provinces et maintenez le soutien d’au moins <strong>2 Ordres sur 3</strong> (Peuple, Noblesse, Clergé) !
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

      <div className="new-game-controls">
        <label className="field-group">
          <span>Nom de votre Capitale / Royaume :</span>
          <input
            type="text"
            value={kingdomName}
            onChange={(e) => setKingdomName(e.target.value)}
            maxLength={32}
          />
        </label>
        <label className="field-group">
          <span>Graine du Continent :</span>
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
          onClick={() => onStartGame(selectedRace, seed, kingdomName)}
        >
          🏰 Fonder {kingdomName || RACES[selectedRace].kingdomTitle}
        </button>
      </div>
    </NativeModal>
  );
};

// ==================== 2. THREE ESTATES, TAXES & FESTIVITIES MODAL ====================

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
    { icon: string; disgraceTitle: string; disgraceDesc: string; appeaseLabel: string }
  > = {
    peuple: {
      icon: '🌾',
      disgraceTitle: 'Jacquerie des Serfs (< 20%)',
      disgraceDesc:
        'Grèves (-50% prod.) et apparition de Bandes de Rebelles qui incendient vos campagnes et attaquent la Capitale !',
      appeaseLabel: '🍞 Distribuer du grain (35🌾 8⚡ → +14 Satisfaction)',
    },
    noblesse: {
      icon: '⚜️',
      disgraceTitle: 'Fronde & Sécession Féodale (< 20%)',
      disgraceDesc:
        'Vos provinces développées font sécession et lèvent des Armées de Chevaliers rebelles contre votre trône !',
      appeaseLabel: '🍷 Banquet & Privilèges (45💰 8⚡ → +14 Satisfaction)',
    },
    clerge: {
      icon: '⛪',
      disgraceTitle: 'Anathème & Schisme (< 20%)',
      disgraceDesc:
        'Érode la loyauté des 2 autres Ordres (-9), réduit l’Intendance et ouvre des Failles maudites générant des Zélotes !',
      appeaseLabel: '🕯️ Offrandes Sacrées (35💰 15🪵 8⚡ → +15 Satisfaction)',
    },
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      closedBy="any"
      title="👑 Conseil des Trois Ordres, Fiscalité & Autorité Royale"
      wide
    >
      <div className="council-banner">
        <img
          src={anyDisgrace ? '/assets/events/crisis-revolt.jpg' : '/assets/events/festivities.jpg'}
          alt="Conseil du Royaume"
          width={640}
          height={180}
          className="council-banner-img"
        />
        <div className="authority-summary-box">
          <div>
            <h3>
              Autorité Royale : <strong>{Math.round(state.authority)} / 100</strong>{' '}
              <small>({state.authorityDelta >= 0 ? `+${state.authorityDelta}` : state.authorityDelta}/s)</small>
            </h3>
            <p className="small-muted">
              Règle des 2 sur 3 : si <strong>2 Ordres tombent en Disgrâce (&lt;20%)</strong>, votre Autorité chute. Si elle tombe à 0, vous devrez concéder des chartes permanentes pour acheter leur loyauté !
              {state.concessionsCount > 0 && (
                <strong className="warn-inline">
                  {' '}
                  • Chartes concédées : {state.concessionsCount} (+{state.concessionsCount * 15}% conso permanente)
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
              state.resources.food < 30 ||
              state.resources.intendance < 10
            }
            onClick={onStartFestivities}
          >
            {state.festivitiesTimer > 0
              ? `🎉 Festivités en cours (${Math.ceil(state.festivitiesTimer)}s)`
              : '🎉 Organiser des Festivités (30💰 30🌾 10⚡)'}
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
                <span className={`sat-badge ${est.inDisgrace ? 'bad' : val >= 75 ? 'good' : ''}`}>
                  {val}% → cible {Math.round(est.targetSatisfaction)}%
                </span>
              </div>

              <div className="sat-bar-track">
                <div className="disgrace-threshold" title="Seuil de Disgrâce (20%)" />
                <div
                  className={`sat-bar-fill ${est.inDisgrace ? 'bad' : val >= 75 ? 'good' : 'mid'}`}
                  style={{ width: `${val}%` }}
                />
              </div>

              {/* Tax Selector */}
              <div className="tax-selector">
                <span className="tax-label">Impôt :</span>
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

              <button type="button" className="action-btn full-btn" onClick={() => onAppease(id)}>
                {meta.appeaseLabel}
              </button>

              <details className="factors-details">
                <summary>Voir détails & risque de Disgrâce</summary>
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

// ==================== 3. TAVERN & HEROES MODAL ====================

export const TavernHeroesModal: React.FC<{
  open: boolean;
  state: GameState;
  onClose: () => void;
  onRecruitHero: (heroId: string) => void;
  onSelectZone: (zoneId: string) => void;
}> = ({ open, state, onClose, onRecruitHero, onSelectZone }) => {
  const recruited = Object.values(state.heroes);

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      closedBy="any"
      title="🍺 Taverne & Hall des Héros Légendaires"
      wide
    >
      <h3 className="section-sub">Vos Héros au service de la Couronne ({recruited.length})</h3>
      <div className="heroes-grid">
        {recruited.map((h) => (
          <div key={h.id} className="hero-card">
            <img src={h.portrait} alt={h.name} width={76} height={76} className="hero-avatar" />
            <div className="hero-info">
              <strong>
                {h.name} <span className="lvl-pill">Niv. {h.level}</span>
              </strong>
              <span className="small-muted">{h.title}</span>
              <div className="hero-stats">
                ❤️ {Math.round(h.hp)}/{h.maxHp} • ⚔️ Aura +{Math.round(h.armyAtkAura * 100)}% ATQ / +
                {Math.round(h.armyDefAura * 100)}% DÉF • 🗝️ Donjon {h.dungeonPower}
              </div>
              <div className="hero-relics">
                {h.relics.length === 0 ? (
                  <small className="small-muted">Aucune relique équipée (explorez un Donjon !)</small>
                ) : (
                  h.relics.map((r, idx) => (
                    <span key={`${r.id}_${idx}`} className="relic-chip" title={r.description}>
                      {r.icon} {r.name}
                    </span>
                  ))
                )}
              </div>
              <div className="hero-status-line">
                {h.status === 'idle' && <span className="ok-text">Disponible à la Capitale</span>}
                {h.status === 'army' && h.assignedId && (
                  <span>
                    🚩 Commande <strong>{state.armies[h.assignedId]?.name}</strong>
                  </span>
                )}
                {h.status === 'dungeon' && h.assignedId && (
                  <button
                    type="button"
                    className="action-btn compact-btn"
                    onClick={() => {
                      onSelectZone(h.assignedId!);
                      onClose();
                    }}
                  >
                    🗝️ En Donjon ({state.zones[h.assignedId]?.name}) — Voir
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="section-sub">Aventuriers présents à la Taverne</h3>
      {state.tavernPool.length === 0 ? (
        <p className="small-muted">
          De nouveaux Héros arriveront à la Taverne au prochain Printemps !
        </p>
      ) : (
        <div className="heroes-grid">
          {state.tavernPool.map((h) => (
            <div key={h.id} className="hero-card">
              <img src={h.portrait} alt={h.name} width={76} height={76} className="hero-avatar" />
              <div className="hero-info">
                <strong>{h.name}</strong>
                <span className="small-muted">{h.title}</span>
                <p className="small-muted">{h.lore}</p>
                <button
                  type="button"
                  className="primary-btn compact-btn"
                  disabled={state.resources.gold < 65 || state.resources.intendance < 12}
                  onClick={() => onRecruitHero(h.id)}
                >
                  🍺 Recruter (65 🪙 Or • 12 ⚡ Intendance)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
              👑 <strong>{hero.name}</strong> (Niv.{hero.level} • ❤️ {Math.round(hero.hp)}/{hero.maxHp}) — Palier{' '}
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
            {state.zoneOrder.filter((id) => state.zones[id]?.status === 'claimed').length} provinces
          </strong>{' '}
          sous votre bannière.
        </p>
        <button type="button" className="primary-btn full-btn" autoFocus onClick={onRestart}>
          🔄 Fonder un Nouveau Royaume
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
        Privé du soutien d’au moins 2 Ordres sur 3, votre trône vacille ! Les délégations exigent des privilèges irrévocables pour ne pas vous destituer sur-le-champ.
      </p>
      <div className="build-list">
        <button
          type="button"
          className="primary-btn full-btn"
          autoFocus
          onClick={() => onDecision('buy_loyalty')}
        >
          <strong>📜 Acheter la Loyauté (Concéder la Grande Charte)</strong>
          <small className="btn-sub">
            Restaure l’Autorité à 48% et apaise les 3 Ordres (+22%), MAIS augmente DÉFINITIVEMENT la consommation de ressources du royaume de +15% (Total : +{(state.concessionsCount + 1) * 15}%).
          </small>
        </button>
        <button
          type="button"
          className="action-btn full-btn"
          onClick={() => onDecision('abdicate')}
        >
          <strong>🏳️ Abdiquer et clore cette chronique</strong>
          <small className="btn-sub">Accepter la fin de votre règne et recommencer une partie.</small>
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
      title="📖 Guide Express du Régent — Comment jouer à Mandea"
      wide
    >
      <div className="guide-grid">
        <div className="guide-card">
          <img src="/assets/sprites/farm.png" alt="Ferme" className="guide-sprite" />
          <h3>1. Annexer & Bâtir</h3>
          <p>
            Votre <strong>⚡ Intendance</strong> se recharge seule chaque seconde. Cliquez sur une province voisine éclairée pour l’<strong>Annexer</strong>, puis bâtissez <strong>Fermes</strong> (Plaines), <strong>Élevages</strong> (Pâturages), <strong>Camps de bûcherons</strong> (Forêts), <strong>Mines</strong> (Collines) et <strong>Routes</strong> !
          </p>
        </div>

        <div className="guide-card">
          <img src="/assets/sprites/lumber.png" alt="Scierie" className="guide-sprite" />
          <h3>2. Survivre aux 4 Saisons</h3>
          <p>
            L’Été et l’Automne offrent de riches moissons. En <strong>❄️ Hiver</strong>, les fermes gèlent (-80%) et vos habitants brûlent du <strong>🪵 Bois</strong> pour se chauffer : stockez toujours Vivres et Bois avant le gel (les Élevages produisent même l’hiver !).
          </p>
        </div>

        <div className="guide-card">
          <img src="/assets/sprites/chapel.png" alt="Chapelle" className="guide-sprite" />
          <h3>3. Les 3 Ordres & l’Autorité</h3>
          <p>
            Gardez le soutien d’au moins <strong>2 Ordres sur 3</strong> (Peuple, Noblesse, Clergé au-dessus de 20%). Bâtissez Puits, Chapelles et Manoirs, ajustez les impôts ou lancez des <strong>🎉 Festivités</strong> pour regagner de l’Autorité !
          </p>
        </div>

        <div className="guide-card">
          <img src="/assets/sprites/army_player.png" alt="Armée" className="guide-sprite" />
          <h3>4. Armées, Héros & Donjons</h3>
          <p>
            Recrutez vos troupes à la <strong>Capitale</strong>. Pour déplacer votre Armée : <strong>cliquez sur votre Chevalier</strong> sur la carte puis cliquez sur la province cible (ou clic droit). Envoyez vos <strong>Héros</strong> explorer les <strong>🗝️ Donjons</strong> !
          </p>
        </div>
      </div>
    </NativeModal>
  );
};
