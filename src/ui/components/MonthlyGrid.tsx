// src/ui/components/MonthlyGrid.tsx

import React, { useState, useMemo, useRef, Dispatch, SetStateAction } from "react"
import { ANNEE_PAR_DEFAUT, type AnneeSimulee, type Entity, type MonthlyGridData, type FinancialFlow, type Relationship, type SimulationReport, type UserPreferences } from "@/types"
import { MonthlyFlowsModal } from "./MonthlyFlowsModal"
import type { FlowChanges } from "./FlowItem"
import type { NewFlowValues } from "./NewFlowItem"
import { CellChartDisplay } from "./CellChartDisplay"
import { deMois, donneesDeLaGrille, MOIS_ABREGES, nombreDeFluxParMois, versementsRecus, type LigneDeLaGrille } from "@/lib/grille-mensuelle"
import { MOIS } from "@/lib/export-commun"
import { createId } from "@/lib/id"
import { euros } from "@/backend/logic/format"
import { ajouterDansLesAnnees, modifierDansLesAnnees, modifierSerie, recopierFlux, repartirDansLesAnnees, repartirSurLAnnee, resumerMoisTouches, serieAilleurs, supprimerDansLesAnnees, supprimerSerie, type ChangementsDeFlux, type CibleDansLesAnnees, type MoisTouches, type PorteeRecurrence } from "@/lib/flux-recurrents"
import { toast } from "sonner"
import { AvatarDisplay } from "./AvatarDisplay"
import { cn } from "@/lib/utils"
import { caseAlternee } from "../lignes-alternees"
import { useAffichageResume } from "../hooks/useAffichage"
import { useDefilementDeLaGrille } from "../hooks/useDefilementDeLaGrille"
import { useHautDesBarres } from "../hooks/useHautDesBarres"
import { useListeAnimee } from "../hooks/useListeAnimee"
import { BandeDesMois } from "./BandeDesMois"
import { OmbresDesBords } from "./ReperesDeDefilement"
import { defilementPourLaPosition, defilementPourLeMois, defilementVoisin } from "@/lib/bande-des-mois"

/**
 * Interface pour les props du composant MonthlyGrid.
 * Ce composant est le cœur de la visualisation des données, affichant une grille
 * interactive des flux financiers pour chaque entité, mois par mois, ainsi qu'un total annuel.
 */
interface MonthlyGridProps {
  entities: Entity[]
  /** Qui dirige et qui est associé : la ligne de chacun montre ce que lui versent les sociétés. */
  relationships?: Relationship[]
  monthlyData: MonthlyGridData
  setMonthlyData: Dispatch<SetStateAction<MonthlyGridData>>
  preferences: UserPreferences
  flowTypeToNumberMap: Map<string, number>
  /** Année de la grille, rappelée dans le titre à l'impression. */
  annee?: number
  /** Sélecteur d'année, affiché à côté du titre. */
  selecteurAnnee?: React.ReactNode
  /** Toutes les années de la session, pour appliquer aussi une opération aux autres années cochées. */
  annees?: AnneeSimulee[]
  /** Remplace les années de la session en une seule modification (une seule étape d'annulation). */
  setAnnees?: (annees: AnneeSimulee[]) => void
  /** Une case vient d'être touchée sur un écran tactile : l'aide au-dessus de la grille ne reviendra plus. */
  onGrilleTouchee?: () => void
  /** Résultats de l'année affichée : la fenêtre de saisie d'une société y lit la limite de la rémunération de son dirigeant. */
  rapport?: SimulationReport | null
}

/**
 * Bord de chaque case, plus marqué que l'espace d'un pixel qui les sépare (presque invisible en thème clair) : une ombre
 * d'un pixel, qui remplit cet espace sans changer la taille des cases. Le thème sombre garde son espace, déjà lisible ;
 * l'impression retire les ombres.
 */
const BORD_DE_CASE = "shadow-[0_0_0_1px_var(--color-slate-300)] dark:shadow-none"

/** Écran tactile : pointeur principal grossier (un doigt), sans survol pour inviter à toucher une case. */
const estTactile = () => window.matchMedia?.("(pointer: coarse)").matches === true

/**
 * Sur un écran tactile, rien ne s'éclaire au survol : une phrase dit qu'une case se touche, jusqu'à la première touchée
 * (préférence `grilleTouchee`). Ni à la souris, ni sur papier.
 */
function AideTactile({ grilleTouchee }: { grilleTouchee: boolean | undefined }) {
  if (grilleTouchee) return null
  return <p className="mb-3 hidden text-sm text-slate-700 pointer-coarse:block dark:text-slate-300 print:hidden">Touchez une case pour saisir un montant.</p>
}

/** Société à l'IS : la plus haute rémunération de son dirigeant sans déficit, d'après les résultats de l'année ; `undefined` sinon. */
const limiteDeRemuneration = (rapport: SimulationReport | null | undefined, entityId: string) => rapport?.activities.find(a => a.entityId === entityId)?.limiteDeRemuneration

/** Les années de la session autres que celle de la grille ; aucune si la grille ne les connaît pas. */
function autresAnneesQue(annees: AnneeSimulee[] | undefined, annee: number | undefined): number[] {
  if (!annees || annee === undefined) return []
  return annees.map(a => a.annee).filter(a => a !== annee)
}

/**
 * La ligne d'un acteur : son nom, son total annuel et ses douze mois, chaque mois ouvrant la fenêtre de ses flux. Son
 * rang donne les lignes alternées : chaque case, nom compris, reçoit la teinte de la bande.
 */
function LigneDeLActeur({ ligne, rang, onOuvrir }: { ligne: LigneDeLaGrille; rang: number; onOuvrir: (monthIndex: number) => void }) {
  const { entity, monthlyScale, monthlyCellData, annualCellData, annualScale } = ligne
  const bande = caseAlternee(rang)
  // Affichage « Résumé » : lignes plus basses, avatar en petit à côté du nom.
  const resume = useAffichageResume()
  return (
    <>
      {/* Colonne 1 : Nom de l'entité + Avatar */}
      <div className={cn("font-bold col-span-1 sticky left-0 bg-slate-100 dark:bg-gray-800 z-10 p-2 flex items-center justify-center print:static print:p-1", BORD_DE_CASE, bande)}>
        <div className={cn("flex items-center gap-2 py-1 mx-0 text-sm sm:mx-3 sm:text-base print:mx-0 print:gap-1 print:text-[9pt]", resume ? "max-sm:flex-col" : "flex-col")}>
          <AvatarDisplay avatar={entity.avatar} size={resume ? "sm" : "md"} />
          {/* Un nom long passe à la ligne ; un mot plus large que la colonne est coupé. */}
          <span className="text-center [overflow-wrap:anywhere]">{entity.name}</span>
        </div>
      </div>

      {/* Colonne 2 : Total annuel */}
      <div role="group" aria-label={`Total annuel : ${entity.name}`} className={cn("bg-slate-200 dark:bg-gray-700 p-2 flex flex-col justify-start print:p-1", BORD_DE_CASE, bande)}>
        <CellChartDisplay
          gains={annualCellData.gains}
          expenses={annualCellData.expenses}
          totalGains={annualCellData.totalGains}
          totalExpenses={annualCellData.totalExpenses}
          absoluteMaxValue={annualScale}
          flowCount={annualCellData.flowCount}
          readOnly
        />
      </div>

      {/* Colonnes 3 à 14 : Les 12 mois */}
      {monthlyCellData.map((cellData, monthIndex) => (
        <div
          key={monthIndex}
          className={cn("bg-slate-100 dark:bg-gray-800 p-2 group transition-colors cursor-pointer focus-visible:-outline-offset-4 hover:bg-slate-200 dark:hover:bg-gray-700 active:bg-slate-300 dark:active:bg-gray-600 flex flex-col justify-start print:min-h-0 print:p-1", resume ? "min-h-12" : "min-h-[80px]", BORD_DE_CASE, bande)}
          role="button"
          tabIndex={0}
          aria-label={`Flux ${deMois(MOIS[monthIndex])} : ${entity.name}`}
          onClick={() => onOuvrir(monthIndex)}
          onKeyDown={event => {
            // Une case s'ouvre aussi au clavier, comme un bouton.
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onOuvrir(monthIndex)
            }
          }}
        >
          <CellChartDisplay gains={cellData.gains} expenses={cellData.expenses} totalGains={cellData.totalGains} totalExpenses={cellData.totalExpenses} absoluteMaxValue={monthlyScale} flowCount={cellData.flowCount} />
        </div>
      ))}
    </>
  )
}

function MonthlyGrid({ entities, relationships, monthlyData, setMonthlyData, preferences, flowTypeToNumberMap, annee, selecteurAnnee, annees, setAnnees, onGrilleTouchee, rapport }: MonthlyGridProps) {
  // Un acteur ajouté, retiré ou déplacé : les cases de sa ligne apparaissent ou s'effacent, celles des lignes suivantes
  // glissent à leur place (la grille n'a pas d'élément par ligne : ce sont ses cases qui s'animent). De même quand une
  // ligne change de hauteur : une case qui passe de « + Ajouter » aux barres d'un flux (ou des dividendes reçus).
  const [refDeLaGrille] = useListeAnimee(undefined, undefined, true)
  // Bande des mois et ombres des bords : seulement quand la grille déborde de sa zone et doit défiler.
  const zone = useRef<HTMLDivElement>(null)
  const defilement = useDefilementDeLaGrille(zone, entities.length > 0, annee)
  const haut = useHautDesBarres(defilement.deborde)
  const fluxDesMois = useMemo(() => nombreDeFluxParMois(monthlyData, entities), [monthlyData, entities])
  // ===================================================================================
  // == ÉTAT DE LA FENÊTRE DES FLUX
  // ===================================================================================
  // Case (entité + mois) dont la fenêtre des flux est ouverte ; `null` quand elle est fermée.
  const [openCell, setOpenCell] = useState<{ entityId: string; monthIndex: number } | null>(null)
  const openCellEntity = entities.find(e => e.id === openCell?.entityId)
  // Une case ouverte d'un doigt : l'aide au-dessus de la grille a servi, elle ne revient plus.
  const ouvrirLaCase = (entityId: string, monthIndex: number) => {
    if (!preferences.grilleTouchee && estTactile()) onGrilleTouchee?.()
    setOpenCell({ entityId, monthIndex })
  }
  // Autres années de la session, proposées dans la fenêtre des flux ; aucune si la grille ne les connaît pas.
  const autresAnnees = setAnnees ? autresAnneesQue(annees, annee) : []

  // ===================================================================================
  // == HANDLERS POUR LES ACTIONS UTILISATEUR
  // ===================================================================================
  /**
   * Applique une transformation aux flux du mois ouvert.
   * Si la transformation renvoie la liste inchangée, les données gardent la même référence :
   * aucune entrée n'est alors ajoutée à l'historique undo/redo.
   */
  const updateOpenMonthFlows = (update: (flows: FinancialFlow[]) => FinancialFlow[]) => {
    if (!openCell) return
    const { monthIndex } = openCell
    setMonthlyData(prevData => {
      const flows = update(prevData[monthIndex].flows)
      if (flows === prevData[monthIndex].flows) return prevData
      return prevData.map((monthData, index) => (index === monthIndex ? { ...monthData, flows } : monthData))
    })
  }
  /**
   * Applique une opération à l'année affichée et aux autres années cochées, en une seule modification de la
   * session : une seule étape d'annulation. Renvoie `false` si aucune autre année n'est cochée : l'opération
   * suit alors le chemin habituel, limité à l'année affichée.
   */
  const dansLesAnnees = (aussiEn: number[], portee: PorteeRecurrence, operation: (annees: AnneeSimulee[], cible: CibleDansLesAnnees) => { annees: AnneeSimulee[]; touches: MoisTouches[] }, annonce: string) => {
    if (aussiEn.length === 0 || !openCell || !annees || !setAnnees || annee === undefined) return false
    const { annees: nouvelles, touches } = operation(annees, { annee, depuis: openCell.monthIndex, portee, autresAnnees: aussiEn })
    setAnnees(nouvelles)
    if (touches.length > 0) toast.success(`${annonce} ${resumerMoisTouches(touches)}.`)
    return true
  }
  /** Répartit un montant annuel sur les douze mois de l'année affichée et des autres années cochées, en une seule étape d'annulation. */
  const repartirLeMontantAnnuel = (flux: FinancialFlow, aussiEn: number[]) => {
    if (dansLesAnnees(aussiEn, "annee", (a, cible) => repartirDansLesAnnees(a, flux, cible, () => createId("flow")), "Montant annuel réparti sur")) return
    setMonthlyData(repartirSurLAnnee(monthlyData, flux, () => createId("flow")).grille)
    toast.success(`Montant annuel de ${euros(flux.amount)} réparti sur les 12 mois.`)
  }
  const handleCreateFlow = (values: NewFlowValues, portee: PorteeRecurrence = "mois", aussiEn: number[] = [], annuel = false) => {
    if (!openCell) return
    // L'identifiant est généré hors de la fonction de mise à jour, qui doit rester pure.
    const newFlow: FinancialFlow = { id: createId("flow"), entityId: openCell.entityId, ...values }
    if (annuel) {
      repartirLeMontantAnnuel(newFlow, aussiEn)
      return
    }
    if (dansLesAnnees(aussiEn, portee, (a, cible) => ajouterDansLesAnnees(a, newFlow, cible, () => createId("flow")), "Flux ajouté à ce mois et recopié sur")) return
    if (portee === "mois") {
      updateOpenMonthFlows(flows => [...flows, newFlow])
      return
    }
    // Ajout et recopies en une seule modification : une seule étape d'annulation.
    const { monthIndex } = openCell
    const avecLeNouveau = monthlyData.map((mois, index) => (index === monthIndex ? { ...mois, flows: [...mois.flows, newFlow] } : mois))
    const { grille, ajouts } = recopierFlux(avecLeNouveau, newFlow, monthIndex, portee, () => createId("flow"))
    setMonthlyData(grille)
    if (ajouts > 0) toast.success(`Flux ajouté à ce mois et recopié sur ${ajouts} autre${ajouts > 1 ? "s" : ""} mois.`)
  }
  /** Recopie un flux du mois ouvert sur les mois suivants, jusqu'en décembre, sans doublon. */
  const handleRecopierFlux = (flowId: string) => {
    if (!openCell) return
    const { monthIndex } = openCell
    const flux = monthlyData[monthIndex].flows.find(f => f.id === flowId)
    if (!flux) return
    const { grille, ajouts } = recopierFlux(monthlyData, flux, monthIndex, "suivants", () => createId("flow"))
    if (ajouts === 0) {
      toast.info("Ce flux est déjà présent sur tous les mois suivants.")
      return
    }
    setMonthlyData(grille)
    toast.success(`Flux recopié sur ${ajouts} mois, jusqu'en décembre.`)
  }
  /** Notification du nombre d'autres mois touchés par une modification ou une suppression de série. */
  const annoncerSerie = (action: string, touches: number) => {
    if (touches > 0) toast.success(`${action} aussi sur ${touches} autre${touches > 1 ? "s" : ""} mois.`)
  }
  // Une modification ou un retrait ne touche que le mois ouvert ; la fenêtre propose ensuite de l'étendre aux autres
  // mois et années où le même flux existe (handleEtendre).
  const handleUpdateFlow = (flowId: string, changes: FlowChanges) => {
    updateOpenMonthFlows(flows => {
      const current = flows.find(f => f.id === flowId)
      if (!current) return flows
      const updated = { ...current, ...changes }
      if (updated.type === current.type && updated.label === current.label && updated.amount === current.amount && updated.grossAmount === current.grossAmount) return flows
      return flows.map(f => (f.id === flowId ? updated : f))
    })
  }
  const handleDeleteFlow = (flowId: string) => {
    updateOpenMonthFlows(flows => (flows.some(f => f.id === flowId) ? flows.filter(f => f.id !== flowId) : flows))
  }
  /**
   * Étend aux autres mois (portée) et aux autres années cochées la dernière modification (`changements`) ou le dernier
   * retrait (`null`) d'un flux du mois ouvert. La série est repérée d'après le flux avant modification : un libellé
   * changé dans ce mois est aussi changé ailleurs. Le mois ouvert, déjà à jour, ne change plus. Une étape d'annulation.
   */
  const handleEtendre = (avant: FinancialFlow, changements: ChangementsDeFlux | null, portee: PorteeRecurrence, aussiEn: number[]) => {
    if (!openCell) return
    const annonce = changements ? "Modifié" : "Retiré"
    if (dansLesAnnees(aussiEn, portee, (a, cible) => (changements ? modifierDansLesAnnees(a, avant, cible, changements) : supprimerDansLesAnnees(a, avant, cible)), `${annonce} aussi sur`)) return
    const { grille, touches } = changements ? modifierSerie(monthlyData, avant, openCell.monthIndex, portee, changements) : supprimerSerie(monthlyData, avant, openCell.monthIndex, portee)
    if (touches === 0) return
    setMonthlyData(grille)
    annoncerSerie(annonce, touches)
  }
  /** Remet dans le mois ouvert un flux retiré, à son rang parmi les flux de son acteur (« Annuler » après un retrait). */
  const handleRestaurer = (flux: FinancialFlow, rang: number) => {
    updateOpenMonthFlows(flows => {
      if (flows.some(f => f.id === flux.id)) return flows
      const deLActeur = flows.filter(f => f.entityId === flux.entityId)
      const suivant = deLActeur[rang]
      const position = suivant ? flows.indexOf(suivant) : deLActeur.length > 0 ? flows.indexOf(deLActeur[deLActeur.length - 1]) + 1 : flows.length
      return [...flows.slice(0, position), flux, ...flows.slice(position)]
    })
  }
  /** Flux de l'acteur dans les autres années de la session, de la plus proche de l'année affichée à la plus lointaine. */
  const fluxDesAutresAnnees = (entityId: string) =>
    [...(annees ?? [])]
      .filter(a => a.annee !== annee)
      .sort((a, b) => Math.abs(a.annee - (annee ?? a.annee)) - Math.abs(b.annee - (annee ?? b.annee)) || a.annee - b.annee)
      .flatMap(a => a.monthlyData.flatMap(mois => mois.flows.filter(f => f.entityId === entityId)))
  /** Où le flux (avant modification) existe hors du mois ouvert : dans l'année affichée et dans les autres années de la session. */
  const serieHorsDuMois = (avant: FinancialFlow) => (openCell ? serieAilleurs(monthlyData, avant, openCell.monthIndex, setAnnees ? (annees ?? []).filter(a => a.annee !== annee) : []) : { precedents: 0, suivants: 0, autresAnnees: [] })
  const handleReorderFlows = (reorderedFlows: FinancialFlow[]) => {
    if (!openCell) return
    const { entityId } = openCell
    updateOpenMonthFlows(flows => [...flows.filter(f => f.entityId !== entityId), ...reorderedFlows])
  }

  // Barres et échelles de chaque acteur, calculées par src/lib/grille-mensuelle.ts.
  const gridData = useMemo(() => donneesDeLaGrille(entities, monthlyData, preferences.flowTypeColors, flowTypeToNumberMap, relationships), [monthlyData, entities, preferences.flowTypeColors, flowTypeToNumberMap, relationships])

  // ===================================================================================
  // == RENDU JSX DU COMPOSANT
  // ===================================================================================
  return (
    <>
      <div className="page-paysage p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md mt-8 print:mt-0 print:p-3">
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <h2 className="text-2xl font-semibold">
            Grille de saisie annuelle
            {/* Sur papier, le sélecteur disparaît : le titre dit de quelle année il s'agit. */}
            {annee !== undefined ? <span className="hidden print:inline"> {annee}</span> : null}
          </h2>
          {selecteurAnnee}
        </div>
        {entities.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">Veuillez d'abord ajouter une entité pour commencer la saisie.</p>
        ) : (
          // La bande des mois reste collée sous les barres du haut tant que la grille est en vue : elle s'arrête au bas de ce bloc.
          <div>
            <AideTactile grilleTouchee={preferences.grilleTouchee} />
            {defilement.deborde ? (
              <BandeDesMois
                libelles={MOIS_ABREGES}
                noms={MOIS}
                flux={fluxDesMois}
                visibles={defilement.visibles}
                auDebut={defilement.auDebut}
                aLaFin={defilement.aLaFin}
                haut={haut}
                onMois={index => defilement.defiler(g => defilementPourLeMois(g, index))}
                onVoisin={sens => defilement.defiler(g => defilementVoisin(g, sens))}
                onGlisser={position => defilement.defiler(g => defilementPourLaPosition(g, position), true)}
              />
            ) : null}
            <div className="relative">
              {/* Une case qui reçoit le focus n'est cachée ni sous la première colonne, fixe (marge de défilement à gauche), ni
                  sous la bande des mois, collée en haut (marge au-dessus des cases). */}
              <div
                ref={zone}
                style={defilement.deborde ? { scrollPaddingLeft: defilement.colonneFixe } : undefined}
                className={cn("relative overflow-x-auto overflow-y-hidden print:overflow-visible", defilement.deborde && "[&_[role=button]]:scroll-mt-14")}
              >
                {/* `w-max` : la grille doit être aussi large que son contenu, sinon la première colonne (sticky) cesse de rester visible une fois la largeur de la fenêtre dépassée.
                    Sur papier, elle tient dans la largeur de la feuille : les douze mois se partagent la place, en petits caractères, et chaque case empile gains et dépenses.
                    `content-start` : quand une ligne s'efface, la hauteur de la grille décroît pas à pas ; les lignes restantes gardent
                    la leur au lieu de s'étirer pour remplir la place (puis de se rétracter d'un coup à la fin). */}
                <div ref={refDeLaGrille} className="grid content-start w-max min-w-full gap-px [grid-template-columns:minmax(5rem,6rem)_repeat(13,auto)] sm:[grid-template-columns:minmax(8rem,11rem)_repeat(13,auto)] print:w-full print:text-[9pt] print:[grid-template-columns:6.5rem_auto_repeat(12,minmax(0,1fr))]">
                  {/* En-tête de la grille */}
                  <div data-colonne-fixe className="font-bold sticky left-0 bg-slate-50 dark:bg-gray-950 z-10 p-2 text-sm sm:text-base print:static print:p-1 print:text-[9pt]">Personnes et activités / Montants</div>
                  <div className="font-bold text-center p-2 print:p-1">Total annuel</div>
                  {MOIS_ABREGES.map(month => (
                    <div key={month} data-mois className="font-bold text-center p-2 print:p-1">
                      {month}
                    </div>
                  ))}
                  {/* Corps de la grille */}
                  {gridData.map((ligne, rang) => (
                    // Un fragment par acteur, sans élément englobant : `position: sticky` de la première colonne en dépend.
                    <React.Fragment key={ligne.entity.id}>
                      <LigneDeLActeur ligne={ligne} rang={rang} onOuvrir={monthIndex => ouvrirLaCase(ligne.entity.id, monthIndex)} />
                    </React.Fragment>
                  ))}
                </div>
              </div>
              {/* Une ombre du côté où des mois sont cachés : à droite tant qu'il en reste, à gauche (après la première colonne, fixe) dès que la grille a défilé. */}
              {defilement.deborde ? <OmbresDesBords gauche={!defilement.auDebut} droite={!defilement.aLaFin} colonneFixe={defilement.colonneFixe} /> : null}
            </div>
          </div>
        )}
      </div>

      {openCell && openCellEntity && (
        <MonthlyFlowsModal
          key={`${openCell.entityId}-${openCell.monthIndex}`}
          onClose={() => setOpenCell(null)}
          flows={monthlyData[openCell.monthIndex].flows.filter(f => f.entityId === openCell.entityId)}
          entity={openCellEntity}
          monthName={MOIS[openCell.monthIndex]}
          annee={annee ?? ANNEE_PAR_DEFAUT}
          autresAnnees={autresAnnees}
          fluxDeLAnnee={monthlyData.flatMap(mois => mois.flows.filter(f => f.entityId === openCell.entityId))}
          fluxDesAutresAnnees={fluxDesAutresAnnees(openCell.entityId)}
          limiteDeRemuneration={limiteDeRemuneration(rapport, openCell.entityId)}
          recus={versementsRecus(monthlyData[openCell.monthIndex].flows, entities, relationships).get(openCell.entityId)}
          couleurs={preferences.flowTypeColors}
          onCreate={handleCreateFlow}
          onRecopier={openCell.monthIndex < 11 ? handleRecopierFlux : undefined}
          onUpdate={handleUpdateFlow}
          onDelete={handleDeleteFlow}
          serieAilleurs={serieHorsDuMois}
          onEtendre={handleEtendre}
          onRestaurer={handleRestaurer}
          onReorder={handleReorderFlows}
        />
      )}
    </>
  )
}

export default MonthlyGrid
